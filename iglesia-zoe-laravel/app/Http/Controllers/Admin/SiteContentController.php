<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Permissions;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Support\YouTube;
use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Main texts, per-page texts and giving details of the public site. */
class SiteContentController extends Controller
{
    public function contenido(): Response
    {
        return Inertia::render('Admin/Contenido', ['settings' => LoadPublicSite::settings()]);
    }

    public function generosidad(): Response
    {
        return Inertia::render('Admin/Generosidad', ['settings' => LoadPublicSite::settings()]);
    }

    private const GIVING_KEYS = ['bankSoles', 'bankSolesCci', 'bankDollars', 'bankDollarsCci', 'bankHolder', 'bankSwift', 'yape', 'yapeHolder', 'yapeQr', 'cardUrl'];

    /** Editable lists posted as numbered fields, e.g. route_title_1 / route_text_1. Each item keeps its slot so its photo stays with it. */
    private const LIST_FIELDS = ['routeLevels' => ['route', 6]];

    private const URL_KEYS = ['facebook', 'youtube', 'instagram', 'tiktok', 'messengerUrl', 'liveUrl', 'mapUrl', 'cardUrl', 'yapeQr'];

    private const VALUE_SLOTS = 6;

    public function saveSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        $canContent = Permissions::has($user, 'content.manage');
        $canGiving = Permissions::has($user, 'generosity.manage');
        $stored = $this->storedSite();

        $editable = array_diff(array_keys(config('zoe.settings')), [...LoadPublicSite::LIST_SETTINGS, 'copy']);
        $input = [];
        foreach ($editable as $key) {
            if (! $request->has($key) || ! is_scalar($request->input($key) ?? '')) {
                continue;
            }
            $giving = in_array($key, self::GIVING_KEYS, true);
            if (($giving && ! $canGiving) || (! $giving && ! $canContent)) {
                continue;
            }
            $input[$key] = trim((string) $request->input($key));
        }

        foreach (self::URL_KEYS as $key) {
            $value = $input[$key] ?? '';
            if ($value !== '' && ! preg_match('~^(https?://|/)~i', $value)) {
                return $this->fail('Revisa el enlace de «'.$key.'»: debe empezar con https://');
            }
        }
        if (($input['liveYoutubeId'] ?? '') !== '') {
            $live = YouTube::id($input['liveYoutubeId']);
            if (! $live) {
                return $this->fail('No reconocemos el enlace de YouTube en vivo. Pega el enlace del video o su ID.');
            }
            $input['liveYoutubeId'] = $live;
        }
        if (($input['baptismVideo'] ?? '') !== '') {
            $video = YouTube::id($input['baptismVideo']);
            if (! $video) {
                return $this->fail('No reconocemos el enlace de YouTube del video de bautismo. Pega el enlace del video o su ID.');
            }
            $input['baptismVideo'] = $video;
        }
        foreach (['serviceDayMain', 'serviceDayWeek'] as $key) {
            if (isset($input[$key]) && ! preg_match('/^[0-6]$/', $input[$key])) {
                unset($input[$key]);
            }
        }

        if ($canGiving && $request->hasFile('yapeQrFile')) {
            $file = $request->file('yapeQrFile');
            $ext = MediaLibrary::extension($file, ['png', 'jpg', 'jpeg', 'webp']);
            if (! $ext || $file->getSize() > 4 * 1024 * 1024) {
                return $this->fail('El QR debe ser una imagen PNG, JPG o WEBP de hasta 4 MB.');
            }
            $input['yapeQr'] = MediaLibrary::storePublic($file, 'generosidad', $ext);
            MediaLibrary::deletePublic($stored['yapeQr'] ?? null);
        }

        $next = array_replace($stored, $input);

        if ($canContent && $request->has('value_title_1')) {
            $values = [];
            for ($i = 1; $i <= self::VALUE_SLOTS; $i++) {
                $title = trim((string) $request->input("value_title_$i"));
                if ($title !== '') {
                    $values[] = ['title' => $title, 'text' => trim((string) $request->input("value_text_$i"))];
                }
            }
            if ($values) {
                $next['values'] = $values;
            }
        }

        foreach (self::LIST_FIELDS as $key => [$prefix, $slots]) {
            if (! $canContent || ! $request->has("{$prefix}_title_1")) {
                continue;
            }
            $items = [];
            for ($i = 1; $i <= $slots; $i++) {
                $title = mb_substr(trim((string) $request->input("{$prefix}_title_$i")), 0, 80);
                if ($title !== '') {
                    $items[] = ['slot' => $i, 'title' => $title, 'text' => mb_substr(trim((string) $request->input("{$prefix}_text_$i")), 0, 400)];
                }
            }
            if ($items) {
                $next[$key] = $items;
            }
        }

        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $next, 'updated_at' => now()]);

        return $this->saved();
    }

    public function textos(): Response
    {
        return Inertia::render('Admin/Textos', ['settings' => LoadPublicSite::settings()]);
    }

    public function saveTexts(Request $request): JsonResponse
    {
        $stored = $this->storedSite();
        $copy = is_array($stored['copy'] ?? null) ? $stored['copy'] : [];
        $posted = $request->input('copy', []);

        foreach (is_array($posted) ? $posted : [] as $key => $value) {
            if (! is_string($key) || ! preg_match('/^[a-z]+\.[A-Za-z0-9]+$/', $key) || ! is_scalar($value ?? '')) {
                continue;
            }
            $value = trim((string) $value);
            if (mb_strlen($value) > 3000) {
                return $this->fail('Uno de los textos es demasiado largo (máximo 3000 caracteres).');
            }
            if ($value === '') {
                unset($copy[$key]);
            } else {
                $copy[$key] = $value;
            }
        }
        $stored['copy'] = $copy;

        if ($request->has('prayerTopics')) {
            $topics = collect(preg_split('/\R/', (string) $request->input('prayerTopics')))
                ->map(fn ($topic) => mb_substr(trim($topic), 0, 60))
                ->filter()
                ->unique()
                ->take(12)
                ->values()
                ->all();
            if ($topics) {
                $stored['prayerTopics'] = $topics;
            } else {
                unset($stored['prayerTopics']);
            }
        }

        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $stored, 'updated_at' => now()]);

        return $this->saved();
    }

    private function storedSite(): array
    {
        $stored = SiteSetting::query()->where('key', 'site')->first()?->value;

        return is_array($stored) ? $stored : [];
    }
}
