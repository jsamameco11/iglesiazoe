<?php

namespace App\Domain\Site\Support;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\Devotional;
use GdImage;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Square picture of a devotional, served from the site's own address so the
 * browser can download it and hand it to WhatsApp (the stored photos live on
 * another domain). It is the devotional's photo, or the Devotionals cover
 * when it has none.
 */
final class DevotionalArt
{
    public const SIZE = 1080;

    /** Bump when the drawing changes so cached pictures and shared links refresh. */
    private const REVISION = 3;

    private const QUALITY = 86;

    /** Photos closer to square than this are cropped; wider or taller ones are shown whole over a blurred copy. */
    private const CROP_LIMIT = 1.2;

    private const BLUR = 64;

    private const COVER = '/images/vida-en-casas.jpg';

    /** Public path of the square picture; the version changes with the photo so shared links refresh. */
    public static function url(Devotional $devotional): string
    {
        return '/devocionales/'.$devotional->slug.'/imagen?v='.substr(self::fingerprint(self::source($devotional)), 0, 10);
    }

    /** JPEG bytes of the square picture, or null when the photo cannot be read. */
    public static function jpeg(Devotional $devotional): ?string
    {
        $source = self::source($devotional);
        $key = 'zoe.devotional.art.'.self::fingerprint($source);
        $cached = Cache::get($key);
        if (is_string($cached)) {
            return $cached;
        }

        $jpeg = self::render($source);
        if ($jpeg !== null) {
            Cache::put($key, $jpeg, now()->addDays(30));
        }

        return $jpeg;
    }

    private static function fingerprint(string $source): string
    {
        return md5(self::REVISION.'|'.$source);
    }

    private static function source(Devotional $devotional): string
    {
        if (self::keyOf($devotional->image_path)) {
            return $devotional->image_path;
        }
        $cover = LoadPublicSite::mediaOverrides()['devotionals'] ?? null;
        if (is_array($cover) && ($cover['kind'] ?? 'image') === 'image' && self::keyOf($cover['src'] ?? null)) {
            return $cover['src'];
        }

        return self::COVER;
    }

    /** Storage key behind a "/media/..." or "/images/..." site path. */
    private static function keyOf(mixed $path): ?string
    {
        if (! is_string($path)) {
            return null;
        }
        if (str_starts_with($path, '/images/')) {
            $key = ltrim($path, '/');

            return MediaLibrary::validKey($key) ? $key : null;
        }

        return MediaLibrary::keyOf($path);
    }

    private static function render(string $source): ?string
    {
        $key = self::keyOf($source);
        try {
            $bytes = $key ? MediaLibrary::publicDisk()->get($key) : null;
            $photo = is_string($bytes) && $bytes !== '' ? @imagecreatefromstring($bytes) : false;
        } catch (Throwable) {
            return null;
        }
        if (! $photo) {
            return null;
        }

        $width = imagesx($photo);
        $height = imagesy($photo);
        $canvas = imagecreatetruecolor(self::SIZE, self::SIZE);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        self::cover($canvas, $photo, $width, $height);

        if (max($width, $height) / min($width, $height) > self::CROP_LIMIT) {
            self::backdrop($canvas);
            $scale = self::SIZE / max($width, $height);
            $fitWidth = (int) round($width * $scale);
            $fitHeight = (int) round($height * $scale);
            imagecopyresampled($canvas, $photo, intdiv(self::SIZE - $fitWidth, 2), intdiv(self::SIZE - $fitHeight, 2), 0, 0, $fitWidth, $fitHeight, $width, $height);
        }
        imageinterlace($canvas, true);

        ob_start();
        imagejpeg($canvas, null, self::QUALITY);
        $jpeg = (string) ob_get_clean();

        return $jpeg !== '' ? $jpeg : null;
    }

    /** Fills the square with the photo cropped at the centre. */
    private static function cover(GdImage $canvas, GdImage $photo, int $width, int $height): void
    {
        $side = min($width, $height);
        imagecopyresampled($canvas, $photo, 0, 0, intdiv($width - $side, 2), intdiv($height - $side, 2), self::SIZE, self::SIZE, $side, $side);
    }

    /** Turns the cropped photo into a soft, darkened backdrop; blurring small copies keeps it cheap. */
    private static function backdrop(GdImage $canvas): void
    {
        $small = imagecreatetruecolor(self::BLUR, self::BLUR);
        imagecopyresampled($small, $canvas, 0, 0, 0, 0, self::BLUR, self::BLUR, self::SIZE, self::SIZE);
        self::blur($small, 3);
        $middle = imagescale($small, self::BLUR * 4, self::BLUR * 4, IMG_BICUBIC) ?: $small;
        self::blur($middle, 8);
        $large = imagescale($middle, self::SIZE, self::SIZE, IMG_BICUBIC);
        if ($large) {
            imagecopy($canvas, $large, 0, 0, 0, 0, self::SIZE, self::SIZE);
        }
        imagefilledrectangle($canvas, 0, 0, self::SIZE, self::SIZE, imagecolorallocatealpha($canvas, 0, 0, 0, 80));
    }

    private static function blur(GdImage $image, int $passes): void
    {
        for ($pass = 0; $pass < $passes; $pass++) {
            imagefilter($image, IMG_FILTER_GAUSSIAN_BLUR);
        }
    }
}
