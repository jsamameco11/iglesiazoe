<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use App\Domain\Site\Actions\LoadPublicSite;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A titled section of a public page; its name is the small label shown above the section title. */
class SiteSection extends UuidModel
{
    protected static function booted(): void
    {
        static::saved(fn () => LoadPublicSite::flush());
        static::deleted(fn () => LoadPublicSite::flush());
    }

    protected $fillable = ['page_key', 'key', 'name', 'sort_order'];

    /** @return BelongsTo<SitePage, $this> */
    public function page(): BelongsTo
    {
        return $this->belongsTo(SitePage::class, 'page_key', 'key');
    }
}
