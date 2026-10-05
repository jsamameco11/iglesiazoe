<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\AudioRejected;
use App\Domain\Radio\DirectUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Opens the direct upload of an audio to Wasabi, for the library and for episodes.
 * The form is saved afterwards with the upload token instead of the file.
 */
class RadioUploadController extends RadioController
{
    public function begin(Request $request): JsonResponse
    {
        if (! DirectUpload::available()) {
            return response()->json(['direct' => false]);
        }
        $size = filter_var($request->input('size'), FILTER_VALIDATE_INT);

        try {
            return response()->json(['direct' => true] + DirectUpload::begin(
                $request->user(),
                mb_substr((string) $request->input('name'), 0, 255),
                $size === false ? 0 : $size,
                (string) $request->input('kind'),
            ));
        } catch (AudioRejected $rejected) {
            return $rejected->response();
        }
    }

    public function cancel(Request $request): JsonResponse
    {
        DirectUpload::cancel((string) $request->input('token'), $request->user());

        return response()->json(['ok' => true]);
    }
}
