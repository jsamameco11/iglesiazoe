<?php

namespace App\Console\Commands;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\CoverDownload;
use App\Domain\Radio\Identify\Identifier;
use App\Domain\Radio\Identify\SongQuery;
use App\Domain\Radio\Identify\Text;
use App\Domain\Radio\Station;
use App\Models\RadioTrack;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/** Identifies the songs already in the library, one by one, and completes what they are missing. */
class RadioIdentify extends Command
{
    protected $signature = 'radio:identify
        {--track= : Identifica solo esta canción (su id)}
        {--missing : Solo las canciones que nunca se identificaron}
        {--force : Reemplaza coautores, álbum, año, géneros y carátula aunque ya los tengan}
        {--dry : Muestra lo que encontraría sin guardar nada}
        {--limit=0 : Cuántas canciones como máximo}';

    protected $description = 'Identifica en internet las canciones de la biblioteca de la radio: autor, coautores, álbum, año, géneros y carátula';

    public function handle(Identifier $identifier): int
    {
        $tracks = RadioTrack::query()->with('genres')->where('kind', 'musica')
            ->when($this->option('track'), fn ($query, $id) => $query->whereKey($id))
            ->when($this->option('missing'), fn ($query) => $query->whereNull('identified_at'))
            ->orderBy('title')
            ->when((int) $this->option('limit') > 0, fn ($query) => $query->limit((int) $this->option('limit')))
            ->get();
        if ($tracks->isEmpty()) {
            $this->info('No hay canciones para identificar.');

            return self::SUCCESS;
        }

        $force = (bool) $this->option('force');
        $dry = (bool) $this->option('dry');
        $rows = [];
        $changed = 0;
        $this->withProgressBar($tracks, function (RadioTrack $track) use ($identifier, $force, $dry, &$rows, &$changed) {
            $names = Text::splitNames(Text::cleanArtist((string) $track->artist), MusicCatalog::joinedNames());
            $result = $identifier->identify(new SongQuery(
                $track->title,
                $names[0] ?? '',
                Text::unique([...array_slice($names, 1), ...($track->featured ?? [])]),
                $track->duration ?: null,
            ));
            $rows[] = [
                Str::limit($track->title, 34),
                Str::limit((string) ($result['artist'] ?? $track->artist), 24),
                Str::limit((string) ($result['album'] ?? '—'), 30),
                $result['year'] ?? '—',
                collect($result['genres'])->pluck('name')->implode(', ') ?: '—',
                $result['found'] ? $result['confidence'] : 'no encontrada',
            ];
            if ($dry) {
                return;
            }
            $changed += (int) $this->apply($track, $result, $force);
        });
        $this->newLine(2);
        $this->table(['Canción', 'Autor', 'Álbum', 'Año', 'Géneros', 'Confianza'], $rows);
        if (! $dry) {
            Station::flush();
            $this->info("{$changed} de {$tracks->count()} canciones completadas.");
        }

        return self::SUCCESS;
    }

    /** Completes a song with what was found; without --force only what it is missing. */
    private function apply(RadioTrack $track, array $result, bool $force): bool
    {
        $values = ['identified_at' => now(), 'identity' => [...$result['identity'], 'artist' => array_filter([
            'kind' => $result['artist_info']['kind'] ?? null,
            'country' => $result['artist_info']['country'] ?? null,
            'musicbrainz_id' => $result['artist_info']['musicbrainz_id'] ?? null,
        ])]];
        $changed = false;
        if ($result['artist'] && Text::key($result['artist']) === Text::key(Text::cleanArtist((string) $track->artist)) && $result['artist'] !== $track->artist) {
            $values['artist'] = $result['artist'];
            $changed = true;
        }
        if ($result['featured'] && ($force || ! $track->featured)) {
            $values['featured'] = array_slice($result['featured'], 0, RadioTrack::MAX_FEATURED);
            $changed = true;
        }
        if ($result['album'] && ($force || ! $track->album)) {
            $values['album'] = $result['album'];
            $changed = true;
        }
        if ($result['year'] && ($force || ! $track->year)) {
            $values['year'] = $result['year'];
            $changed = true;
        }
        if ($result['cover_url'] && ($force || ! $track->cover_path) && ($cover = CoverDownload::store($result['cover_url']))) {
            MediaLibrary::deletePublic($track->cover_path);
            $values['cover_path'] = $cover;
            $changed = true;
        }
        $track->update($values);
        if ($result['genres'] && ($force || $track->genres->isEmpty())) {
            $track->genres()->sync(collect($result['genres'])->values()->mapWithKeys(fn (array $genre, int $position) => [$genre['id'] => ['position' => $position]])->all());
            $changed = true;
        }
        MusicCatalog::learn($track->fresh(), $values['identity']['artist']);

        return $changed;
    }
}
