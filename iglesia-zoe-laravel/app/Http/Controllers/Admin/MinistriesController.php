<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Actions\ManageSiteMedia;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use App\Models\Ministry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** Ministries shown on the site, with their order. */
class MinistriesController extends Controller
{
    public function ministerios(): Response
    {
        if (! Ministry::query()->exists()) {
            foreach (config('zoe.ministries') as $row) {
                Ministry::query()->create($row);
            }
            LoadPublicSite::flush();
        }

        return Inertia::render('Admin/Ministerios', ['ministries' => Ministry::query()->orderBy('sort_order')->get()]);
    }

    public function saveMinistry(Request $request, ManageSiteMedia $media): JsonResponse
    {
        $id = $request->input('id');
        $existing = $id ? Ministry::query()->find($id) : null;
        if ($id && ! $existing) {
            return $this->fail('Ese ministerio ya no existe. Recarga la página.', 404);
        }
        $name = trim((string) $request->input('name'));
        if ($name === '') {
            return $this->fail('Escribe el nombre del ministerio.');
        }
        $slug = Str::limit(Str::slug(trim((string) $request->input('slug')) ?: $name), 80, '');
        if (! preg_match('/^[a-z0-9-]{1,80}$/', $slug)) {
            return $this->fail('La dirección web solo puede tener letras, números y guiones.');
        }
        $taken = Ministry::query()->where('slug', $slug)->when($existing, fn ($query) => $query->where('id', '!=', $existing->id))->exists();
        if ($taken) {
            return $this->fail('Ya existe otro ministerio con la dirección «'.$slug.'».');
        }
        $accent = (string) $request->input('accent');
        $payload = [
            'slug' => $slug,
            'name' => $name,
            'age_range' => trim((string) $request->input('age_range')),
            'summary' => trim((string) $request->input('summary')),
            'body' => trim((string) $request->input('body')),
            'accent' => preg_match('/^#[0-9A-Fa-f]{6}$/', $accent) ? strtolower($accent) : ($existing->accent ?? '#e8c3a4'),
            'active' => $request->boolean('active'),
        ];

        if ($existing) {
            if ($existing->slug !== $slug) {
                $media->renameMinistry($existing->slug, $slug);
            }
            $existing->update($payload);
        } else {
            Ministry::query()->create([...$payload, 'sort_order' => (int) Ministry::query()->max('sort_order') + 1]);
        }
        LoadPublicSite::flush();

        return $this->saved();
    }

    public function moveMinistry(Request $request): JsonResponse
    {
        $ids = Ministry::query()->orderBy('sort_order')->pluck('id')->all();
        $from = array_search($request->input('id'), $ids, true);
        $to = $from === false ? false : $from + ($request->input('direction') === 'up' ? -1 : 1);
        if ($from !== false && isset($ids[$to])) {
            [$ids[$from], $ids[$to]] = [$ids[$to], $ids[$from]];
            $this->renumberMinistries($ids);
        }

        return $this->saved();
    }

    public function deleteMinistry(Request $request): JsonResponse
    {
        Ministry::query()->where('id', $request->input('id'))->delete();
        $this->renumberMinistries(Ministry::query()->orderBy('sort_order')->pluck('id')->all());

        return $this->saved();
    }

    private function renumberMinistries(array $ids): void
    {
        foreach (array_values($ids) as $index => $id) {
            Ministry::query()->where('id', $id)->update(['sort_order' => $index + 1]);
        }
        LoadPublicSite::flush();
    }
}
