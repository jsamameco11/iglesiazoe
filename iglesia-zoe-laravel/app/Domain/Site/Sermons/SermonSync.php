<?php

namespace App\Domain\Site\Sermons;

use App\Models\Sermon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Compares the YouTube channel with the sermons of the site: brings in the new services
 * (published right away or waiting for review, as the panel says) and keeps the title,
 * views and length of the ones already on the site in step with YouTube.
 */
final class SermonSync
{
    /** Watch pages opened per check, so a first run on a big channel stays polite. */
    private const DETAILS_PER_RUN = 40;

    private const LOCK_SECONDS = 600;

    public const HOME_CACHE = 'zoe.home.sermons';

    public function __construct(private readonly ChannelReader $reader) {}

    private const QUEUED = 'sermons:youtube-queued';

    public static function make(): self
    {
        return new self(ChannelReader::make());
    }

    /**
     * Checks the channel right after the panel gets its answer, so a long first import never
     * hits the web server timeout; the panel watches the run log until it finishes.
     */
    public static function inBackground(string $trigger, int $pages): void
    {
        Cache::put(self::QUEUED, now()->toIso8601String(), self::LOCK_SECONDS);
        dispatch(function () use ($trigger, $pages) {
            set_time_limit(self::LOCK_SECONDS);
            self::make()->run($trigger, $pages);
        })->afterResponse();
    }

    public static function queued(): bool
    {
        return Cache::has(self::QUEUED);
    }

    /**
     * Runs a check now. $trigger says who asked ("auto", "manual" or "history"), and $pages how
     * many pages of the channel to read (30 videos each).
     *
     * @return array<string, mixed> the run as the panel shows it
     */
    public function run(string $trigger = 'auto', int $pages = 1): array
    {
        $lock = Cache::lock('sermons:youtube-sync', self::LOCK_SECONDS);
        if (! $lock->get()) {
            return ['at' => now()->toIso8601String(), 'trigger' => $trigger, 'error' => 'Ya hay una búsqueda en curso. Intenta en unos minutos.', 'busy' => true];
        }

        $started = microtime(true);
        $run = [
            'at' => now()->toIso8601String(),
            'trigger' => $trigger,
            'source' => $this->reader->usesApi() ? 'api' : 'pages',
            'found' => 0, 'added' => 0, 'pending' => 0, 'updated' => 0, 'skipped' => [], 'titles' => [],
        ];

        try {
            $run = $this->compare($run, $pages);
        } catch (\Throwable $error) {
            $run['error'] = Str::limit($error->getMessage(), 240);
            Log::warning('sermons: no se pudo revisar el canal de YouTube', ['error' => $error->getMessage()]);
        } finally {
            $run['seconds'] = round(microtime(true) - $started, 1);
            SermonSettings::recordRun($run);
            Cache::forget(self::HOME_CACHE);
            Cache::forget(self::QUEUED);
            $lock->release();
        }

        return $run;
    }

    private function compare(array $run, int $pages): array
    {
        $settings = SermonSettings::current();
        $listed = $this->reader->latest(SermonSettings::channelUrl(), $settings['filter'], max(1, $pages));
        $run['found'] = count($listed);

        $known = Sermon::query()->whereIn('youtube_id', array_column($listed, 'id'))->get()->groupBy('youtube_id');
        $ignored = array_flip(SermonSettings::ignored());
        $minimum = (int) $settings['min_minutes'] * 60;
        $candidates = [];

        foreach ($listed as $video) {
            foreach ($known->get($video['id'], collect()) as $sermon) {
                $run['updated'] += $this->refresh($sermon, $video) ? 1 : 0;
            }
            if ($known->has($video['id'])) {
                continue;
            }
            $reason = match (true) {
                isset($ignored[$video['id']]) => 'descartados',
                $video['duration'] === null => 'en vivo o programados',
                $video['duration'] < $minimum => 'muy cortos',
                default => null,
            };
            if ($reason !== null) {
                $run['skipped'][$reason] = ($run['skipped'][$reason] ?? 0) + 1;

                continue;
            }
            $candidates[] = $video['id'];
        }

        $incomplete = Sermon::query()->whereNotNull('youtube_id')->whereNull('synced_at')->limit(self::DETAILS_PER_RUN)->pluck('youtube_id')->all();
        $wanted = array_slice(array_values(array_unique([...$candidates, ...$incomplete])), 0, self::DETAILS_PER_RUN);
        $details = $this->reader->details($wanted);

        foreach ($incomplete as $id) {
            if (isset($details[$id])) {
                Sermon::query()->where('youtube_id', $id)->whereNull('synced_at')->get()
                    ->each(fn (Sermon $sermon) => $run['updated'] += $this->complete($sermon, $details[$id]) ? 1 : 0);
            }
        }

        $since = $settings['since'] ? CarbonImmutable::parse($settings['since'], SermonSettings::TIMEZONE)->startOfDay() : null;
        $publish = $settings['mode'] === 'auto' && $run['trigger'] !== 'history';
        foreach (array_reverse($candidates) as $id) {
            $video = $details[$id] ?? null;
            $reason = match (true) {
                $video === null => in_array($id, $wanted, true) ? 'no disponibles' : 'para la próxima revisión',
                $video['live_now'] || $video['upcoming'] => 'en vivo o programados',
                ! $video['embeddable'] => 'no se pueden reproducir fuera de YouTube',
                $since !== null && $video['aired_at'] !== null && $video['aired_at']->lt($since) => 'anteriores a la fecha de inicio',
                default => null,
            };
            if ($reason !== null) {
                $run['skipped'][$reason] = ($run['skipped'][$reason] ?? 0) + 1;

                continue;
            }
            $this->create($video, $settings, $publish);
            $run[$publish ? 'added' : 'pending']++;
            $run['titles'][] = $video['title'];
        }
        $run['titles'] = array_slice(array_reverse($run['titles']), 0, 8);

        return $run;
    }

    /** Keeps a sermon already on the site in step with what the channel lists. */
    private function refresh(Sermon $sermon, array $video): bool
    {
        $changes = array_filter([
            'views' => $video['views'],
            'duration' => $video['duration'] ?: null,
            'youtube_title' => $video['title'] ?: null,
        ], fn ($value) => $value !== null);
        if (! $sermon->title_locked && $video['title'] !== '') {
            $changes['title'] = $video['title'];
        }
        $sermon->fill($changes);
        $dirty = $sermon->isDirty();
        if ($sermon->synced_at !== null) {
            $sermon->synced_at = now();
        }
        $sermon->save();

        return $dirty;
    }

    /** Fills in what YouTube knows about a sermon that was added by hand with only its link. */
    private function complete(Sermon $sermon, array $video): bool
    {
        $sermon->fill([
            'description' => $video['description'] ?: $sermon->description,
            'duration' => $video['duration'] ?? $sermon->duration,
            'views' => $video['views'] ?? $sermon->views,
            'aired_at' => $video['aired_at'] ?? $sermon->aired_at,
            'thumbnail' => $video['thumbnail'],
            'channel' => $video['channel'] ?? $sermon->channel,
            'youtube_title' => $video['title'] ?: $sermon->youtube_title,
            'synced_at' => now(),
        ]);
        if (! $sermon->title_locked && $video['title'] !== '') {
            $sermon->title = $video['title'];
        }
        if ($sermon->sermon_date === null && $video['aired_at'] !== null) {
            $sermon->sermon_date = $video['aired_at']->setTimezone(SermonSettings::TIMEZONE)->toDateString();
        }
        $sermon->save();

        return true;
    }

    private function create(array $video, array $settings, bool $publish): Sermon
    {
        $aired = $video['aired_at'] ?? CarbonImmutable::now();
        $local = $aired->setTimezone(SermonSettings::TIMEZONE);

        return Sermon::query()->create([
            'title' => $video['title'] ?: 'Servicio del '.$local->translatedFormat('j \d\e F'),
            'youtube_title' => $video['title'],
            'preacher' => $settings['preacher'] ?: null,
            'series' => $local->isSunday() ? $settings['series_sunday'] : $settings['series_weekday'],
            'sermon_date' => $local->toDateString(),
            'youtube_id' => $video['id'],
            'description' => $video['description'] ?: null,
            'duration' => $video['duration'],
            'views' => $video['views'],
            'aired_at' => $aired,
            'thumbnail' => $video['thumbnail'],
            'channel' => $video['channel'],
            'source' => 'youtube',
            'published' => $publish,
            'pending' => ! $publish,
            'synced_at' => now(),
        ]);
    }
}
