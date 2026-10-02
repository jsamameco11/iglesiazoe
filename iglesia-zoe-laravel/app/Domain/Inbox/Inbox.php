<?php

namespace App\Domain\Inbox;

use App\Domain\Access\Permissions;
use App\Domain\Geo\GeoDirectory;
use App\Models\BaptismEvent;
use App\Models\BaptismRegistration;
use App\Models\PrayerRequest;
use App\Models\User;
use App\Models\VisitPlan;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * The three web forms (planifica tu visita, bautismo, petición de oración) as
 * panel tabs: who may see each one, what is new for each account and the
 * details of every person who wrote.
 */
final class Inbox
{
    public const KINDS = [
        'visitas' => ['permission' => 'inbox.visits', 'title' => 'Visitas planificadas', 'model' => VisitPlan::class],
        'bautismos' => ['permission' => 'inbox.baptisms', 'title' => 'Inscripciones de bautismo', 'model' => BaptismRegistration::class],
        'oraciones' => ['permission' => 'inbox.prayers', 'title' => 'Peticiones de oración', 'model' => PrayerRequest::class],
    ];

    public const LIMIT = 300;

    public static function url(string $kind): string
    {
        return '/admin/formularios/'.$kind;
    }

    /** @return list<string> */
    public static function kindsFor(?User $user): array
    {
        return array_keys(array_filter(self::KINDS, fn ($kind) => Permissions::has($user, $kind['permission'])));
    }

    /** @return array<string, int> */
    public static function unread(User $user): array
    {
        $counts = [];
        foreach (self::kindsFor($user) as $kind) {
            $seen = self::seenAt($user, $kind);
            $counts[$kind] = self::KINDS[$kind]['model']::query()
                ->when($seen, fn ($query) => $query->where('created_at', '>', $seen))
                ->count();
        }

        return $counts;
    }

    public static function seenAt(User $user, string $kind): ?CarbonImmutable
    {
        $value = is_array($user->inbox_seen) ? ($user->inbox_seen[$kind] ?? null) : null;

        return $value ? CarbonImmutable::parse($value) : null;
    }

    /** Marks the tab as read and returns when it was read before. */
    public static function markSeen(User $user, string $kind): ?CarbonImmutable
    {
        $previous = self::seenAt($user, $kind);
        $user->forceFill(['inbox_seen' => [...(is_array($user->inbox_seen) ? $user->inbox_seen : []), $kind => now()->toIso8601String()]])->save();

        return $previous;
    }

    /** @return list<array<string, mixed>> */
    public static function rows(string $kind): array
    {
        $rows = self::KINDS[$kind]['model']::query()->latest()->limit(self::LIMIT)->get();
        $countries = array_column(GeoDirectory::countries(), 'name', 'code');
        $placeLabels = array_column(GeoDirectory::countries(), 'labels', 'code');
        $events = $kind === 'bautismos'
            ? BaptismEvent::query()->get(['id', 'event_date', 'location'])->keyBy('id')
            : collect();

        return $rows->map(function (Model $row) use ($kind, $countries, $placeLabels, $events) {
            $base = [
                'id' => (string) $row->id,
                'full_name' => $row->full_name,
                'first_name' => $row->first_name,
                'last_name' => $row->last_name,
                'age' => $row->age,
                'marital_status' => $row->marital_status,
                'phone' => $row->phone,
                'email' => $row->email,
                'created_at' => $row->created_at?->toIso8601String(),
                'network' => NetworkRoute::for($row->age, $row->marital_status, (string) $row->id),
            ];

            return match ($kind) {
                'visitas' => [
                    ...$base,
                    'sex' => $row->sex,
                    'country_code' => $row->country_code,
                    'country' => $row->country_code ? ($countries[$row->country_code] ?? $row->country_code) : null,
                    'place_labels' => $placeLabels[$row->country_code] ?? ['Estado o departamento', 'Provincia o ciudad', 'Distrito'],
                    'region' => $row->region,
                    'city' => $row->city,
                    'district' => $row->district,
                    'service' => $row->service,
                ],
                'bautismos' => [
                    ...$base,
                    'sex' => $row->sex,
                    'country_code' => $row->country_code,
                    'country' => $row->country_code ? ($countries[$row->country_code] ?? $row->country_code) : null,
                    'event_date' => $events->get($row->event_id)?->event_date?->toDateString(),
                    'event_location' => $events->get($row->event_id)?->location,
                    'notes' => $row->notes,
                ],
                'oraciones' => [
                    ...$base,
                    'topic' => $row->topic,
                    'request' => $row->request,
                ],
            };
        })->all();
    }

    /**
     * Lock-screen text for a new submission. Prayer requests never show their content.
     *
     * @return array{title: string, body: string}
     */
    public static function headline(string $kind, Model $row): array
    {
        $route = NetworkRoute::for($row->age, $row->marital_status, (string) $row->id);
        $who = trim($row->full_name.($row->age ? ", {$row->age} años" : ''));

        return match ($kind) {
            'visitas' => ['title' => "Nueva visita planificada · {$route['label']}", 'body' => $who.($row->service ? " · {$row->service}" : '')],
            'bautismos' => ['title' => "Nueva inscripción de bautismo · {$route['label']}", 'body' => $who],
            'oraciones' => ['title' => "Nueva petición de oración · {$route['label']}", 'body' => $who.($row->topic ? " · {$row->topic}" : '')],
        };
    }
}
