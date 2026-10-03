<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BaptismEvent;
use App\Models\BaptismRegistration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Baptism dates people sign up for on the site. */
class BaptismsController extends Controller
{
    public function bautismos(): Response
    {
        return Inertia::render('Admin/Bautismos', [
            'events' => BaptismEvent::query()->orderBy('event_date')->get()->map(fn ($event) => [
                'id' => $event->id,
                'event_date' => optional($event->event_date)->toDateString(),
                'location' => $event->location,
                'notes' => $event->notes,
                'active' => $event->active,
            ]),
            'registrations' => BaptismRegistration::query()->count(),
        ]);
    }

    public function saveBaptism(Request $request): JsonResponse
    {
        $payload = [
            'event_date' => $request->input('event_date') ?: null,
            'location' => $request->input('location'),
            'notes' => $request->input('notes'),
            'active' => $request->boolean('active'),
        ];
        $id = $request->input('id');
        $id ? BaptismEvent::query()->where('id', $id)->update($payload) : BaptismEvent::query()->create($payload);

        return $this->saved();
    }
}
