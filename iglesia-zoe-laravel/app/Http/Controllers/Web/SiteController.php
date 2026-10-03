<?php

namespace App\Http\Controllers\Web;

use App\Domain\Radio\Station;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\ResolveSiteSkin;
use App\Http\Controllers\Controller;
use App\Models\BaptismEvent;
use App\Models\ChurchEvent;
use App\Models\Devotional;
use App\Models\Sermon;
use App\Models\ServiceGallery;
use App\Models\Teaching;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SiteController extends Controller
{
    public function home(Request $request): Response
    {
        return $this->homePage($request);
    }

    public function marea(Request $request): Response
    {
        return $this->homePage($request, true);
    }

    public function about(Request $request): Response
    {
        return $this->page('About', $request);
    }

    public function ministries(Request $request): Response
    {
        return $this->page('Ministries', $request);
    }

    public function ministry(Request $request, string $slug): Response
    {
        $ministry = collect(LoadPublicSite::ministries())->firstWhere('slug', $slug);
        abort_unless($ministry, 404);

        return Inertia::render('Ministry', [
            ...$this->shared($request),
            'ministry' => $ministry,
        ]);
    }

    public function visit(Request $request): Response
    {
        return $this->page('Visit', $request);
    }

    public function baptisms(Request $request): Response
    {
        $today = now('America/Lima')->toDateString();
        $events = BaptismEvent::query()->where('active', true)
            ->where(fn ($query) => $query->whereNull('event_date')->orWhereDate('event_date', '>=', $today))
            ->orderBy('event_date')->get()
            ->map(fn ($event) => [
                'id' => $event->id,
                'event_date' => optional($event->event_date)->toDateString(),
                'location' => $event->location,
            ]);

        return Inertia::render('Baptisms', [
            ...$this->shared($request),
            'events' => $events,
        ]);
    }

    public function sermons(Request $request): Response
    {
        return Inertia::render('Sermons', [
            ...$this->shared($request),
            'sermons' => $this->publishedSermons(),
        ]);
    }

    public function teachings(Request $request): Response
    {
        return Inertia::render('Teachings', [
            ...$this->shared($request),
            'teachings' => Teaching::query()->where('active', true)->orderByDesc('teaching_date')->limit(120)->get()->map->card(),
        ]);
    }

    public function galleries(Request $request): Response
    {
        return Inertia::render('Galleries', [
            ...$this->shared($request),
            'galleries' => $this->withPhotos(ServiceGallery::published()->limit(160)->get())->map->card()->all(),
        ]);
    }

    public function gallery(Request $request, string $slug): Response
    {
        $gallery = ServiceGallery::query()->where('active', true)->where('slug', $slug)->first();
        abort_unless($gallery && $gallery->photoList() !== [], 404);

        return Inertia::render('Gallery', [
            ...$this->shared($request),
            'gallery' => $gallery->full(),
            'others' => $this->withPhotos(ServiceGallery::published()->whereKeyNot($gallery->id)->limit(12)->get())->take(4)->map->card()->all(),
        ]);
    }

    public function devotionals(Request $request): Response
    {
        return Inertia::render('Devotionals', [
            ...$this->shared($request),
            'devotionals' => Devotional::published()->limit(160)->get()->map->card(),
        ]);
    }

    public function devotional(Request $request, string $slug): Response
    {
        $devotional = Devotional::published()->where('slug', $slug)->first();
        abort_unless($devotional, 404);

        return Inertia::render('Devotional', [
            ...$this->shared($request),
            'devotional' => $devotional->full(),
            'more' => Devotional::published()->whereKeyNot($devotional->id)->limit(3)->get()->map->card(),
        ]);
    }

    public function events(Request $request): Response
    {
        return Inertia::render('Events', [
            ...$this->shared($request),
            'events' => ChurchEvent::upcoming()->limit(24)->get()->map->card(),
        ]);
    }

    public function serve(Request $request): Response
    {
        return $this->page('Serve', $request);
    }

    public function serveArea(Request $request, string $slug): Response
    {
        $area = collect(LoadPublicSite::serveAreas())->firstWhere('slug', $slug);
        abort_unless($area, 404);

        return Inertia::render('ServeArea', [
            ...$this->shared($request),
            'area' => $area,
        ]);
    }

    public function give(Request $request): Response
    {
        return $this->page('Give', $request);
    }

    public function contact(Request $request): Response
    {
        return $this->page('Contact', $request);
    }

    private function page(string $component, Request $request): Response
    {
        return Inertia::render($component, $this->shared($request));
    }

    private function homePage(Request $request, bool $forceMarea = false): Response
    {
        return Inertia::render('Home', [
            ...$this->shared($request, $forceMarea),
            'sermons' => $this->publishedSermons(3),
            'events' => ChurchEvent::upcoming()->limit(6)->get()->map->card(),
            'radio' => Station::state(),
        ]);
    }

    /**
     * @param  Collection<int, ServiceGallery>  $galleries
     * @return Collection<int, ServiceGallery>
     */
    private function withPhotos(Collection $galleries): Collection
    {
        return $galleries->filter(fn (ServiceGallery $gallery) => $gallery->photoList() !== [])->values();
    }

    private function publishedSermons(?int $limit = null): array
    {
        return Sermon::query()->where('published', true)->orderByDesc('sermon_date')
            ->when($limit, fn ($query) => $query->limit($limit))
            ->get()
            ->map(fn ($sermon) => [
                'id' => $sermon->id,
                'title' => $sermon->title,
                'preacher' => $sermon->preacher,
                'series' => $sermon->series,
                'sermon_date' => optional($sermon->sermon_date)->toDateString(),
                'youtube_id' => $sermon->youtube_id,
                'is_live' => $sermon->is_live,
            ])->all();
    }

    private function shared(Request $request, bool $forceMarea = false): array
    {
        return [
            'settings' => LoadPublicSite::settings(),
            'ministries' => LoadPublicSite::ministries(),
            'serveAreas' => LoadPublicSite::serveAreas(),
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'skin' => ResolveSiteSkin::fromRequest($request, $forceMarea),
        ];
    }
}
