<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Editor\EditRecipe;
use App\Domain\Radio\Editor\FilterGraph;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioEpisode;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/** The audio editor cuts and treats library audio with ffmpeg, keeping the original to reopen or undo the edit. */
class RadioEditorTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const ORIGINAL = '/media/radio/musica/cancion.mp3';

    private Filesystem $disk;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->disk = Storage::fake(config('filesystems.media'));
        Storage::fake('local');
        $this->disk->put('radio/musica/cancion.mp3', 'audio original');
        $this->fakeFfmpeg();
    }

    public function test_a_recipe_is_clamped_to_what_the_editor_offers(): void
    {
        $recipe = EditRecipe::from(json_encode([
            'cuts' => [[60, 50], [0.04, 10], [10.05, 12], [199.95, 150], [30, 30.01]],
            'fadeIn' => 40,
            'gain' => -30,
            'voice' => 250,
            'eq' => [3, 'x', 20],
            'preset' => 'Voz<script>',
        ]), 200);

        $this->assertSame([[0.0, 12.0], [50.0, 60.0], [150.0, 200.0]], $recipe['cuts']);
        $this->assertSame([15.0, -12.0, 100, [3.0, 0.0, 12.0, 0.0, 0.0], null], [$recipe['fadeIn'], $recipe['gain'], $recipe['voice'], $recipe['eq'], $recipe['preset']]);
        $this->assertSame(128.0, EditRecipe::length($recipe, 200));

        $crossfaded = EditRecipe::from(['cuts' => [[50, 60]], 'join' => 2], 200);
        $this->assertSame([2.0], EditRecipe::joins($crossfaded, 200));
        $this->assertSame(188.0, EditRecipe::length($crossfaded, 200));

        $this->assertNull(EditRecipe::from(['cuts' => [[0, 199.5]]], 200));
        $this->assertTrue(EditRecipe::isPlain(EditRecipe::from(['preset' => 'natural'], 200)));
    }

    public function test_an_edit_is_rendered_from_the_original_reaches_the_schedule_and_can_be_restored(): void
    {
        $track = $this->track();
        $slot = RadioSlot::query()->create(['starts_at' => now()->addDay(), 'duration' => 200, 'kind' => 'musica', 'radio_track_id' => $track->id, 'title' => $track->title]);

        $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/editor', [
            'id' => $track->id,
            'recipe' => json_encode(['cuts' => [[0.05, 20], [100, 110]], 'fadeOut' => 3, 'voice' => 60, 'normalize' => true, 'preset' => 'voz']),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('status', 'processing');

        $track->refresh();
        $this->assertSame([self::ORIGINAL, 200.0, 170.0, null], [$track->original_path, $track->original_duration, $track->duration, $track->edit_status]);
        $this->assertStringEndsWith('-editado.mp3', $track->file_path);
        $this->assertEquals([[0, 20], [100, 110]], $track->edit['cuts']);
        $this->assertSame(170.0, $slot->refresh()->duration);
        $this->disk->assertExists(substr($track->file_path, strlen('/media/')));
        $this->disk->assertExists('radio/musica/cancion.mp3');
        Process::assertRan(fn (PendingProcess $process) => str_contains($this->graph($process), 'pan=mono|c0=0.5*c0+0.5*c1') && str_contains($this->graph($process), 'volume=6dB') && str_contains($this->graph($process), 'alimiter=limit=0.841'));

        $edited = substr($track->file_path, strlen('/media/'));
        $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/editor', [
            'id' => $track->id,
            'recipe' => json_encode(['cuts' => [[180, 200]]]),
        ], ['Accept' => 'application/json'])->assertOk();
        $track->refresh();
        $this->assertSame([self::ORIGINAL, 180.0], [$track->original_path, $track->duration]);
        $this->disk->assertMissing($edited);

        $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/editor/restaurar', ['id' => $track->id], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('reload', true);
        $track->refresh();
        $this->assertSame([self::ORIGINAL, null, 200.0, null], [$track->file_path, $track->original_path, $track->duration, $track->edit]);
        $this->assertSame(200.0, $slot->refresh()->duration);
        $this->assertSame(['radio/musica/cancion.mp3'], $this->disk->allFiles('radio'));
    }

    public function test_the_editor_explains_why_it_cannot_save(): void
    {
        $track = $this->track();
        $save = fn (array $recipe) => $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/editor', ['id' => $track->id, 'recipe' => json_encode($recipe)], ['Accept' => 'application/json']);

        $save(['preset' => 'natural'])->assertStatus(422)->assertJsonPath('error', 'Todavía no hiciste ningún cambio en este audio.');
        $save(['cuts' => [[0, 199.5]]])->assertStatus(422)->assertJsonPath('error', 'La edición dejaría menos de 1 segundo de audio. Revisa los cortes.');

        $track->update(['edit_status' => 'processing']);
        $save(['voice' => 40])->assertStatus(409);

        $track->forceFill(['updated_at' => now()->subHour()])->saveQuietly();
        $this->actingAs($this->admin())->get(self::ADMIN.'/admin/radio/editor/estado?id='.$track->id)
            ->assertOk()->assertJsonPath('status', 'failed')->assertJsonPath('error', 'El procesamiento se interrumpió. Vuelve a guardar la edición.');
    }

    public function test_a_failed_render_keeps_the_audio_and_says_so(): void
    {
        Process::fake(['*' => Process::result(errorOutput: 'Invalid data found when processing input', exitCode: 1)]);
        $track = $this->track();

        $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/editor', ['id' => $track->id, 'recipe' => json_encode(['gain' => 3])], ['Accept' => 'application/json'])->assertOk();

        $track->refresh();
        $this->assertSame([self::ORIGINAL, null, 'failed'], [$track->file_path, $track->original_path, $track->edit_status]);
        $this->assertSame('No se pudo procesar el audio. Revisa que el archivo original no esté dañado e inténtalo de nuevo.', $track->edit_error);
    }

    public function test_the_waveform_and_loudness_are_measured_once(): void
    {
        $track = $this->track();

        foreach ([1, 2] as $time) {
            $this->actingAs($this->admin())->get(self::ADMIN.'/admin/radio/editor/analisis?id='.$track->id)
                ->assertOk()
                ->assertJsonPath('perSecond', 100)
                ->assertJsonPath('peaks', base64_encode(pack('cccc', -10, 20, 0, 0)))
                ->assertJsonPath('loudness', -18.5)
                ->assertJsonPath('peak', -3.2);
        }
        Process::assertRanTimes(fn (PendingProcess $process) => str_contains($this->graph($process), 'ebur128'), 1);
    }

    public function test_the_final_result_sample_is_rendered_from_the_playhead(): void
    {
        $track = $this->track();

        $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/editor/muestra', ['id' => $track->id, 'recipe' => json_encode(['denoise' => 40]), 'at' => '42.5'])
            ->assertOk()->assertHeader('Content-Type', 'audio/mpeg');

        Process::assertRan(fn (PendingProcess $process) => str_contains($this->graph($process), 'afftdn=nr=15.6') && in_array('42.500', $process->command, true));
    }

    public function test_the_page_opens_the_original_with_the_saved_edit(): void
    {
        $track = $this->track(['original_path' => self::ORIGINAL, 'original_duration' => 200, 'file_path' => '/media/radio/musica/editado.mp3', 'duration' => 150, 'edit' => EditRecipe::from(['cuts' => [[0, 50]]], 200)]);

        $this->actingAs($this->admin())->get(self::ADMIN.'/admin/radio/editor?audio='.$track->id)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Radio/Editor')
                ->where('tracks.0.edited', true)
                ->where('current.duration', fn ($seconds) => $seconds == 150)
                ->where('current.source.duration', fn ($seconds) => $seconds == 200)
                ->where('current.source.src', self::ORIGINAL)
                ->where('current.edit.cuts', fn ($cuts) => $cuts->all() == [[0, 50]])
                ->where('limits.targetLufs', fn ($lufs) => $lufs == FilterGraph::TARGET_LUFS));
    }

    public function test_a_new_audio_drops_the_edit_and_deleting_removes_the_original_too(): void
    {
        $this->disk->put('radio/musica/editado.mp3', 'editado');
        $track = $this->track(['original_path' => self::ORIGINAL, 'original_duration' => 200, 'file_path' => '/media/radio/musica/editado.mp3', 'duration' => 150, 'edit' => EditRecipe::from(['cuts' => [[0, 50]]], 200)]);

        $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/biblioteca', [
            'id' => $track->id,
            'kind' => 'musica',
            'title' => 'Renuévame',
            'artist' => 'Marcos Witt',
            'duration' => '230',
            'audio' => UploadedFile::fake()->create('nueva.mp3', 300, 'audio/mpeg'),
        ], ['Accept' => 'application/json'])->assertOk();

        $track->refresh();
        $this->assertSame([null, null, null, 230.0], [$track->original_path, $track->edit, $track->edited_at, $track->duration]);
        $this->disk->assertMissing('radio/musica/cancion.mp3');
        $this->disk->assertMissing('radio/musica/editado.mp3');

        $track->update(['original_path' => self::ORIGINAL]);
        $this->disk->put('radio/musica/cancion.mp3', 'audio original');
        $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/biblioteca/eliminar', ['id' => $track->id], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame([], $this->disk->allFiles('radio'));
    }

    public function test_who_manages_only_episodes_edits_only_the_audio_of_episodes(): void
    {
        $song = $this->track();
        $program = $this->track(['kind' => 'programa', 'title' => 'Mañanas con Zoe']);
        RadioEpisode::query()->create(['radio_track_id' => $program->id, 'title' => 'Mañanas con Zoe', 'aired_on' => '2026-10-01']);
        $episodes = $this->admin('episodios', ['radio.episodes']);

        $this->actingAs($episodes)->get(self::ADMIN.'/admin/radio/editor')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('tracks', 1)->where('tracks.0.id', $program->id));
        $this->actingAs($episodes)->post(self::ADMIN.'/admin/radio/editor', ['id' => $song->id, 'recipe' => json_encode(['gain' => 2])], ['Accept' => 'application/json'])->assertNotFound();

        $this->actingAs($this->admin('consola', ['radio.console']))->get(self::ADMIN.'/admin/radio/editor')->assertRedirect('/admin');
    }

    private function track(array $fields = []): RadioTrack
    {
        return RadioTrack::query()->create(['kind' => 'musica', 'title' => 'Renuévame', 'file_path' => self::ORIGINAL, 'duration' => 200, 'active' => true, ...$fields]);
    }

    /**
     * ffmpeg as the editor runs it: writes the files it is asked for and logs the loudness it measures.
     */
    private function fakeFfmpeg(): void
    {
        Process::fake(function (PendingProcess $process) {
            $command = $process->command;
            $graph = $this->graph($process);
            if (str_contains($graph, 'ebur128')) {
                $pcm = $command[array_search('pcm_s16le', $command, true) + 1];
                file_put_contents($pcm, pack('s*', -2560, 5120, ...array_fill(0, 158, 0)));

                return Process::result(errorOutput: "Summary:\n  Integrated loudness:\n    I:         -18.5 LUFS\n  True peak:\n    Peak:       -3.2 dBFS");
            }
            if (str_contains($graph, 'loudnorm')) {
                return Process::result(errorOutput: "{\n\t\"input_i\" : \"-20.00\",\n\t\"input_tp\" : \"-1.00\"\n}");
            }
            file_put_contents(end($command), 'mp3 editado');

            return Process::result();
        });
    }

    private function graph(PendingProcess $process): string
    {
        $command = (array) $process->command;
        $index = array_search('-filter_complex', $command, true);

        return $index === false ? '' : (string) $command[$index + 1];
    }

    private function admin(string $username = 'visuales', ?array $permissions = null): User
    {
        return User::query()->firstOrCreate(['username' => $username], [
            'name' => ucfirst($username),
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['visuales'],
            'permissions' => $permissions ?? Permissions::forTypes(['visuales']),
            'active' => true,
        ]);
    }
}
