<?php

namespace App\Domain\Stream;

use App\Domain\Stream\Jobs\ArchiveRecording;
use App\Domain\Stream\YouTube\VideoOptions;
use App\Domain\Stream\YouTube\YouTubeClient;
use App\Domain\Stream\YouTube\YouTubeError;
use App\Models\LiveStream;
use App\Models\Teaching;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Life of a broadcast: prepared in the panel (or opened by the signal itself),
 * on air while OBS sends, and turned into a teaching when it ends.
 */
final class Broadcasts
{
    private const ENDED_AT = 'zoe.stream.ended_at';

    /** Seconds the archive waits so the media server can close the last recording segment. */
    public const ARCHIVE_DELAY = 45;

    /**
     * @param  array{title: string, description: ?string, preacher: ?string, kind: string, show_summary: bool, to_youtube: bool, options: array, cover_path?: ?string}  $data
     * @return array{0: LiveStream, 1: list<string>}
     */
    public static function prepare(array $data, ?User $by = null): array
    {
        $live = LiveStream::query()->create([...$data, 'status' => 'ready', 'created_by' => $by?->id]);
        $warnings = self::openOnYouTube($live);
        LiveState::forget();

        return [$live, $warnings];
    }

    /** @return list<string> */
    public static function update(LiveStream $live, array $data, bool $coverChanged = false): array
    {
        $wasToYoutube = $live->to_youtube;
        $live->update($data);
        $warnings = [];

        if ($wasToYoutube && ! $live->to_youtube && $live->status === 'ready') {
            self::closeOnYouTube($live);
            $live->update(['youtube_id' => null, 'youtube_mode' => null, 'youtube_error' => null]);
        } elseif ($live->to_youtube && $live->youtube_id && $live->youtube_mode === 'api') {
            try {
                $warnings = YouTubeClient::updateBroadcast($live, $coverChanged);
            } catch (YouTubeError $error) {
                $warnings[] = $error->getMessage();
            }
        } elseif ($live->to_youtube && ! $live->youtube_mode) {
            $warnings = self::openOnYouTube($live);
        }

        if ($live->status === 'live' && $wasToYoutube !== $live->to_youtube) {
            $warnings[] = $live->to_youtube
                ? 'YouTube empezará a recibir la señal cuando OBS se vuelva a conectar.'
                : 'YouTube dejará de recibir la señal cuando OBS se vuelva a conectar.';
        }
        LiveState::forget();

        return $warnings;
    }

    /** A signal arrived with nothing prepared: the broadcast opens with the default details. */
    public static function quick(): LiveStream
    {
        $defaults = StreamSettings::defaults();
        $live = LiveStream::query()->create([
            'title' => VideoOptions::clean($defaults['title'].' · '.now('America/Lima')->locale('es')->translatedFormat('j \d\e F Y'), 100),
            'description' => $defaults['description'] ?: null,
            'preacher' => $defaults['preacher'] ?: null,
            'kind' => $defaults['kind'],
            'show_summary' => $defaults['show_summary'],
            'to_youtube' => $defaults['to_youtube'],
            'options' => [...$defaults['options'], 'scheduled_at' => null, 'publish_at' => null],
            'status' => 'ready',
            'quick' => true,
        ]);
        self::openOnYouTube($live);

        return $live;
    }

    /** Drops a prepared broadcast that never went on air. */
    public static function cancel(LiveStream $live): void
    {
        if ($live->status !== 'ready') {
            return;
        }
        self::closeOnYouTube($live);
        $live->update(['status' => 'cancelled', 'ended_at' => now(), 'end_reason' => 'cancelled']);
        LiveState::forget();
    }

    /**
     * Ends the broadcast everywhere and saves it as a teaching.
     * $reason: panel (ended by an administrator) or timeout (signal lost too long).
     */
    public static function end(LiveStream $live, string $reason): ?Teaching
    {
        if ($live->status === 'ready') {
            self::cancel($live);

            return null;
        }
        $claimed = LiveStream::query()->whereKey($live->id)->where('status', 'live')
            ->update(['status' => 'ended', 'ended_at' => now(), 'end_reason' => $reason, 'updated_at' => now()]);
        if (! $claimed) {
            return null;
        }
        $live->refresh();
        Cache::put(self::ENDED_AT, now()->getTimestamp(), (int) config('stream.cooldown_seconds'));
        if ($reason === 'panel') {
            MediaServer::kick();
        }

        if ($live->youtube_id && $live->youtube_mode === 'api') {
            try {
                if (YouTubeClient::completeBroadcast($live->youtube_id) === 'deleted') {
                    $live->update(['youtube_id' => null, 'youtube_error' => 'YouTube nunca recibió la señal, así que no quedó video en el canal. La grabación se guardó para publicarla desde Enseñanzas.']);
                }
            } catch (YouTubeError $error) {
                $live->update(['youtube_error' => 'No se pudo finalizar en YouTube: '.$error->getMessage().' Finalízala en YouTube Studio.']);
            }
        }

        $teaching = self::saveTeaching($live);
        ArchiveRecording::dispatch($live->id)->onConnection(config('stream.queue'))->delay(now()->addSeconds(self::ARCHIVE_DELAY));
        LiveState::forget();

        return $teaching;
    }

    /**
     * Runs every minute: ends broadcasts whose signal has been gone too long and
     * notices a signal the media server lost without telling (e.g. after a restart).
     */
    public static function watch(): void
    {
        $limit = now()->subMinutes((int) config('stream.grace_minutes'));
        $abandoned = LiveStream::query()->where('status', 'live')->whereNotNull('signal_lost_at')->where('signal_lost_at', '<=', $limit)->get();
        foreach ($abandoned as $live) {
            self::end($live, 'timeout');
        }

        $onAir = LiveStream::query()->where('status', 'live')->whereNull('signal_lost_at')->where('signal_at', '<=', now()->subMinute())->exists();
        if ($onAir) {
            $server = MediaServer::status();
            if ($server['online'] && ! $server['ready']) {
                SignalHooks::stopped();
            }
        }
    }

    /** Right after a broadcast ends OBS usually reconnects on its own; that signal must not open a new one. */
    public static function coolingDown(): bool
    {
        $endedAt = Cache::get(self::ENDED_AT);

        return is_int($endedAt) && now()->getTimestamp() - $endedAt < (int) config('stream.cooldown_seconds');
    }

    /** @return list<string> */
    private static function openOnYouTube(LiveStream $live): array
    {
        if (! $live->to_youtube) {
            return [];
        }
        $target = StreamSettings::relayTarget();
        if (! $target) {
            $message = 'La cuenta de YouTube no está conectada: esta transmisión se verá solo en la web.';
            $live->update(['youtube_error' => $message]);

            return [$message];
        }
        if ($target['mode'] === 'key') {
            $live->update(['youtube_mode' => 'key', 'youtube_error' => null]);

            return [];
        }
        try {
            $broadcast = YouTubeClient::createBroadcast($live);
            $live->update(['youtube_id' => $broadcast['id'], 'youtube_mode' => 'api', 'youtube_error' => null]);

            return $broadcast['warnings'];
        } catch (YouTubeError $error) {
            $live->update(['youtube_error' => $error->getMessage()]);

            return [$error->getMessage()];
        }
    }

    private static function closeOnYouTube(LiveStream $live): void
    {
        if (! $live->youtube_id || $live->youtube_mode !== 'api') {
            return;
        }
        try {
            YouTubeClient::completeBroadcast($live->youtube_id);
        } catch (YouTubeError) {
        }
    }

    private static function saveTeaching(LiveStream $live): Teaching
    {
        $options = VideoOptions::fill($live->options ?? []);
        $youtubeId = $live->youtube_mode === 'api' ? $live->youtube_id : null;
        $started = $live->started_at ?? $live->created_at ?? now();

        $teaching = Teaching::query()->create([
            'title' => $live->title,
            'kind' => $live->kind,
            'teaching_date' => $started->copy()->setTimezone('America/Lima')->toDateString(),
            'summary' => $live->description ?: null,
            'show_summary' => $live->show_summary,
            'preacher' => $live->preacher ?: null,
            'source' => 'live',
            'youtube_id' => $youtubeId,
            'youtube_privacy' => $youtubeId ? $options['privacy'] : null,
            'youtube_status' => $youtubeId ? 'processing' : null,
            'youtube_options' => $options,
            'cover_path' => $live->cover_path,
            'duration_seconds' => $live->ended_at ? (int) $started->diffInSeconds($live->ended_at, true) : null,
            'live_stream_id' => $live->id,
            'active' => true,
        ]);
        $live->update(['teaching_id' => $teaching->id]);

        return $teaching;
    }
}
