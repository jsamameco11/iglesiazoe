<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Stream\Jobs\ArchiveRecording;
use App\Domain\Stream\Jobs\PublishTeachingVideo;
use App\Domain\Stream\StreamSettings;
use App\Domain\Stream\TeachingVideos;
use App\Models\LiveRecording;
use App\Models\LiveStream;
use App\Models\Teaching;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** OBS → media server → site and YouTube; the broadcast ends as a teaching and its recording lives a few days on Wasabi. */
class LiveStreamTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const MEDIA_SERVER = 'http://127.0.0.1:9997/*';

    private string $scratch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scratch = sys_get_temp_dir().'/zoe-stream-test-'.uniqid();
        config(['stream.recordings' => $this->scratch.'/grabaciones', 'stream.uploads' => $this->scratch.'/subidas']);
        File::ensureDirectoryExists($this->scratch.'/grabaciones/envivo');
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->scratch);
        parent::tearDown();
    }

    public function test_the_media_server_lets_only_the_church_key_publish(): void
    {
        $key = StreamSettings::streamKey();

        $this->postJson('/transmision/servidor/autorizar', ['action' => 'publish', 'path' => 'envivo', 'user' => 'zoe', 'password' => $key])->assertOk();
        $this->postJson('/transmision/servidor/autorizar', ['action' => 'publish', 'path' => 'envivo', 'user' => 'zoe', 'password' => 'otra-clave'])->assertUnauthorized();
        $this->postJson('/transmision/servidor/autorizar', ['action' => 'publish', 'path' => 'otro', 'user' => 'zoe', 'password' => $key])->assertUnauthorized();
        $this->postJson('/transmision/servidor/autorizar', ['action' => 'read', 'path' => 'envivo'])->assertOk();
    }

    public function test_the_signal_puts_the_prepared_broadcast_on_air_and_the_site_follows_it(): void
    {
        Http::preventStrayRequests();
        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/transmision', ['title' => 'Domingo de celebración', 'description' => 'Fe que mueve montañas', 'preacher' => 'Pastor Juan', 'kind' => 'predica', 'show_summary' => '1', 'to_youtube' => '0', 'privacy' => 'public'])
            ->assertOk()
            ->assertJsonPath('ok', true);
        $live = LiveStream::query()->sole();
        $this->assertSame('ready', $live->status);

        $this->artisan('stream:started')->doesntExpectOutputToContain('rtmp')->assertSuccessful();

        $this->assertSame('live', $live->fresh()->status);
        $this->getJson('/en-vivo/estado')
            ->assertOk()
            ->assertJsonPath('live', true)
            ->assertJsonPath('signal', true)
            ->assertJsonPath('title', 'Domingo de celebración')
            ->assertJsonPath('description', 'Fe que mueve montañas')
            ->assertJsonPath('youtube_id', null);

        $this->artisan('stream:stopped')->assertSuccessful();

        $this->assertNotNull($live->fresh()->signal_lost_at);
        $this->getJson('/en-vivo/estado')->assertJsonPath('live', true)->assertJsonPath('signal', false);
    }

    public function test_ending_a_broadcast_saves_it_as_a_teaching_with_its_youtube_video_and_queues_the_recording(): void
    {
        Queue::fake([ArchiveRecording::class]);
        Http::preventStrayRequests();
        Http::fake([
            self::MEDIA_SERVER => Http::response([], 404),
            'https://www.googleapis.com/youtube/v3/liveBroadcasts/transition*' => Http::response(['id' => 'AbCdEfGhIjK']),
        ]);
        $this->connectYouTube();
        $live = LiveStream::factory()->live()->toYouTube()->create(['title' => 'Reunión del domingo', 'options' => ['privacy' => 'public']]);

        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/transmision/finalizar', ['id' => $live->id])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $live->refresh();
        $this->assertSame('ended', $live->status);
        $this->assertSame('panel', $live->end_reason);
        $teaching = Teaching::query()->sole();
        $this->assertSame('Reunión del domingo', $teaching->title);
        $this->assertSame('live', $teaching->source);
        $this->assertSame('AbCdEfGhIjK', $teaching->youtube_id);
        $this->assertSame($teaching->id, $live->teaching_id);
        $this->assertTrue($teaching->isOnSite());
        Http::assertSent(fn ($request) => str_contains($request->url(), 'liveBroadcasts/transition') && str_contains($request->url(), 'broadcastStatus=complete') && str_contains($request->url(), 'id=AbCdEfGhIjK'));
        Queue::assertPushed(ArchiveRecording::class, fn (ArchiveRecording $job) => $job->liveStreamId === $live->id);
    }

    public function test_right_after_a_broadcast_ends_a_new_signal_waits_for_the_cooldown(): void
    {
        Queue::fake([ArchiveRecording::class]);
        Http::preventStrayRequests();
        Http::fake([self::MEDIA_SERVER => Http::response([], 404)]);
        $key = StreamSettings::streamKey();
        $live = LiveStream::factory()->live()->create();
        $this->actingAs($this->superadmin())->postJson(self::ADMIN.'/admin/transmision/finalizar', ['id' => $live->id])->assertOk();
        $publish = ['action' => 'publish', 'path' => 'envivo', 'user' => 'zoe', 'password' => $key];

        $this->postJson('/transmision/servidor/autorizar', $publish)->assertUnauthorized();

        $this->travel(config('stream.cooldown_seconds') + 1)->seconds();
        $this->postJson('/transmision/servidor/autorizar', $publish)->assertOk();
    }

    public function test_a_broadcast_without_signal_for_the_grace_period_ends_on_its_own(): void
    {
        Queue::fake([ArchiveRecording::class]);
        Http::preventStrayRequests();
        $grace = (int) config('stream.grace_minutes');
        $abandoned = LiveStream::factory()->live()->create(['signal_lost_at' => now()->subMinutes($grace + 1)]);
        $waiting = LiveStream::factory()->live()->create(['signal_lost_at' => now()->subMinutes($grace - 5)]);

        $this->artisan('stream:watch')->assertSuccessful();

        $this->assertSame('ended', $abandoned->fresh()->status);
        $this->assertSame('timeout', $abandoned->fresh()->end_reason);
        $this->assertSame('live', $waiting->fresh()->status);
        $teaching = Teaching::query()->sole();
        $this->assertSame($abandoned->title, $teaching->title);
        $this->assertFalse($teaching->isOnSite());
    }

    public function test_the_recording_is_joined_kept_on_wasabi_for_the_retention_days_and_then_deleted(): void
    {
        $this->freezeTime();
        $vault = Storage::fake(config('filesystems.vault'));
        Process::fake(function (PendingProcess $process) {
            $command = (array) $process->command;
            if ($command[0] === config('stream.ffmpeg')) {
                File::put(end($command), 'video-unido');

                return Process::result();
            }

            return Process::result('5400.2');
        });
        $segments = [$this->scratch.'/grabaciones/envivo/parte-1.mp4', $this->scratch.'/grabaciones/envivo/parte-2.mp4'];
        File::put($segments[0], 'uno');
        File::put($segments[1], 'dos');
        $live = LiveStream::factory()->create(['title' => 'Domingo de celebración', 'status' => 'ended', 'started_at' => now()->subHours(2), 'ended_at' => now(), 'segments' => $segments]);

        ArchiveRecording::dispatchSync($live->id);

        $recording = LiveRecording::query()->sole();
        $this->assertSame('ready', $recording->status);
        $this->assertSame(5400, $recording->duration_seconds);
        $this->assertSame(now()->addHours((int) config('stream.retention_hours'))->toDateTimeString(), $recording->expires_at->toDateTimeString());
        $vault->assertExists($recording->path);
        $this->assertSame('video-unido', $vault->get($recording->path));
        $this->assertFileDoesNotExist($segments[0]);
        $this->assertFileDoesNotExist($segments[1]);
        $this->assertSame([], $live->fresh()->segments);

        $this->travel((int) config('stream.retention_hours') + 1)->hours();
        $this->artisan('stream:purge')->assertSuccessful();

        $vault->assertMissing($recording->path);
        $this->assertSame('expired', $recording->fresh()->status);
        $this->assertNull($recording->fresh()->path);
    }

    public function test_an_edited_video_arrives_in_parts_and_is_queued_for_youtube(): void
    {
        Queue::fake([PublishTeachingVideo::class]);
        $this->connectYouTube();
        $super = $this->superadmin();
        $teaching = Teaching::query()->create(['title' => 'La gratitud', 'kind' => 'predica', 'teaching_date' => '2026-10-04', 'active' => true, 'source' => 'manual']);
        $video = random_bytes(300 * 1024);
        $first = substr($video, 0, 100 * 1024);

        $upload = $this->actingAs($super)->postJson(self::ADMIN.'/admin/recursos/video/iniciar', ['name' => 'gratitud-editado.mp4', 'size' => strlen($video)])
            ->assertOk()
            ->json('upload');
        $this->postJson(self::ADMIN.'/admin/recursos/video/parte', ['upload' => $upload, 'offset' => 0, 'chunk' => UploadedFile::fake()->createWithContent('part', $first)])
            ->assertOk()
            ->assertJsonPath('offset', strlen($first));
        $this->postJson(self::ADMIN.'/admin/recursos/video/parte', ['upload' => $upload, 'offset' => 0, 'chunk' => UploadedFile::fake()->createWithContent('part', $first)])
            ->assertOk()
            ->assertJsonPath('offset', strlen($first));
        $this->postJson(self::ADMIN.'/admin/recursos/video/parte', ['upload' => $upload, 'offset' => strlen($first), 'chunk' => UploadedFile::fake()->createWithContent('part', substr($video, strlen($first)))])
            ->assertOk()
            ->assertJsonPath('offset', strlen($video));
        $this->postJson(self::ADMIN.'/admin/recursos/publicar', ['id' => $teaching->id, 'source' => 'upload', 'upload' => $upload, 'privacy' => 'unlisted', 'tags' => 'iglesia, fe'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $teaching->refresh();
        $this->assertSame('uploading', $teaching->youtube_status);
        $this->assertSame('unlisted', $teaching->youtube_options['privacy']);
        $this->assertSame(['iglesia', 'fe'], $teaching->youtube_options['tags']);
        $this->assertSame($video, File::get(config('stream.uploads').'/'.$teaching->upload_path));
        Queue::assertPushed(PublishTeachingVideo::class, fn (PublishTeachingVideo $job) => $job->teachingId === $teaching->id && $job->recordingId === null);
    }

    public function test_publishing_to_youtube_needs_the_live_permission(): void
    {
        Queue::fake([PublishTeachingVideo::class]);
        $editor = User::query()->create([
            'name' => 'Editora', 'username' => 'editora', 'email' => 'editora@iglesiacristianazoe.pe', 'password' => 'secreto1',
            'role' => Role::Admin, 'admin_types' => [], 'permissions' => ['content.manage'], 'active' => true,
        ]);
        $teaching = Teaching::query()->create(['title' => 'La gratitud', 'kind' => 'predica', 'teaching_date' => '2026-10-04', 'active' => true, 'source' => 'manual']);

        $this->actingAs($editor)->get(self::ADMIN.'/admin/recursos')->assertOk();
        $this->actingAs($editor)
            ->postJson(self::ADMIN.'/admin/recursos/publicar', ['id' => $teaching->id, 'source' => 'upload', 'upload' => 'x', 'privacy' => 'public'])
            ->assertForbidden();

        Queue::assertNotPushed(PublishTeachingVideo::class);
    }

    public function test_a_failed_replacement_keeps_the_current_video_on_the_site(): void
    {
        Http::preventStrayRequests();
        $teaching = Teaching::query()->create([
            'title' => 'La gratitud', 'kind' => 'predica', 'teaching_date' => '2026-10-04', 'active' => true, 'source' => 'live',
            'youtube_id' => 'AbCdEfGhIjK', 'youtube_privacy' => 'public', 'youtube_status' => 'uploading', 'upload_path' => null,
        ]);

        TeachingVideos::send($teaching->id, null);

        $teaching->refresh();
        $this->assertSame('ready', $teaching->youtube_status);
        $this->assertSame('AbCdEfGhIjK', $teaching->youtube_id);
        $this->assertStringContainsString('Sigue publicado el video anterior', $teaching->youtube_error);
        $this->assertTrue($teaching->isOnSite());
    }

    public function test_only_teachings_with_a_watchable_video_or_a_file_reach_the_site(): void
    {
        $teaching = fn (string $title, array $extra) => Teaching::query()->create(['title' => $title, 'kind' => 'predica', 'teaching_date' => '2026-10-04', 'active' => true, 'source' => 'manual', ...$extra]);
        $teaching('Pública', ['youtube_id' => 'AbCdEfGhIj1', 'youtube_privacy' => 'public']);
        $teaching('No listada', ['youtube_id' => 'AbCdEfGhIj2', 'youtube_privacy' => 'unlisted']);
        $teaching('Con archivo', ['file_path' => '/media/recursos/2026/guia.pdf']);
        $teaching('Privada', ['youtube_id' => 'AbCdEfGhIj3', 'youtube_privacy' => 'private']);
        $teaching('Fallida', ['youtube_id' => 'AbCdEfGhIj4', 'youtube_status' => 'failed']);
        $teaching('Sin video', []);
        $teaching('Oculta', ['youtube_id' => 'AbCdEfGhIj5', 'active' => false]);

        $this->assertEqualsCanonicalizing(['Pública', 'No listada', 'Con archivo'], Teaching::query()->onSite()->pluck('title')->all());
    }

    private function connectYouTube(): void
    {
        config(['stream.youtube.client_id' => 'cliente-de-prueba', 'stream.youtube.client_secret' => 'secreto-de-prueba']);
        StreamSettings::putYoutube(['refresh' => 'refresh-de-prueba', 'access' => 'access-de-prueba', 'expires_at' => time() + 3600, 'ingest_id' => 'ingesta']);
    }

    private function superadmin(): User
    {
        return User::query()->create([
            'name' => 'Super',
            'username' => 'super',
            'email' => 'super@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Superadmin,
            'admin_types' => [],
            'permissions' => [],
            'active' => true,
        ]);
    }
}
