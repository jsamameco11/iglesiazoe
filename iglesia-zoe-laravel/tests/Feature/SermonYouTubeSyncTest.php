<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Sermons\SermonSettings;
use App\Models\Sermon;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class SermonYouTubeSyncTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const CHANNEL = 'https://www.youtube.com/@iglesiacristianazoe6279/streams';

    private const SUNDAY = 'SunDayAbc12';

    private const WEDNESDAY = 'WedNesday12';

    public function test_new_services_of_the_channel_go_straight_to_the_site_with_their_youtube_details(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', SermonSettings::TIMEZONE));
        $this->fakeChannel([
            ['id' => self::SUNDAY, 'title' => 'Servicio Dominical 04/10/26 - Semana 41', 'views' => 120, 'clock' => '1:17:43'],
            ['id' => 'ShortClip01', 'title' => 'Corte de transmisión', 'views' => 9, 'clock' => '5:10'],
            ['id' => 'LiveNow0001', 'title' => 'En vivo ahora', 'views' => 40, 'clock' => null],
            ['id' => self::WEDNESDAY, 'title' => 'Miércoles - Semana 40', 'views' => 353, 'clock' => '1:13:31'],
        ], [
            self::SUNDAY => ['start' => '2026-10-04T15:31:00+00:00', 'seconds' => 4663, 'views' => 121],
            self::WEDNESDAY => ['start' => '2026-10-01T00:58:22+00:00', 'seconds' => 4411, 'views' => 353],
        ]);

        $this->artisan('sermons:sync')->assertSuccessful();

        $sunday = Sermon::query()->where('youtube_id', self::SUNDAY)->sole();
        $this->assertSame('Servicio Dominical 04/10/26 - Semana 41', $sunday->title);
        $this->assertSame('Servicio dominical', $sunday->series);
        $this->assertSame('2026-10-04', $sunday->sermon_date->toDateString());
        $this->assertSame(4663, $sunday->duration);
        $this->assertSame('Iglesia Cristiana Zoe', $sunday->channel);
        $this->assertStringContainsString('Nos alegra', $sunday->description);
        $this->assertTrue($sunday->published);
        $this->assertFalse($sunday->pending);

        $wednesday = Sermon::query()->where('youtube_id', self::WEDNESDAY)->sole();
        $this->assertSame('2026-09-30', $wednesday->sermon_date->toDateString(), 'A Wednesday night service in Lima keeps its local date.');
        $this->assertSame('Servicio de media semana', $wednesday->series);
        $this->assertSame(0, Sermon::query()->whereIn('youtube_id', ['ShortClip01', 'LiveNow0001'])->count());

        $run = SermonSettings::runs()[0];
        $this->assertSame(['found' => 4, 'added' => 2, 'pending' => 0], ['found' => $run['found'], 'added' => $run['added'], 'pending' => $run['pending']]);
        $this->assertEquals(['en vivo o programados' => 1, 'muy cortos' => 1], $run['skipped']);

        $this->visitor('/predicas')->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Sermons')
            ->has('sermons', 2)
            ->where('sermons.0.youtube_id', self::SUNDAY)
            ->where('sermons.0.duration', 4663)
            ->where('sermons.0.views', 121)
            ->where('sermons.0.channel', 'Iglesia Cristiana Zoe'));
    }

    public function test_a_sermon_added_by_hand_takes_the_youtube_title_and_details_unless_an_admin_wrote_its_own_title(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', SermonSettings::TIMEZONE));
        $plain = Sermon::factory()->create(['title' => 'Servicio de media semana del 30 de setiembre', 'youtube_id' => self::WEDNESDAY, 'sermon_date' => '2026-09-30']);
        $custom = Sermon::factory()->create(['title' => 'Mi título', 'youtube_id' => self::SUNDAY, 'youtube_title' => 'Viejo', 'title_locked' => true]);
        $this->fakeChannel([
            ['id' => self::SUNDAY, 'title' => 'Servicio Dominical 04/10/26 - Semana 41', 'views' => 120, 'clock' => '1:17:43'],
            ['id' => self::WEDNESDAY, 'title' => 'Miércoles - Semana 40', 'views' => 353, 'clock' => '1:13:31'],
        ], [
            self::SUNDAY => ['start' => '2026-10-04T15:31:00+00:00', 'seconds' => 4663, 'views' => 121],
            self::WEDNESDAY => ['start' => '2026-10-01T00:58:22+00:00', 'seconds' => 4411, 'views' => 353],
        ]);

        $this->artisan('sermons:sync --force')->assertSuccessful();

        $plain->refresh();
        $this->assertSame('Miércoles - Semana 40', $plain->title);
        $this->assertSame(4411, $plain->duration);
        $this->assertNotNull($plain->synced_at);
        $this->assertSame('manual', $plain->source);
        $this->assertSame('Mi título', $custom->refresh()->title);
        $this->assertSame('Servicio Dominical 04/10/26 - Semana 41', $custom->youtube_title);
        $this->assertSame(2, Sermon::query()->count());

        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/predicas', ['id' => $custom->id, 'title' => 'Mi título', 'youtube_id' => self::SUNDAY, 'published' => '1', 'restore_title' => '1'])
            ->assertOk();
        $this->assertSame('Servicio Dominical 04/10/26 - Semana 41', $custom->refresh()->title);
        $this->assertFalse($custom->title_locked);
    }

    public function test_in_review_mode_new_videos_wait_for_an_admin_and_discarded_ones_never_come_back(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', SermonSettings::TIMEZONE));
        SermonSettings::save([...SermonSettings::current(), 'mode' => 'review']);
        $this->fakeChannel([
            ['id' => self::SUNDAY, 'title' => 'Servicio Dominical 04/10/26 - Semana 41', 'views' => 120, 'clock' => '1:17:43'],
            ['id' => self::WEDNESDAY, 'title' => 'Miércoles - Semana 40', 'views' => 353, 'clock' => '1:13:31'],
        ], [
            self::SUNDAY => ['start' => '2026-10-04T15:31:00+00:00', 'seconds' => 4663, 'views' => 121],
            self::WEDNESDAY => ['start' => '2026-10-01T00:58:22+00:00', 'seconds' => 4411, 'views' => 353],
        ]);

        $this->artisan('sermons:sync')->assertSuccessful();

        $this->assertSame(2, Sermon::query()->where('pending', true)->where('published', false)->count());
        $this->visitor('/predicas')->assertInertia(fn (AssertableInertia $page) => $page->has('sermons', 0));

        $super = $this->superadmin();
        $sunday = Sermon::query()->where('youtube_id', self::SUNDAY)->sole();
        $wednesday = Sermon::query()->where('youtube_id', self::WEDNESDAY)->sole();
        $this->actingAs($super)->postJson(self::ADMIN.'/admin/predicas/revisar', ['action' => 'approve', 'ids' => [$sunday->id]])
            ->assertOk()->assertJsonPath('message', 'Video publicado en la página.');
        $this->actingAs($super)->postJson(self::ADMIN.'/admin/predicas/revisar', ['action' => 'discard', 'ids' => [$wednesday->id]])
            ->assertOk();

        $this->visitor('/predicas')->assertInertia(fn (AssertableInertia $page) => $page->has('sermons', 1)->where('sermons.0.youtube_id', self::SUNDAY));
        $this->assertSame([self::WEDNESDAY], SermonSettings::ignored());

        $this->artisan('sermons:sync --force')->assertSuccessful();

        $this->assertSame(0, Sermon::query()->where('youtube_id', self::WEDNESDAY)->count());
        $this->assertSame(['descartados' => 1], SermonSettings::runs()[0]['skipped']);
    }

    public function test_the_watcher_looks_at_the_configured_hours_and_stays_quiet_in_between(): void
    {
        Http::preventStrayRequests();
        SermonSettings::recordRun(['at' => CarbonImmutable::parse('2026-10-06 14:00:30', SermonSettings::TIMEZONE)->toIso8601String(), 'trigger' => 'auto']);

        $this->travelTo(CarbonImmutable::parse('2026-10-07 01:59', SermonSettings::TIMEZONE));
        $this->assertSame('2026-10-07 02:00', SermonSettings::nextRunAt()->format('Y-m-d H:i'));
        $this->assertFalse(SermonSettings::due());
        $this->artisan('sermons:sync')->assertSuccessful();

        $this->travelTo(CarbonImmutable::parse('2026-10-07 02:00', SermonSettings::TIMEZONE));
        $this->assertTrue(SermonSettings::due());

        SermonSettings::save([...SermonSettings::current(), 'mode' => 'off']);
        $this->assertFalse(SermonSettings::due());
        $this->assertNull(SermonSettings::nextRunAt());
    }

    public function test_a_channel_that_does_not_answer_is_logged_and_nothing_changes(): void
    {
        Http::preventStrayRequests();
        Http::fake([self::CHANNEL => Http::response('', 503)]);

        $this->artisan('sermons:sync --force')->assertFailed();

        $this->assertSame(0, Sermon::query()->count());
        $this->assertStringContainsString('503', SermonSettings::runs()[0]['error']);
        $this->assertNotNull(SermonSettings::lastRunAt(), 'A failed check still waits for the next slot instead of retrying every five minutes.');
    }

    public function test_the_panel_saves_the_watcher_settings_and_checks_the_channel_on_demand(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', SermonSettings::TIMEZONE));
        $this->fakeChannel([
            ['id' => self::SUNDAY, 'title' => 'Servicio Dominical 04/10/26 - Semana 41', 'views' => 120, 'clock' => '1:17:43'],
        ], [
            self::SUNDAY => ['start' => '2026-10-04T15:31:00+00:00', 'seconds' => 4663, 'views' => 121],
        ]);
        $super = $this->superadmin();

        $this->actingAs($super)->postJson(self::ADMIN.'/admin/predicas/youtube', ['mode' => 'review', 'every_hours' => '6', 'start_hour' => '8', 'min_minutes' => '30', 'channel_url' => 'not a channel'])
            ->assertStatus(422)
            ->assertJsonPath('error', 'Ese enlace no parece un canal de YouTube. Usa el enlace del canal, por ejemplo https://www.youtube.com/@iglesiacristianazoe6279.');

        $this->actingAs($super)->postJson(self::ADMIN.'/admin/predicas/youtube', ['mode' => 'review', 'every_hours' => '6', 'start_hour' => '8', 'filter' => 'streams', 'min_minutes' => '30', 'api_key' => 'AIzaSecret'])
            ->assertOk()
            ->assertJsonPath('message', 'Listo: los videos nuevos esperarán tu aprobación.');
        $this->assertSame(['mode' => 'review', 'every_hours' => 6, 'start_hour' => 8, 'min_minutes' => 30], array_intersect_key(SermonSettings::current(), array_flip(['mode', 'every_hours', 'start_hour', 'min_minutes'])));
        $this->assertSame('AIzaSecret', SermonSettings::apiKey());

        $this->actingAs($super)->postJson(self::ADMIN.'/admin/predicas/youtube', ['mode' => 'auto', 'forget_api_key' => '1'])->assertOk();
        $this->assertNull(SermonSettings::apiKey());

        $this->actingAs($super)->postJson(self::ADMIN.'/admin/predicas/youtube/buscar')
            ->assertOk()->assertJsonPath('message', 'Revisando el canal de YouTube…');

        $this->assertTrue(Sermon::query()->where('youtube_id', self::SUNDAY)->where('published', true)->exists());
        $this->assertSame('manual', SermonSettings::runs()[0]['trigger']);
        $this->assertFalse(Cache::has('sermons:youtube-queued'));

        $this->actingAs($super)->get(self::ADMIN.'/admin/predicas')->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Admin/Predicas')
            ->has('sermons', 1)
            ->where('sermons.0.source', 'youtube')
            ->where('youtube.mode', 'auto')
            ->where('youtube.has_api_key', false)
            ->where('youtube.running', false)
            ->has('youtube.runs', 1));
    }

    public function test_deleting_a_youtube_sermon_keeps_the_watcher_from_bringing_it_back(): void
    {
        $sermon = Sermon::factory()->fromChannel(self::SUNDAY)->create();

        $this->actingAs($this->superadmin())->postJson(self::ADMIN.'/admin/predicas/eliminar', ['id' => $sermon->id])->assertOk();

        $this->assertModelMissing($sermon);
        $this->assertSame([self::SUNDAY], SermonSettings::ignored());
    }

    public function test_an_admin_without_the_content_permission_cannot_touch_the_watcher(): void
    {
        $treasurer = User::query()->create([
            'name' => 'Tesorera', 'username' => 'tesorera', 'email' => 'tesoreria@iglesiacristianazoe.pe', 'password' => 'secreto1',
            'role' => Role::Admin, 'admin_types' => [], 'permissions' => ['generosity.manage'], 'active' => true,
        ]);

        $this->actingAs($treasurer)->postJson(self::ADMIN.'/admin/predicas/youtube', ['mode' => 'off'])->assertForbidden();
        $this->assertSame('auto', SermonSettings::current()['mode']);
    }

    /**
     * Fakes the "En vivo" tab of the channel and the watch page of each video.
     *
     * @param  list<array{id: string, title: string, views: int, clock: string|null}>  $listed
     * @param  array<string, array{start: string, seconds: int, views: int}>  $watch
     */
    private function fakeChannel(array $listed, array $watch): void
    {
        Http::preventStrayRequests();
        $fakes = [self::CHANNEL => Http::response($this->channelPage($listed))];
        foreach ($listed as $video) {
            $fakes['https://www.youtube.com/watch?v='.$video['id'].'*'] = isset($watch[$video['id']])
                ? Http::response($this->watchPage($video['id'], $video['title'], $watch[$video['id']]))
                : Http::response('', 404);
        }
        Http::fake($fakes);
    }

    private function channelPage(array $videos): string
    {
        $items = array_map(fn (array $video) => ['richItemRenderer' => ['content' => ['lockupViewModel' => [
            'contentId' => $video['id'],
            'contentType' => 'LOCKUP_CONTENT_TYPE_VIDEO',
            'contentImage' => ['thumbnailViewModel' => ['overlays' => $video['clock'] ? [['thumbnailBottomOverlayViewModel' => ['badges' => [['thumbnailBadgeViewModel' => ['text' => $video['clock']]]]]]] : [['thumbnailBadgeViewModel' => ['text' => 'EN VIVO']]]]],
            'metadata' => ['lockupMetadataViewModel' => [
                'title' => ['content' => $video['title']],
                'metadata' => ['contentMetadataViewModel' => ['metadataRows' => [['metadataParts' => [
                    ['text' => ['content' => (string) $video['views']]],
                    ['text' => ['content' => 'Transmitido hace 2 días']],
                ]]]]],
            ]],
        ]]]], $videos);
        $data = ['contents' => ['twoColumnBrowseResultsRenderer' => ['tabs' => [['tabRenderer' => ['content' => ['richGridRenderer' => ['contents' => $items]]]]]]]];

        return '<html><body><script>var ytInitialData = '.json_encode($data).';</script></body></html>';
    }

    private function watchPage(string $id, string $title, array $video): string
    {
        $player = [
            'playabilityStatus' => ['status' => 'OK', 'playableInEmbed' => true],
            'videoDetails' => [
                'videoId' => $id,
                'title' => $title,
                'lengthSeconds' => (string) $video['seconds'],
                'viewCount' => (string) $video['views'],
                'author' => 'Iglesia Cristiana Zoe',
                'isLiveContent' => true,
                'shortDescription' => 'Nos alegra que la palabra de Dios llegue a tu corazón.',
                'thumbnail' => ['thumbnails' => [['url' => "https://i.ytimg.com/vi/{$id}/hqdefault.jpg?sqp=x", 'width' => 480], ['url' => "https://i.ytimg.com/vi/{$id}/maxresdefault.jpg", 'width' => 1280]]],
            ],
            'microformat' => ['playerMicroformatRenderer' => [
                'publishDate' => $video['start'],
                'liveBroadcastDetails' => ['isLiveNow' => false, 'startTimestamp' => $video['start']],
            ]],
        ];

        return '<html><script>var ytInitialPlayerResponse = '.json_encode($player).';var meta = 1;</script></html>';
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
