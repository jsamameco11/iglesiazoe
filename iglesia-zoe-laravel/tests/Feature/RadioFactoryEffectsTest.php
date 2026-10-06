<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class RadioFactoryEffectsTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_a_factory_effect_is_stored_once_in_the_library_and_added_at_the_end_of_the_botonera(): void
    {
        $disk = Storage::fake(config('filesystems.media'));

        $this->effect(['title' => 'Boing', 'category' => 'Graciosos'])
            ->assertOk()->assertJsonPath('pads.0.title', 'Boing')->assertJsonPath('message', '«Boing» agregado a la botonera.');
        $boing = RadioTrack::query()->sole();
        $this->assertSame(['efecto', 'Efectos Zoe · Graciosos', false, false, true], [$boing->kind, $boing->artist, $boing->rotation, $boing->duck, $boing->active]);
        $disk->assertExists(str($boing->file_path)->after('/media/')->toString());

        $this->effect(['title' => 'Boing', 'category' => 'Graciosos'])->assertStatus(409)->assertJsonPath('error', '«Boing» ya está en la botonera.');
        $this->effect(['title' => 'Ding', 'category' => 'Alertas y avisos'])->assertOk()->assertJsonPath('pads.1.title', 'Ding');

        Station::saveConfig(['pads' => []]);
        $boing->update(['active' => false]);
        $this->effect(['title' => 'Boing', 'category' => 'Graciosos', 'audio' => null])->assertOk()->assertJsonPath('pads.0.id', $boing->id);
        $this->assertSame(2, RadioTrack::query()->count(), 'Added again, the effect reuses its library audio.');
        $this->assertTrue($boing->refresh()->active);
    }

    public function test_a_full_botonera_a_bad_effect_or_a_user_without_the_console_adds_nothing(): void
    {
        Storage::fake(config('filesystems.media'));
        $pads = collect(range(1, Station::MAX_PADS))->map(fn (int $number) => RadioTrack::query()->create([
            'kind' => 'efecto', 'title' => "Efecto {$number}", 'file_path' => "/media/radio/efecto/{$number}.wav", 'duration' => 2, 'active' => true,
        ])->id);
        Station::saveConfig(['pads' => $pads->all()]);

        $this->effect(['title' => 'Boing', 'category' => 'Graciosos'])->assertStatus(409)
            ->assertJsonPath('error', 'La botonera tiene hasta 16 botones. Quita uno con «Editar» para agregar este efecto.');
        Station::saveConfig(['pads' => []]);
        $this->effect(['title' => 'Boing', 'category' => 'Graciosos', 'duration' => '0'])->assertStatus(422);
        $this->effect(['title' => 'Boing', 'category' => 'Graciosos', 'audio' => UploadedFile::fake()->create('boing.txt', 10, 'text/plain')])->assertStatus(422);
        $this->effect(['title' => 'Boing', 'category' => 'Graciosos'], ['radio.library'])->assertForbidden();

        $this->assertSame(Station::MAX_PADS, RadioTrack::query()->count());
    }

    /** @param  array<string, mixed>  $fields */
    private function effect(array $fields, array $permissions = ['radio.console']): TestResponse
    {
        return $this->actingAs($this->admin($permissions))->post(self::ADMIN.'/admin/radio/botonera/efecto', array_filter([
            'duration' => '1.2',
            'audio' => UploadedFile::fake()->create('efecto.wav', 100, 'audio/wav'),
            ...$fields,
        ], fn (mixed $value) => $value !== null), ['Accept' => 'application/json']);
    }

    private function admin(array $permissions): User
    {
        $username = 'radio'.count($permissions).implode('', $permissions);

        return User::query()->firstOrCreate(['username' => str($username)->slug()->toString()], [
            'name' => 'Radio',
            'email' => str($username)->slug().'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['atmosfera'],
            'permissions' => array_values(array_intersect($permissions, Permissions::RADIO)),
            'active' => true,
        ]);
    }
}
