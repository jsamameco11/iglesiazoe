<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Capture;
use App\Models\RadioRecording;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/** Records the live console and, when the transmission ends, keeps it as a recorded program. */
class RadioCaptureController extends RadioController
{
    public function handle(Request $request): JsonResponse
    {
        $user = $request->user();
        $action = (string) $request->input('action');

        if ($action === 'start') {
            $result = Capture::open($user, (string) $request->input('session'));

            return $this->reply($result);
        }
        if ($action === 'chunk') {
            $file = $request->file('audio');
            if (! $file instanceof UploadedFile) {
                return $this->fail('No llegó el audio de este tramo.');
            }
            $result = Capture::append($user, (string) $request->input('id'), (int) $request->input('index'), $file, (string) $request->input('extension', 'webm'));

            return $this->reply($result);
        }
        if ($action === 'finish') {
            $recording = Capture::close($user, (string) $request->input('id'), (float) $request->input('duration', 0));
            if (! $recording) {
                return $this->fail('Esa grabación ya no existe.', 404);
            }

            return response()->json(['ok' => true, 'recording' => $this->brief($recording)]);
        }
        if ($action === 'save') {
            $result = Capture::keep($user, (string) $request->input('id'), $request->only(['title', 'program', 'description']), $request->file('cover'), $request->boolean('publish'));
            if (isset($result['error'])) {
                return $this->fail($result['error'], $result['status']);
            }

            return response()->json(['ok' => true, 'message' => $result['message']]);
        }
        if ($action === 'discard') {
            Capture::drop($user, (string) $request->input('id'));

            return response()->json(['ok' => true]);
        }

        return $this->fail('Acción desconocida.');
    }

    /** @param  array<string, mixed>  $result */
    private function reply(array $result): JsonResponse
    {
        if (isset($result['error'])) {
            $body = ['error' => $result['error']];
            if (isset($result['code'])) {
                $body['code'] = $result['code'];
            }
            if (isset($result['recording']) && $result['recording'] instanceof RadioRecording) {
                $body['recording'] = $this->brief($result['recording']);
            }

            return response()->json($body, $result['status']);
        }

        return response()->json([
            'ok' => true,
            'recording' => $this->brief($result['recording']),
            ...isset($result['code']) ? ['code' => $result['code']] : [],
        ]);
    }

    private function brief(RadioRecording $recording): array
    {
        return $recording->refresh()->brief();
    }
}
