<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Site\Sermons\SermonSettings;
use App\Domain\Site\Sermons\SermonSync;
use App\Domain\Site\Support\YouTube;
use App\Http\Controllers\Controller;
use App\Models\Sermon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/** Sermons of the site: the ones the channel watcher brings from YouTube and the ones added by hand. */
class SermonsController extends Controller
{
    private const HISTORY_PAGES = 4;

    public function predicas(): Response
    {
        return Inertia::render('Admin/Predicas', [
            'sermons' => Sermon::query()->orderByDesc('pending')->orderByDesc('sermon_date')->orderByDesc('aired_at')->orderByDesc('created_at')
                ->get()->map->adminPayload(),
            'youtube' => SermonSettings::panel(),
        ]);
    }

    public function saveSermon(Request $request): JsonResponse
    {
        $payload = $request->only(['title', 'preacher', 'series', 'sermon_date']);
        $payload['title'] = trim((string) ($payload['title'] ?? ''));
        $payload['published'] = $request->boolean('published');
        if ($payload['title'] === '') {
            return $this->fail('El título es obligatorio.');
        }
        $video = trim((string) $request->input('youtube_id'));
        $payload['youtube_id'] = YouTube::id($video);
        if ($video !== '' && ! $payload['youtube_id']) {
            return $this->fail('No reconocemos ese enlace de YouTube. Pega el enlace del video (youtube.com o youtu.be) o su ID.');
        }

        $sermon = $request->filled('id') ? $this->find(Sermon::class, $request->input('id')) : new Sermon(['source' => 'manual']);
        if (! $sermon) {
            return $this->fail('Esa prédica ya no existe.', 404);
        }
        if ($sermon->youtube_id !== $payload['youtube_id']) {
            $payload['synced_at'] = null;
        }
        if ($request->boolean('restore_title') && $sermon->youtube_title) {
            $payload['title'] = $sermon->youtube_title;
        }
        $payload['title_locked'] = $sermon->youtube_title !== null && $payload['title'] !== $sermon->youtube_title;
        if ($payload['published']) {
            $payload['pending'] = false;
        }
        $sermon->fill($payload)->save();
        $this->forgetHome();

        return $this->saved($sermon->wasRecentlyCreated ? 'Prédica agregada.' : 'Cambios guardados.');
    }

    /** Removing a sermon that is on YouTube also tells the watcher not to bring it back. */
    public function deleteSermon(Request $request): JsonResponse
    {
        $sermon = $this->find(Sermon::class, $request->input('id'));
        if ($sermon) {
            if ($sermon->youtube_id) {
                SermonSettings::ignore($sermon->youtube_id);
            }
            $sermon->delete();
            $this->forgetHome();
        }

        return $this->saved('Prédica eliminada.');
    }

    /** Approves or discards the videos the watcher found while in review mode. */
    public function review(Request $request): JsonResponse
    {
        $action = $request->input('action');
        if (! in_array($action, ['approve', 'discard'], true)) {
            return $this->fail('Elige si quieres publicar o descartar.');
        }
        $query = Sermon::query()->where('pending', true);
        if (! $request->boolean('all')) {
            $query->whereIn('id', $this->uuids($request->input('ids')));
        }
        $sermons = $query->get();
        if ($sermons->isEmpty()) {
            return $this->fail('No hay videos por revisar con esa selección.');
        }

        foreach ($sermons as $sermon) {
            if ($action === 'approve') {
                $sermon->update(['pending' => false, 'published' => true]);

                continue;
            }
            if ($sermon->youtube_id) {
                SermonSettings::ignore($sermon->youtube_id);
            }
            $sermon->delete();
        }
        $this->forgetHome();
        $count = $sermons->count();

        return $this->saved($action === 'approve'
            ? ($count === 1 ? 'Video publicado en la página.' : "{$count} videos publicados en la página.")
            : ($count === 1 ? 'Video descartado: no volverá a aparecer.' : "{$count} videos descartados: no volverán a aparecer."));
    }

    public function saveYoutube(Request $request): JsonResponse
    {
        $channel = trim((string) $request->input('channel_url'));
        if ($channel !== '' && SermonSettings::normalizeChannel($channel) === null) {
            return $this->fail('Ese enlace no parece un canal de YouTube. Usa el enlace del canal, por ejemplo https://www.youtube.com/@iglesiacristianazoe6279.');
        }
        if ($request->boolean('clear_ignored')) {
            SermonSettings::clearIgnored();
        }
        $settings = SermonSettings::save($request->all());

        return $this->saved(match ($settings['mode']) {
            'auto' => 'Listo: los videos nuevos del canal se publicarán solos.',
            'review' => 'Listo: los videos nuevos esperarán tu aprobación.',
            default => 'Búsqueda automática apagada. Puedes buscar a mano cuando quieras.',
        });
    }

    /** Looks at the channel now; "history" reads further back and leaves what it finds for review. */
    public function syncYoutube(Request $request): JsonResponse
    {
        if (SermonSync::queued()) {
            return $this->fail('Ya estamos revisando el canal. Espera a que termine.');
        }
        if (SermonSettings::channelUrl() === '') {
            return $this->fail('Primero indica el canal de YouTube.');
        }
        $history = $request->boolean('history');
        SermonSync::inBackground($history ? 'history' : 'manual', $history ? self::HISTORY_PAGES : 1);

        return $this->saved($history
            ? 'Buscando videos anteriores del canal… quedarán por revisar.'
            : 'Revisando el canal de YouTube…');
    }

    private function forgetHome(): void
    {
        Cache::forget(SermonSync::HOME_CACHE);
    }
}
