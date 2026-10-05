<?php

namespace App\Http\Controllers\Web;

use App\Domain\Media\Support\HotMedia;
use App\Domain\Media\Support\MediaLibrary;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

use function Illuminate\Support\defer;

class MediaController extends Controller
{
    public function show(string $path): RedirectResponse
    {
        return $this->redirect($path);
    }

    /** The site's default photos keep their historic /images/* paths. */
    public function images(string $path): RedirectResponse
    {
        return $this->redirect('images/'.$path);
    }

    public function videos(string $path): RedirectResponse
    {
        return $this->redirect('videos/'.$path);
    }

    /** A home page file not copied to the web server yet is copied after answering, so Apache serves it from then on. */
    private function redirect(string $key): RedirectResponse
    {
        abort_unless(MediaLibrary::validKey($key), 404);
        if (HotMedia::isHot($key)) {
            defer(fn () => HotMedia::mirror($key), 'zoe.hot.'.$key);
        }

        return redirect()->away(MediaLibrary::publicUrl($key))
            ->header('Cache-Control', 'public, max-age='.MediaLibrary::publicUrlCacheSeconds());
    }
}
