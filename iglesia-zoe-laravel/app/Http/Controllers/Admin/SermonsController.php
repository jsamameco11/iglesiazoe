<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Site\Support\YouTube;
use App\Http\Controllers\Controller;
use App\Models\Sermon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Sermons and the live service on YouTube. */
class SermonsController extends Controller
{
    public function predicas(): Response
    {
        return Inertia::render('Admin/Predicas', [
            'sermons' => Sermon::query()->orderByDesc('sermon_date')->get()->map(fn ($sermon) => [
                ...$sermon->toArray(),
                'sermon_date' => optional($sermon->sermon_date)->toDateString(),
            ]),
        ]);
    }

    public function saveSermon(Request $request): JsonResponse
    {
        $payload = $request->only(['title', 'preacher', 'series', 'sermon_date']);
        $payload['is_live'] = $request->boolean('is_live');
        $payload['published'] = $request->boolean('published');
        if (! $payload['title']) {
            return $this->fail('El título es obligatorio.');
        }
        $video = trim((string) $request->input('youtube_id'));
        $payload['youtube_id'] = YouTube::id($video);
        if ($video !== '' && ! $payload['youtube_id']) {
            return $this->fail('No reconocemos ese enlace de YouTube. Pega el enlace del video (youtube.com o youtu.be) o su ID.');
        }
        $id = $request->input('id');
        if ($payload['is_live']) {
            Sermon::query()->when($id, fn ($query) => $query->where('id', '!=', $id))->update(['is_live' => false]);
        }
        $id ? Sermon::query()->where('id', $id)->update($payload) : Sermon::query()->create($payload);

        return $this->saved();
    }

    public function deleteSermon(Request $request): JsonResponse
    {
        Sermon::query()->where('id', $request->input('id'))->delete();

        return $this->saved();
    }
}
