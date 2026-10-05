<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Catalog\Artists;
use App\Domain\Radio\Catalog\Genres;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\Text;
use App\Models\RadioArtist;
use App\Models\RadioGenre;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** The music catalog of the radio: the genres (musical styles) and the artists that classify each song. */
class RadioCatalogController extends RadioController
{
    public function index(): Response
    {
        $songs = RadioTrack::query()->where('kind', 'musica')->get(['id', 'artist', 'featured']);
        $songsBy = [];
        foreach ($songs as $song) {
            foreach (array_unique(array_map(fn ($name) => Text::key($name), array_filter([$song->artist, ...($song->featured ?? [])]))) as $key) {
                $songsBy[$key] = ($songsBy[$key] ?? 0) + 1;
            }
        }

        return Inertia::render('Admin/Radio/Catalogo', [
            'genres' => RadioGenre::query()->withCount(['tracks', 'artists'])->orderBy('sort_order')->orderBy('name')->get()->map(fn (RadioGenre $genre) => [
                ...$genre->brief(),
                'aliases' => $genre->aliases ?? [],
                'custom' => $genre->custom,
                'songs' => $genre->tracks_count,
                'artists' => $genre->artists_count,
            ]),
            'artists' => RadioArtist::query()->with('genres')->orderBy('name')->get()->map(fn (RadioArtist $artist) => [
                'id' => $artist->id,
                'name' => $artist->name,
                'aliases' => $artist->aliases ?? [],
                'kind' => $artist->kind,
                'country' => $artist->country,
                'convert' => $artist->convert,
                'source' => $artist->source,
                'genres' => $artist->genres->pluck('id')->values(),
                'songs' => collect([$artist->name, ...($artist->aliases ?? [])])->map(fn ($name) => $songsBy[Text::key($name)] ?? 0)->max(),
            ]),
            'families' => Genres::FAMILIES,
            'kinds' => Artists::KINDS,
            'sources' => RadioArtist::SOURCES,
            'maxGenres' => RadioTrack::MAX_GENRES,
        ]);
    }

    public function saveGenre(Request $request): JsonResponse
    {
        $genre = $this->find(RadioGenre::class, $request->input('id'));
        if ($request->filled('id') && ! $genre) {
            return $this->fail('Ese género ya no existe. Recarga la página.', 404);
        }
        $request->merge(['name' => trim(preg_replace('/\s+/u', ' ', (string) $request->input('name')) ?? '')]);
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:60',
            'family' => ['required', Rule::in(array_keys(Genres::FAMILIES))],
            'aliases' => 'nullable|string|max:1000',
        ], [
            'name.required' => 'Escribe el nombre del género.',
            'name.min' => 'Escribe el nombre del género.',
            'name.max' => 'El nombre del género es demasiado largo.',
            'family.*' => 'Elige la familia del género.',
            'aliases.max' => 'Son demasiados nombres alternativos.',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $validator->validated();
        $aliases = self::names($data['aliases'] ?? '');
        foreach ([$data['name'], ...$aliases] as $name) {
            $same = MusicCatalog::genre($name);
            if ($same && $same->id !== $genre?->id && in_array(Text::key($name), array_map(fn ($known) => Text::key($known), [$same->name, $same->slug, ...($same->aliases ?? [])]), true)) {
                return $this->fail(Text::key($same->name) === Text::key($name) ? "Ya existe el género «{$same->name}»." : "«{$name}» ya es otro nombre de «{$same->name}».");
            }
        }
        $values = ['name' => Str::ucfirst($data['name']), 'family' => $data['family'], 'aliases' => $aliases ?: null];
        if ($genre) {
            $genre->update($values);
        } else {
            RadioGenre::query()->create([
                ...$values,
                'slug' => MusicCatalog::genreSlug($data['name']),
                'sort_order' => (int) RadioGenre::query()->max('sort_order') + 10,
                'custom' => true,
            ]);
        }
        MusicCatalog::forget();

        return $this->saved($genre ? 'Género actualizado.' : 'Género agregado. Ya puedes elegirlo en las canciones.');
    }

    public function destroyGenre(Request $request): JsonResponse
    {
        $genre = $this->find(RadioGenre::class, $request->input('id'));
        if ($genre) {
            $songs = $genre->tracks()->count();
            $genre->delete();
            MusicCatalog::forget();

            return $this->saved($songs ? "Género eliminado y quitado de {$songs} ".($songs === 1 ? 'canción' : 'canciones').'.' : 'Género eliminado.');
        }

        return $this->saved('Género eliminado.');
    }

    public function saveArtist(Request $request): JsonResponse
    {
        $artist = $this->find(RadioArtist::class, $request->input('id'));
        if ($request->filled('id') && ! $artist) {
            return $this->fail('Ese artista ya no existe. Recarga la página.', 404);
        }
        $request->merge([
            'name' => trim(preg_replace('/\s+/u', ' ', (string) $request->input('name')) ?? ''),
            'country' => Str::upper(trim((string) $request->input('country'))) ?: null,
            'kind' => $request->input('kind') ?: null,
        ]);
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:1|max:120',
            'aliases' => 'nullable|string|max:1000',
            'kind' => ['nullable', Rule::in(array_keys(Artists::KINDS))],
            'country' => 'nullable|string|size:2|alpha',
            'genre_ids' => 'array|max:'.RadioTrack::MAX_GENRES,
            'genre_ids.*' => 'string|distinct|exists:radio_genres,id',
        ], [
            'name.required' => 'Escribe el nombre del artista o de la agrupación.',
            'name.max' => 'El nombre es demasiado largo.',
            'kind.in' => 'Elige si es solista o agrupación.',
            'country.*' => 'El país va con su código de 2 letras (por ejemplo PE, MX, US).',
            'genre_ids.max' => 'Un artista tiene hasta '.RadioTrack::MAX_GENRES.' géneros.',
            'genre_ids.*.exists' => 'Uno de los géneros ya no existe. Recarga la página.',
            'genre_ids.*.distinct' => 'Elegiste dos veces el mismo género.',
            'aliases.max' => 'Son demasiados nombres alternativos.',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $validator->validated();
        $aliases = self::names($data['aliases'] ?? '');
        foreach ([$data['name'], ...$aliases] as $name) {
            $other = MusicCatalog::artist($name);
            if ($other && $other->id !== $artist?->id) {
                return $this->fail("«{$name}» ya es un nombre de {$other->name}.");
            }
        }
        $values = [
            'name' => $data['name'],
            'aliases' => $aliases ?: null,
            'kind' => $data['kind'] ?? null,
            'country' => $data['country'] ?? null,
            'convert' => $request->boolean('convert'),
        ];
        if ($artist) {
            $artist->update($values);
        } else {
            $artist = RadioArtist::query()->create([...$values, 'slug' => MusicCatalog::artistSlug($data['name']), 'source' => 'manual']);
        }
        MusicCatalog::attachGenres($artist, RadioGenre::query()->whereIn('id', $data['genre_ids'] ?? [])->get()
            ->sortBy(fn (RadioGenre $genre) => array_search($genre->id, $data['genre_ids'] ?? [], true))->values());
        MusicCatalog::forget();

        return $this->saved($request->filled('id') ? 'Artista actualizado.' : 'Artista agregado. Sus canciones se clasificarán con sus géneros.');
    }

    public function destroyArtist(Request $request): JsonResponse
    {
        $this->find(RadioArtist::class, $request->input('id'))?->delete();
        MusicCatalog::forget();

        return $this->saved('Artista eliminado del catálogo. Sus canciones siguen en la biblioteca.');
    }

    /** @return list<string> */
    private static function names(string $text): array
    {
        return array_values(array_filter(Text::unique(array_map(fn ($name) => Str::limit(trim($name), 120, ''), preg_split('/[,\n;]+/u', $text) ?: [])), fn ($name) => $name !== ''));
    }
}
