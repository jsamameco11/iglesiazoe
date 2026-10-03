<?php

namespace App\Models;

use App\Domain\Site\Actions\LoadPublicSite;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A public page as named on the site: menu, mobile menu, footer, page label and back links all read this row. */
class SitePage extends Model
{
    protected static function booted(): void
    {
        static::saved(fn () => LoadPublicSite::flush());
        static::deleted(fn () => LoadPublicSite::flush());
    }

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'parent_key', 'path', 'name', 'note', 'kicker', 'sort_order'];

    /** @return HasMany<SiteSection, $this> */
    public function sections(): HasMany
    {
        return $this->hasMany(SiteSection::class, 'page_key', 'key')->orderBy('sort_order');
    }
}
