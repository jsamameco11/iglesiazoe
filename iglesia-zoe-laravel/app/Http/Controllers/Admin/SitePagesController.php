<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\SyncSitePages;
use App\Http\Controllers\Controller;
use App\Models\SitePage;
use App\Models\SiteSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Names of every public page and section; the menu, footer, page labels and section labels of the site read them. */
class SitePagesController extends Controller
{
    private const NAME_MAX = 80;

    private const NOTE_MAX = 120;

    public function index(): Response
    {
        $sections = collect(config('zoe.pages'))->sum(fn (array $page) => count($page['sections'] ?? []));
        if (SitePage::query()->count() !== count(config('zoe.pages')) || SiteSection::query()->count() !== $sections) {
            SyncSitePages::run();
        }

        return Inertia::render('Admin/Paginas', [
            'pages' => LoadPublicSite::pages(),
            'defaults' => collect(config('zoe.pages'))->mapWithKeys(fn (array $page) => [$page['key'] => [
                'name' => $page['name'],
                'note' => $page['note'] ?? '',
                'kicker' => $page['kicker'] ?? '',
                'sections' => collect($page['sections'] ?? [])->pluck('name', 'key')->all(),
            ]])->all(),
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $page = collect(config('zoe.pages'))->firstWhere('key', (string) $request->input('key'));
        if (! $page) {
            return $this->fail('Esa página ya no existe. Recarga la página.', 404);
        }

        $name = $this->text($request->input('name'));
        if ($name === '') {
            return $this->fail('Escribe el nombre de la página.');
        }
        $note = $this->text($request->input('note'));
        $kicker = $this->text($request->input('kicker'));
        if (mb_strlen($name) > self::NAME_MAX || mb_strlen($kicker) > self::NAME_MAX || mb_strlen($note) > self::NOTE_MAX) {
            return $this->fail('El nombre y la etiqueta admiten hasta '.self::NAME_MAX.' caracteres, y la nota del menú hasta '.self::NOTE_MAX.'.');
        }

        $posted = (array) $request->input('sections', []);
        $sections = [];
        foreach ($page['sections'] ?? [] as $section) {
            $value = $this->text($posted[$section['key']] ?? '');
            if ($value === '' || mb_strlen($value) > self::NAME_MAX) {
                return $this->fail('Cada sección necesita un nombre de hasta '.self::NAME_MAX.' caracteres.');
            }
            $sections[$section['key']] = $value;
        }

        SyncSitePages::run();
        SitePage::query()->findOrFail($page['key'])->update(['name' => $name, 'note' => $note, 'kicker' => $kicker]);
        foreach ($sections as $key => $value) {
            SiteSection::query()->where('page_key', $page['key'])->where('key', $key)->update(['name' => $value, 'updated_at' => now()]);
        }
        LoadPublicSite::flush();

        return $this->saved('Guardado. Ya se ve así en la página pública.');
    }

    private function text(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }
}
