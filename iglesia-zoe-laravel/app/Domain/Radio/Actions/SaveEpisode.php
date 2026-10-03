<?php

namespace App\Domain\Radio\Actions;

use App\Domain\Media\Support\MediaLibrary;
use App\Models\RadioEpisode;
use App\Models\RadioTrack;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/** Publishes a library audio as an episode of /radio, from the Episodios tab or while uploading it to the library. */
final class SaveEpisode
{
    public const MAX_DESCRIPTION = 400;

    private const COVER_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

    private const MAX_COVER_MB = 8;

    /**
     * Checks the fields and the cover before any file is stored.
     *
     * @return array{title: string, program: ?string, description: ?string, aired_on: string}
     *
     * @throws ValidationException
     */
    public function validate(array $input, mixed $cover): array
    {
        $validator = Validator::make($input, [
            'title' => 'required|string|min:3|max:160',
            'program' => 'nullable|string|max:120',
            'description' => 'nullable|string|max:'.self::MAX_DESCRIPTION,
            'aired_on' => 'required|date',
        ], [
            'required' => 'Completa el campo :attribute.',
            'date' => 'Elige una fecha válida.',
            'description.max' => 'La descripción es corta: hasta '.self::MAX_DESCRIPTION.' caracteres.',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'El campo :attribute es demasiado largo.',
        ], ['title' => 'título', 'program' => 'programa', 'description' => 'descripción', 'aired_on' => 'fecha']);
        if ($validator->fails()) {
            throw ValidationException::withMessages(['episode' => $validator->errors()->first()]);
        }
        if ($cover instanceof UploadedFile && ! $this->coverExtension($cover)) {
            throw ValidationException::withMessages(['cover' => 'La carátula debe ser JPG, PNG o WEBP de hasta '.self::MAX_COVER_MB.' MB.']);
        }
        $data = $validator->validated();

        return [
            'title' => trim($data['title']),
            'program' => trim((string) ($data['program'] ?? '')) ?: null,
            'description' => trim(str_replace("\r\n", "\n", (string) ($data['description'] ?? ''))) ?: null,
            'aired_on' => $data['aired_on'],
        ];
    }

    /** Saves fields that passed validate(). */
    public function handle(array $data, RadioTrack $track, bool $published, mixed $cover = null, ?RadioEpisode $existing = null, bool $removeCover = false): RadioEpisode
    {
        $data = [...$data, 'radio_track_id' => $track->id, 'published' => $published];
        if ($cover instanceof UploadedFile) {
            $data['cover_path'] = MediaLibrary::storePublic($cover, 'radio/caratulas', $this->coverExtension($cover));
            MediaLibrary::deletePublic($existing?->cover_path);
        } elseif ($existing && $removeCover) {
            MediaLibrary::deletePublic($existing->cover_path);
            $data['cover_path'] = null;
        }

        if ($existing) {
            $existing->update($data);

            return $existing;
        }

        return RadioEpisode::query()->create($data);
    }

    private function coverExtension(UploadedFile $cover): ?string
    {
        return $cover->getSize() <= self::MAX_COVER_MB * 1024 * 1024 ? MediaLibrary::extension($cover, self::COVER_TYPES) : null;
    }
}
