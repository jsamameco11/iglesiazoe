<?php

namespace App\Http\Controllers\Web;

use App\Domain\Media\Support\MediaLibrary;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

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

    private function redirect(string $key): RedirectResponse
    {
        abort_unless(MediaLibrary::validKey($key), 404);

        return redirect()->away(MediaLibrary::publicUrl($key))
            ->header('Cache-Control', 'public, max-age='.MediaLibrary::publicUrlCacheSeconds());
    }
}
