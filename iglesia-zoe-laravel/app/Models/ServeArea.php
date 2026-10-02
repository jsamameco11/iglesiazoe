<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class ServeArea extends UuidModel
{
    protected $fillable = ['slug', 'name', 'tagline', 'summary', 'body', 'teams', 'image_path', 'cta_label', 'cta_url', 'accepts_volunteers', 'sort_order', 'active'];

    protected function casts(): array
    {
        return [
            'teams' => 'array',
            'accepts_volunteers' => 'boolean',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'tagline' => $this->tagline,
            'summary' => $this->summary,
            'body' => $this->body,
            'teams' => array_values($this->teams ?? []),
            'image' => $this->image_path,
            'cta_label' => $this->cta_label,
            'cta_url' => $this->cta_url,
            'accepts_volunteers' => $this->accepts_volunteers ?? true,
            'active' => $this->active,
        ];
    }
}
