<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Permissions;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Actions\SaveEpisode;
use App\Domain\Radio\AudioRejected;
use App\Domain\Radio\Catalog\Genres;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\CoverDownload;
use App\Domain\Radio\Identify\Identifier;
use App\Domain\Radio\Identify\SongQuery;
use App\Domain\Radio\Identify\Text;
use App\Domain\Radio\RadioAudio;
use App\Domain\Radio\Station;
use App\Models\RadioGenre;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** The audio library. Uploading only stores the audio: it sounds once it is scheduled or fired from the console. */
class RadioLibraryController extends RadioController
{
    private const COVER_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

    private const MAX_COVER_MB = 8;

    public function index(): Response
    {
        $upcoming = RadioSlot::query()->where('starts_at', '>=', now())->whereNotNull('radio_track_id')
            ->selectRaw('radio_track_id, count(*) as total')->groupBy('radio_track_id')->pluck('total', 'radio_track_id');

        return Inertia::render('Admin/Radio/Biblioteca', [
            'tracks' => RadioTrack::query()->with('genres')->withCount('episodes')->orderBy('kind')->orderBy('title')->get()->map(fn (RadioTrack $track) => [
                ...$track->payload(),
                'upcoming' => (int) ($upcoming[$track->id] ?? 0),
                'episodes' => $track->episodes_count,
            ]),
            'kinds' => RadioTrack::KINDS,
            'genres' => self::genreList(),
            'families' => Genres::FAMILIES,
            'maxGenres' => RadioTrack::MAX_GENRES,
            'maxFeatured' => RadioTrack::MAX_FEATURED,
            'maxMb' => RadioAudio::maxMb(),
            'maxDescription' => SaveEpisode::MAX_DESCRIPTION,
        ]);
    }

    public function save(Request $request, SaveEpisode $episodes): JsonResponse
    {
        $existing = $this->find(RadioTrack::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }

        $request->merge([
            'title' => trim((string) $request->input('title')),
            'artist' => trim((string) $request->input('artist')),
            'featured' => collect((array) $request->input('featured', []))->map(fn ($name) => trim((string) $name))->filter()->unique()->values()->all(),
        ]);
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:160',
            'artist' => ['nullable', 'string', 'max:120', Rule::requiredIf($request->input('kind') === 'musica')],
            'featured' => 'array|max:'.RadioTrack::MAX_FEATURED,
            'featured.*' => 'string|max:120',
            'album' => 'nullable|string|max:160',
            'genre_ids' => 'array|max:'.RadioTrack::MAX_GENRES,
            'genre_ids.*' => 'string|distinct|exists:radio_genres,id',
            'cover_url' => 'nullable|string|max:600',
            'identity' => 'nullable|string|max:4000',
            'year' => 'nullable|integer|min:1900|max:'.(now()->year + 1),
            'kind' => ['required', Rule::in(array_keys(RadioTrack::KINDS))],
            'duration' => [$existing ? 'nullable' : 'required', 'numeric', 'min:0.5', 'max:'.Station::MAX_BLOCK],
        ], [
            'required' => 'Completa el campo :attribute.',
            'title.required' => 'Escribe el nombre de la canción o del audio.',
            'artist.required' => 'Escribe el autor de la canción.',
            'featured.max' => 'Una canción tiene hasta '.RadioTrack::MAX_FEATURED.' coautores.',
            'genre_ids.max' => 'Una canción tiene hasta '.RadioTrack::MAX_GENRES.' géneros.',
            'genre_ids.*.exists' => 'Uno de los géneros ya no existe. Recarga la página.',
            'genre_ids.*.distinct' => 'Elegiste dos veces el mismo género.',
            'year.integer' => 'Escribe el año con 4 cifras (por ejemplo 2024).',
            'year.min' => 'Revisa el año de la canción.',
            'year.max' => 'Revisa el año de la canción.',
            'duration.required' => 'No pudimos leer la duración del audio. Prueba con otro archivo.',
            'duration.max' => 'El audio dura más de 6 horas. Divídelo en partes.',
            'in' => 'Elige un tipo válido.',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'El campo :attribute es demasiado largo.',
        ], ['title' => 'nombre', 'artist' => 'autor', 'featured.*' => 'coautor', 'album' => 'álbum', 'genre_ids' => 'géneros', 'cover_url' => 'carátula', 'identity' => 'identificación', 'year' => 'año', 'kind' => 'tipo', 'duration' => 'duración']);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $validator->validated();
        $isSong = $data['kind'] === 'musica';

        $cover = $isSong ? $request->file('cover') : null;
        $coverExtension = null;
        if ($cover !== null) {
            $coverExtension = $cover instanceof UploadedFile && $cover->isValid() && $cover->getSize() <= self::MAX_COVER_MB * 1024 * 1024
                ? MediaLibrary::extension($cover, self::COVER_TYPES)
                : null;
            if ($coverExtension === null) {
                return $this->fail('La carátula debe ser una imagen JPG, PNG o WEBP de hasta '.self::MAX_COVER_MB.' MB.');
            }
        }

        $hasAudio = RadioAudio::sent($request);
        if (! $existing && ! $hasAudio) {
            return $this->fail('Elige el archivo de audio.');
        }
        if ($hasAudio && ! isset($data['duration'])) {
            return $this->fail('No pudimos leer la duración del audio. Prueba con otro archivo.');
        }
        $episode = ! $existing && $request->boolean('episode') && Permissions::has($request->user(), 'radio.episodes')
            ? $episodes->validate([
                'title' => $data['title'],
                'program' => $data['artist'] ?? null,
                'description' => $request->input('episode_description'),
                'aired_on' => Station::today(),
            ], $request->file('episode_cover'))
            : null;

        $payload = [
            'title' => $data['title'],
            'artist' => ($data['artist'] ?? '') ?: null,
            'featured' => $isSong && $data['featured'] ? $data['featured'] : null,
            'album' => $isSong ? (trim((string) ($data['album'] ?? '')) ?: null) : null,
            'year' => $isSong ? ($data['year'] ?? null) : null,
            'kind' => $data['kind'],
            'duck' => $request->has('duck') ? $request->boolean('duck') : ($existing->duck ?? in_array($data['kind'], RadioTrack::DUCK_BY_DEFAULT, true)),
            'active' => $existing ? $request->boolean('active', true) : true,
        ];
        if (! $existing || $data['kind'] !== 'musica') {
            $payload['rotation'] = false;
        }

        if ($hasAudio) {
            try {
                $payload['file_path'] = RadioAudio::receive($request, $data['kind']);
            } catch (AudioRejected $rejected) {
                return $rejected->response();
            }
            $payload['duration'] = round((float) $data['duration'], 2);
            MediaLibrary::deletePublic($existing?->file_path);
        }

        $identity = $isSong ? self::identity($data['identity'] ?? null) : null;
        if ($identity) {
            $payload['identity'] = $identity;
            $payload['identified_at'] = now();
        }

        $found = $isSong && ! $cover && ! $request->boolean('remove_cover') && (! $existing?->cover_path || $request->filled('cover_url'))
            ? CoverDownload::store($data['cover_url'] ?? null)
            : null;
        if ($cover instanceof UploadedFile || $found) {
            $payload['cover_path'] = $found ?? MediaLibrary::storePublic($cover, 'radio/caratulas', $coverExtension);
            MediaLibrary::deletePublic($existing?->cover_path);
        } elseif ($existing?->cover_path && (! $isSong || $request->boolean('remove_cover'))) {
            MediaLibrary::deletePublic($existing->cover_path);
            $payload['cover_path'] = null;
        }

        if ($existing) {
            $track = $existing;
            $existing->update($payload);
            if (isset($payload['duration'])) {
                $existing->slots()->where('starts_at', '>=', now())->update(['duration' => $payload['duration']]);
            }
            $existing->slots()->where('starts_at', '>=', now())->update(['title' => $payload['title'], 'kind' => $payload['kind']]);
        } else {
            $track = RadioTrack::query()->create($payload);
            if ($episode) {
                $episodes->handle($episode, $track, true, $request->file('episode_cover'));
            }
        }
        if ($isSong) {
            $track->genres()->sync(collect($data['genre_ids'] ?? [])->values()->mapWithKeys(fn (string $id, int $position) => [$id => ['position' => $position]])->all());
            MusicCatalog::learn($track, $identity['artist'] ?? []);
        } else {
            $track->genres()->detach();
        }
        Station::flush();

        return $this->saved(match (true) {
            (bool) $existing => 'Audio actualizado.',
            (bool) $episode => 'Audio guardado en la biblioteca y publicado como episodio en la página de la radio.',
            default => 'Audio guardado en la biblioteca. No suena hasta que lo programes o lo lances desde la consola.',
        });
    }

    /**
     * Identifies a song on the internet before it is uploaded (or one already in the library):
     * author and co-authors, album, year, cover and genres, ready to fill the form.
     */
    public function identify(Request $request, Identifier $identifier): JsonResponse
    {
        $track = $this->find(RadioTrack::class, $request->input('id'));
        if ($request->filled('id') && ! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        $title = trim((string) ($request->filled('title') ? $request->input('title') : $track?->title));
        $artist = trim((string) ($request->filled('artist') ? $request->input('artist') : $track?->artist));
        if (mb_strlen($title) < 2 || mb_strlen($title) > 160 || mb_strlen($artist) > 120) {
            return $this->fail('Escribe el nombre de la canción para buscarla.');
        }
        $featured = collect($request->has('featured') || ! $track ? (array) $request->input('featured', []) : ($track->featured ?? []))
            ->map(fn ($name) => mb_substr(trim((string) $name), 0, 120))->filter()->take(RadioTrack::MAX_FEATURED)->values()->all();
        $duration = $track->duration ?? (is_numeric($request->input('duration')) ? (float) $request->input('duration') : null);

        set_time_limit(90);
        $names = Text::splitNames($artist, MusicCatalog::joinedNames());
        $result = $identifier->identify(new SongQuery(
            $title,
            $names[0] ?? '',
            Text::unique([...array_slice($names, 1), ...$featured]),
            $duration && $duration > 0 ? $duration : null,
        ));
        $tagged = MusicCatalog::genre(mb_substr(trim((string) $request->input('genre')), 0, 60));
        if ($result['genres'] === [] && $tagged) {
            $result['genres'] = [$tagged->brief()];
        }

        return response()->json(['ok' => true, 'result' => $result]);
    }

    /** Puts a song in the continuous music, where it repeats in the gaps of the program, or takes it out. */
    public function rotation(Request $request): JsonResponse
    {
        $track = $this->find(RadioTrack::class, $request->input('id'));
        if (! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        if ($track->kind !== 'musica') {
            return $this->fail('Solo las canciones van en la música continua.');
        }
        $on = $request->boolean('on');
        if ($on && ! $track->active) {
            return $this->fail('Activa el audio antes de ponerlo en la música continua.');
        }
        $track->update(['rotation' => $on]);
        Station::flush();

        return $this->saved($on
            ? "«{$track->title}» se repetirá en la música continua."
            : "«{$track->title}» ya no se repetirá en la música continua.");
    }

    public function destroy(Request $request): JsonResponse
    {
        $track = $this->find(RadioTrack::class, $request->input('id'));
        if ($track) {
            MediaLibrary::deletePublic($track->file_path);
            MediaLibrary::deletePublic($track->cover_path);
            $track->delete();
            Station::flush();
        }

        return $this->saved('Audio eliminado de la biblioteca y de la programación.');
    }

    /**
     * Genres to choose from, by family and in catalog order.
     *
     * @return list<array{id: string, name: string, family: string}>
     */
    private static function genreList(): array
    {
        $families = array_flip(array_keys(Genres::FAMILIES));

        return RadioGenre::query()->orderBy('sort_order')->orderBy('name')->get()
            ->sortBy(fn (RadioGenre $genre) => $families[$genre->family] ?? count($families), SORT_REGULAR)
            ->map(fn (RadioGenre $genre) => $genre->brief())->values()->all();
    }

    /**
     * What the internet said of a song when it was identified, as sent back by the form: only known fields.
     *
     * @return array{confidence?: string, score?: float, sources?: list<string>, ids?: array<string, string>, artist?: array<string, ?string>}|null
     */
    private static function identity(?string $json): ?array
    {
        $data = json_decode((string) $json, true);
        if (! is_array($data)) {
            return null;
        }
        $identity = array_filter([
            'confidence' => in_array($data['confidence'] ?? null, ['alta', 'media', 'baja'], true) ? $data['confidence'] : null,
            'score' => is_numeric($data['score'] ?? null) ? round((float) $data['score'], 3) : null,
            'sources' => array_values(array_intersect((array) ($data['sources'] ?? []), ['itunes', 'deezer', 'musicbrainz', 'wikidata', 'catalogo'])),
            'ids' => collect((array) ($data['ids'] ?? []))->only(['musicbrainz', 'deezer', 'itunes', 'isrc'])
                ->filter(fn ($id) => is_scalar($id) && preg_match('/^[A-Za-z0-9\-]{1,64}$/', (string) $id))->map(fn ($id) => (string) $id)->all(),
            'artist' => collect((array) ($data['artist'] ?? []))->only(['kind', 'country', 'musicbrainz_id'])
                ->filter(fn ($value) => is_string($value) && strlen($value) <= 64)->all(),
        ]);

        return $identity ?: null;
    }
}
