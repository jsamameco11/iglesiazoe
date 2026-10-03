<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\LiveSwitch;
use App\Domain\Radio\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

/** Station settings: identity, on air, mix levels, crossfade, the live switch and external streams. */
class RadioSettingsController extends RadioController
{
    public function index(): Response
    {
        return Inertia::render('Admin/Radio/Ajustes', ['config' => Station::config()]);
    }

    public function save(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:60',
            'tagline' => 'nullable|string|max:160',
            'bed_level' => 'required|integer|min:5|max:60',
            'fx_level' => 'required|integer|min:10|max:100',
            'duck_level' => 'required|integer|min:5|max:80',
            'crossfade' => 'required|integer|min:0|max:10',
            'stream_url' => ['nullable', 'string', 'max:300', 'regex:#^https://#i'],
            'turn_url' => ['nullable', 'string', 'max:200', 'regex:#^turns?:#i'],
            'turn_username' => 'nullable|string|max:120',
            'turn_credential' => 'nullable|string|max:200',
            'max_voice' => 'required|integer|min:1|max:200',
            'live_mode' => 'sometimes|in:'.LiveSwitch::AUTO.','.LiveSwitch::MANUAL,
            'live_source' => 'sometimes|in:'.LiveSwitch::CONSOLE.','.LiveSwitch::EXTERNAL,
            'live_url' => ['nullable', 'required_if:live_source,'.LiveSwitch::EXTERNAL, 'string', 'max:300', 'regex:#^https://#i'],
        ], [
            'required' => 'Completa el campo :attribute.',
            'live_url.required_if' => 'Escribe el enlace de la señal externa (OBS / Icecast) o elige la consola como fuente del vivo.',
            'live_url.regex' => 'El enlace de la señal en vivo debe empezar con https:// (los navegadores bloquean http en una web segura).',
            'stream_url.regex' => 'El enlace de transmisión externa debe empezar con https://',
            'turn_url.regex' => 'El servidor TURN debe empezar con turn: o turns:',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'Revisa el campo :attribute.',
        ], [
            'name' => 'nombre de la radio',
            'tagline' => 'lema',
            'bed_level' => 'volumen de fondo',
            'fx_level' => 'volumen de efectos',
            'duck_level' => 'música bajo los anuncios',
            'crossfade' => 'empalme entre canciones',
            'max_voice' => 'oyentes de voz',
            'live_mode' => 'modo del vivo',
            'live_source' => 'fuente del vivo',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $validator->validated();
        $levels = ['bed_level', 'fx_level', 'duck_level', 'crossfade', 'max_voice'];
        Station::saveConfig([
            ...array_map(fn ($value) => trim((string) $value), array_diff_key($data, array_flip($levels))),
            ...array_map(fn ($value) => (int) $value, array_intersect_key($data, array_flip($levels))),
            'on_air' => $request->boolean('on_air'),
            'autofill' => $request->boolean('autofill'),
        ]);

        return $this->saved('Ajustes de la radio guardados.');
    }
}
