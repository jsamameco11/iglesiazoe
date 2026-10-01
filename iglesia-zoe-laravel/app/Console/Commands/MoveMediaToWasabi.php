<?php

namespace App\Console\Commands;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\SiteSetting;
use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\File;
use Symfony\Component\Mime\MimeTypes;

class MoveMediaToWasabi extends Command
{
    protected $signature = 'zoe:media-to-wasabi {--dry-run : Solo muestra lo que haría}';

    protected $description = 'Sube a Wasabi las fotos, videos y archivos que siguen en el servidor y actualiza sus referencias.';

    /** Local folder => [disk, key prefix]. */
    private function sources(): array
    {
        return [
            public_path('images') => ['wasabi', 'images'],
            public_path('videos') => ['wasabi', 'videos'],
            storage_path('app/public/medios') => ['wasabi', 'medios'],
            storage_path('app/public/generosidad') => ['wasabi', 'generosidad'],
            storage_path('app/public/temas') => ['wasabi-private', 'temas'],
            storage_path('app/public/informes') => ['wasabi-private', 'informes'],
            storage_path('app/private/gastos') => ['wasabi-private', 'gastos'],
        ];
    }

    public function handle(): int
    {
        if (! MediaLibrary::cloud()) {
            $this->error('Wasabi no está configurado (WASABI_BUCKET y sus claves en .env).');

            return self::FAILURE;
        }
        $dry = (bool) $this->option('dry-run');
        $uploaded = 0;
        $skipped = 0;

        foreach ($this->sources() as $folder => [$disk, $prefix]) {
            if (! is_dir($folder)) {
                continue;
            }
            $target = MediaLibrary::{$disk === 'wasabi' ? 'publicDisk' : 'privateDisk'}();
            foreach (File::allFiles($folder) as $file) {
                $key = $prefix.'/'.str_replace('\\', '/', $file->getRelativePathname());
                if ($target->exists($key) && $target->size($key) === $file->getSize()) {
                    $skipped++;

                    continue;
                }
                $this->line(($dry ? '[prueba] ' : '').$disk.': '.$key.' ('.number_format($file->getSize() / 1048576, 1).' MB)');
                if (! $dry) {
                    $this->upload($target, $key, $file->getRealPath(), $disk === 'wasabi');
                }
                $uploaded++;
            }
        }

        $rewritten = $dry ? 0 : $this->rewriteReferences();
        LoadPublicSite::flush();
        $this->info("Subidos: $uploaded · Ya estaban: $skipped · Referencias actualizadas: $rewritten");

        return self::SUCCESS;
    }

    private function upload(Filesystem $disk, string $key, string $path, bool $public): void
    {
        $stream = fopen($path, 'rb');
        $disk->writeStream($key, $stream, [
            'visibility' => $public ? 'public' : 'private',
            'ContentType' => MimeTypes::getDefault()->guessMimeType($path) ?: 'application/octet-stream',
            'CacheControl' => $public ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
        ]);
        if (is_resource($stream)) {
            fclose($stream);
        }
    }

    /** Site settings stored "/storage/<key>" for local uploads; those now live at "/media/<key>". */
    private function rewriteReferences(): int
    {
        $count = 0;
        foreach (['site', 'media'] as $name) {
            $row = SiteSetting::query()->where('key', $name)->first();
            if (! $row || ! is_array($row->value)) {
                continue;
            }
            $value = $row->value;
            array_walk_recursive($value, function (&$item) use (&$count) {
                if (is_string($item) && preg_match('#^(https?://[^/]+)?/storage/((medios|generosidad)/.+)$#', $item, $match)) {
                    $item = MediaLibrary::PUBLIC_PREFIX.$match[2];
                    $count++;
                }
            });
            if ($value !== $row->value) {
                $row->forceFill(['value' => $value, 'updated_at' => now()])->save();
            }
        }

        return $count;
    }
}
