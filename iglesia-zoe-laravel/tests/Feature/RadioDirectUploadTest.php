<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioTrack;
use App\Models\User;
use Aws\CommandInterface;
use Aws\MockHandler;
use Aws\Result;
use DateTimeImmutable;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class RadioDirectUploadTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const MB = 1024 * 1024;

    private const MP3_START = "ID3\x03\x00\x00\x00\x00\x00\x00\xFF\xFB\x90\x64";

    private MockHandler $wasabi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wasabi = new MockHandler;
        config([
            'filesystems.media' => 'wasabi',
            'filesystems.disks.wasabi' => [
                'driver' => 's3',
                'key' => 'test',
                'secret' => 'test',
                'region' => 'us-central-1',
                'bucket' => 'zoe',
                'endpoint' => 'https://s3.us-central-1.wasabisys.com',
                'use_path_style_endpoint' => true,
                'root' => 'dev/public',
                'visibility' => 'public',
                'throw' => true,
                'handler' => $this->wasabi,
            ],
        ]);
        Storage::forgetDisk('wasabi');
    }

    public function test_an_audio_goes_straight_to_wasabi_and_enters_the_library_when_it_is_complete(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $this->expect('ListMultipartUploads', ['Uploads' => [
            ['Key' => 'dev/public/radio/musica/old.mp3', 'UploadId' => 'stale', 'Initiated' => new DateTimeImmutable('-2 days')],
            ['Key' => 'dev/public/radio/musica/new.mp3', 'UploadId' => 'fresh', 'Initiated' => new DateTimeImmutable('-1 hour')],
        ]]);
        $this->expect('AbortMultipartUpload', [], fn (array $args) => $this->assertSame('stale', $args['UploadId']));
        $this->expect('CreateMultipartUpload', ['UploadId' => 'up-1'], function (array $args) {
            $this->assertMatchesRegularExpression('#^dev/public/radio/anuncio/\d{8}-\d{6}-[a-z0-9]{10}\.mp3$#', $args['Key']);
            $this->assertSame('audio/mpeg', $args['ContentType']);
            $this->assertSame('public-read', $args['ACL']);
        });

        $opened = $this->begin($admin, 'retiro.mp3', 20 * self::MB, 'anuncio')->assertOk()->assertJsonPath('direct', true);
        $this->assertCount(3, $opened->json('urls'), 'A 20 MB file goes up in three parts of 8 MB.');
        $this->assertSame(8 * self::MB, $opened->json('partSize'));
        $this->assertStringContainsString('partNumber=3', $opened->json('urls.2'));
        $this->assertStringContainsString('uploadId=up-1', $opened->json('urls.2'));
        $this->assertStringContainsString('X-Amz-Signature=', $opened->json('urls.2'));

        $token = $opened->json('token');
        $parts = json_encode([['n' => 2, 'etag' => '"bbbbbbbbbbbbbbbb"'], ['n' => 1, 'etag' => 'aaaaaaaaaaaaaaaa'], ['n' => 3, 'etag' => 'cccccccccccccccc']]);

        $this->save($this->admin('otro', ['visuales']), $token, $parts)->assertStatus(410)->assertJsonPath('again', true);

        $this->expect('CompleteMultipartUpload', [], fn (array $args) => $this->assertSame(
            [['PartNumber' => 1, 'ETag' => '"aaaaaaaaaaaaaaaa"'], ['PartNumber' => 2, 'ETag' => '"bbbbbbbbbbbbbbbb"'], ['PartNumber' => 3, 'ETag' => '"cccccccccccccccc"']],
            $args['MultipartUpload']['Parts'],
        ));
        $this->expect('HeadObject', ['ContentLength' => 20 * self::MB]);
        $this->expect('GetObject', ['Body' => Utils::streamFor(self::MP3_START.str_repeat("\x00", 400))], fn (array $args) => $this->assertSame('bytes=0-4095', $args['Range']));

        $this->save($admin, $token, $parts)->assertOk()->assertJsonPath('ok', true);
        $track = RadioTrack::query()->sole();
        $this->assertMatchesRegularExpression('#^/media/radio/anuncio/\d{8}-\d{6}-[a-z0-9]{10}\.mp3$#', $track->file_path);
        $this->assertSame(30.0, $track->duration);
        $this->assertSame(0, $this->wasabi->count());

        $this->save($admin, $token, $parts)->assertStatus(410)->assertJsonPath('again', true);
        $this->assertSame(1, RadioTrack::query()->count(), 'An upload is spent once: two audios never share one file.');
    }

    public function test_a_file_that_arrived_incomplete_or_is_not_audio_is_deleted(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $this->begin($admin, 'notas.pdf', self::MB, 'anuncio')->assertUnprocessable();
        $this->begin($admin, 'culto.wav', 3000 * self::MB, 'programa')->assertUnprocessable();

        foreach ([[5 * self::MB, self::MP3_START], [6 * self::MB, '%PDF-1.7 '.str_repeat('x', 400)]] as [$arrived, $start]) {
            cache()->forget('radio.upload.sweep');
            $this->expect('ListMultipartUploads', ['Uploads' => []]);
            $this->expect('CreateMultipartUpload', ['UploadId' => 'up-2']);
            $token = $this->begin($admin, 'retiro.mp3', 6 * self::MB, 'anuncio')->assertOk()->json('token');

            $this->expect('CompleteMultipartUpload');
            $this->expect('HeadObject', ['ContentLength' => $arrived]);
            $this->expect('GetObject', ['Body' => Utils::streamFor($start)]);
            $this->expect('DeleteObject');

            $answer = $this->save($admin, $token, json_encode([['n' => 1, 'etag' => 'aaaaaaaaaaaaaaaa']]));
            $arrived === 6 * self::MB ? $answer->assertUnprocessable() : $answer->assertStatus(410)->assertJsonPath('again', true);
            $this->assertSame(0, $this->wasabi->count());
        }
        $this->assertSame(0, RadioTrack::query()->count());
    }

    public function test_parts_that_do_not_match_the_upload_drop_it(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $this->expect('ListMultipartUploads', ['Uploads' => []]);
        $this->expect('CreateMultipartUpload', ['UploadId' => 'up-3']);
        $token = $this->begin($admin, 'retiro.mp3', 10 * self::MB, 'anuncio')->json('token');

        $this->expect('AbortMultipartUpload', [], fn (array $args) => $this->assertSame('up-3', $args['UploadId']));
        $this->save($admin, $token, json_encode([['n' => 1, 'etag' => 'aaaaaaaaaaaaaaaa']]))->assertStatus(410)->assertJsonPath('again', true);
        $this->assertSame(0, RadioTrack::query()->count());
    }

    public function test_a_recorded_program_goes_straight_to_wasabi_from_the_episodes(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $this->expect('ListMultipartUploads', ['Uploads' => []]);
        $this->expect('CreateMultipartUpload', ['UploadId' => 'up-4'], fn (array $args) => $this->assertStringStartsWith('dev/public/radio/programa/', $args['Key']));
        $token = $this->begin($admin, 'domingo.mp3', 3 * self::MB, 'programa')->json('token');

        $this->expect('CompleteMultipartUpload');
        $this->expect('HeadObject', ['ContentLength' => 3 * self::MB]);
        $this->expect('GetObject', ['Body' => Utils::streamFor(self::MP3_START.str_repeat("\x00", 400))]);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/episodios', [
            'title' => 'La fe que mueve montañas',
            'program' => 'Mañanas con Zoe',
            'description' => 'Una conversación sobre la fe en tiempos difíciles.',
            'aired_on' => '2026-10-01',
            'published' => '1',
            'duration' => '3600',
            'upload' => $token,
            'parts' => json_encode([['n' => 1, 'etag' => 'aaaaaaaaaaaaaaaa']]),
        ])->assertOk()->assertJsonPath('ok', true);

        $track = RadioTrack::query()->sole();
        $this->assertSame('programa', $track->kind);
        $this->assertStringStartsWith('/media/radio/programa/', $track->file_path);
        $this->assertSame(1, $track->episodes()->count());
    }

    public function test_without_wasabi_the_file_travels_with_the_form(): void
    {
        config(['filesystems.media' => 'public']);
        Storage::fake('public');

        $this->begin($this->admin('visuales', ['visuales']), 'retiro.mp3', 5 * self::MB, 'anuncio')->assertOk()->assertExactJson(['direct' => false]);
        $this->begin($this->admin('atmosfera', ['atmosfera']), 'retiro.mp3', 5 * self::MB, 'anuncio')->assertForbidden();
    }

    private function begin(User $user, string $name, int $size, string $kind): TestResponse
    {
        return $this->actingAs($user)->postJson(self::ADMIN.'/admin/radio/subida', ['name' => $name, 'size' => $size, 'kind' => $kind]);
    }

    private function save(User $user, string $token, string $parts): TestResponse
    {
        return $this->actingAs($user)->postJson(self::ADMIN.'/admin/radio/biblioteca', [
            'title' => 'Retiro de jóvenes',
            'kind' => 'anuncio',
            'duration' => '30',
            'upload' => $token,
            'parts' => $parts,
        ]);
    }

    /** The next call the server makes to Wasabi, with the answer it gets. */
    private function expect(string $operation, array $result = [], ?callable $check = null): void
    {
        $this->wasabi->append(function (CommandInterface $command) use ($operation, $result, $check) {
            $this->assertSame($operation, $command->getName());
            if ($check) {
                $check($command->toArray());
            }

            return new Result($result);
        });
    }

    private function admin(string $username, array $types): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => Permissions::forTypes($types),
            'active' => true,
        ]);
    }
}
