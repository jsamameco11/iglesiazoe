<?php

namespace App\Models;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Shared\Models\UuidModel;
use Illuminate\Support\Str;

class Theme extends UuidModel
{
    protected $fillable = ['title', 'audience', 'theme_date', 'file_path', 'active'];

    protected function casts(): array
    {
        return [
            'theme_date' => 'date',
            'active' => 'boolean',
        ];
    }

    /** Payload for the theme lists, with a short-lived link to the file. */
    public function card(): array
    {
        $date = optional($this->theme_date)->toDateString();
        $type = $this->file_path ? strtoupper(pathinfo($this->file_path, PATHINFO_EXTENSION)) : null;
        $name = Str::slug(($date ? $date.' ' : '').$this->title).($type ? '.'.strtolower($type) : '');

        return [
            'id' => $this->id,
            'title' => $this->title,
            'audience' => $this->audience,
            'theme_date' => $date,
            'file_type' => $type,
            'file_url' => MediaLibrary::privateUrl($this->file_path, 180),
            'download_url' => MediaLibrary::privateUrl($this->file_path, 180, $name),
        ];
    }
}
