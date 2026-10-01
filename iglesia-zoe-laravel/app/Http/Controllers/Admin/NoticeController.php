<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Reports\Support\WeekCalendar;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NoticeController extends Controller
{
    public const MAX_POINTS = 20;

    public function index(): Response
    {
        return Inertia::render('Admin/Indicaciones', [
            'notice' => LoadPublicSite::weeklyNotice(),
            'defaults' => config('zoe.weekly_notice'),
            'currentWeek' => WeekCalendar::currentLabel(),
            'maxPoints' => self::MAX_POINTS,
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kicker' => 'nullable|string|max:60',
            'title' => 'required|string|max:120',
            'period' => 'nullable|string|max:90',
            'intro' => 'nullable|string|max:600',
            'closing' => 'nullable|string|max:120',
            'points' => 'required|string',
        ], [
            'title.required' => 'Escribe el título de las indicaciones.',
            'title.max' => 'El título puede tener hasta 120 caracteres.',
            'kicker.max' => 'La etiqueta superior puede tener hasta 60 caracteres.',
            'period.max' => 'La vigencia puede tener hasta 90 caracteres.',
            'intro.max' => 'La introducción puede tener hasta 600 caracteres.',
            'closing.max' => 'La firma puede tener hasta 120 caracteres.',
        ]);

        $points = collect(json_decode($data['points'], true) ?: [])
            ->filter(fn ($point) => is_array($point))
            ->map(fn ($point) => [
                'title' => trim((string) ($point['title'] ?? '')),
                'text' => trim((string) ($point['text'] ?? '')),
            ])
            ->filter(fn ($point) => $point['title'] !== '' || $point['text'] !== '')
            ->values();

        if ($points->isEmpty()) {
            return response()->json(['error' => 'Agrega al menos un punto a las indicaciones.'], 422);
        }
        if ($points->count() > self::MAX_POINTS) {
            return response()->json(['error' => 'Puedes publicar hasta '.self::MAX_POINTS.' puntos.'], 422);
        }
        foreach ($points as $index => $point) {
            $number = $index + 1;
            if ($point['title'] === '') {
                return response()->json(['error' => "El punto $number necesita un título."], 422);
            }
            if (mb_strlen($point['title']) > 120 || mb_strlen($point['text']) > 700) {
                return response()->json(['error' => "El punto $number es demasiado largo (título hasta 120 y detalle hasta 700 caracteres)."], 422);
            }
        }

        SiteSetting::query()->updateOrCreate(['key' => 'weekly_notice'], [
            'value' => [
                'enabled' => $request->boolean('enabled'),
                'kicker' => trim((string) ($data['kicker'] ?? '')),
                'title' => trim($data['title']),
                'period' => trim((string) ($data['period'] ?? '')),
                'intro' => trim((string) ($data['intro'] ?? '')),
                'points' => $points->all(),
                'closing' => trim((string) ($data['closing'] ?? '')),
                'updated_by' => $request->user()->name ?: $request->user()->username,
            ],
            'updated_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'reload' => true,
            'message' => $request->boolean('enabled')
                ? 'Indicaciones publicadas. Ya aparecen al ingresar a /acceso.'
                : 'Cambios guardados. Las indicaciones están ocultas.',
        ]);
    }
}
