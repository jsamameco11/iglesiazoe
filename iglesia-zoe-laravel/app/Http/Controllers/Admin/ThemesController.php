<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Http\Controllers\Controller;
use App\Models\Theme;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Weekly cell themes: file upload and hiding old ones. */
class ThemesController extends Controller
{
    private const THEME_FILE_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];

    public function temas(): Response
    {
        return Inertia::render('Admin/Temas', [
            'themes' => Theme::query()->where('active', true)->orderByDesc('theme_date')->get()->map->card(),
            'accept' => '.'.implode(',.', self::THEME_FILE_TYPES),
        ]);
    }

    public function uploadTheme(Request $request): JsonResponse
    {
        $title = trim((string) $request->input('title'));
        $date = (string) $request->input('theme_date');
        if (mb_strlen($title) < 3 || mb_strlen($title) > 160) {
            return $this->fail('Escribe el título del tema (de 3 a 160 caracteres).');
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || ! strtotime($date)) {
            return $this->fail('Elige la fecha del tema.');
        }
        $file = $request->file('file');
        if (! $file) {
            return $this->fail('Adjunta el archivo del tema.');
        }
        $ext = MediaLibrary::extension($file, self::THEME_FILE_TYPES);
        if (! $ext || $file->getSize() > 25 * 1024 * 1024) {
            return $this->fail('El archivo debe ser PDF, Word, PowerPoint o una imagen de hasta 25 MB.');
        }
        Theme::query()->create([
            'title' => $title,
            'audience' => trim((string) $request->input('audience')) ?: 'Iglesia',
            'theme_date' => $date,
            'file_path' => MediaLibrary::storePrivate($file, 'temas/'.substr($date, 0, 4), $ext),
            'active' => true,
        ]);

        return $this->saved("Tema «{$title}» publicado.");
    }

    public function hideTheme(Request $request): JsonResponse
    {
        $id = (string) $request->input('id');
        $theme = $this->find(Theme::class, $id);
        if (! $theme) {
            return $this->fail('Ese tema ya no existe.', 404);
        }
        $theme->update(['active' => false]);

        return $this->saved('Tema ocultado.');
    }
}
