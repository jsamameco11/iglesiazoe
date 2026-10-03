<?php

use App\Domain\Site\Actions\SyncSitePages;
use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Copy keys (Textos por página) whose value becomes a page name, menu note or page label.
     *
     * @var array<string, array<string, string>>
     */
    private const PAGE_COPY = [
        'home' => ['name' => 'nav.home'],
        'about' => ['name' => 'nav.about', 'note' => 'nav.aboutNote'],
        'ministries' => ['name' => 'nav.ministries', 'note' => 'nav.ministriesNote', 'kicker' => 'ministries.kicker'],
        'serve' => ['name' => 'nav.serve', 'note' => 'nav.areasNote', 'kicker' => 'serve.kicker'],
        'register' => ['name' => 'nav.register', 'note' => 'nav.registerNote'],
        'baptism' => ['name' => 'nav.baptism', 'note' => 'nav.baptismNote', 'kicker' => 'baptism.kicker'],
        'studies' => ['name' => 'nav.studies'],
        'route' => ['name' => 'nav.route', 'note' => 'nav.routeNote', 'kicker' => 'route.kicker'],
        'classroom' => ['name' => 'nav.studentAccess', 'note' => 'nav.studentAccessNote'],
        'events' => ['name' => 'nav.events', 'note' => 'nav.eventsNote', 'kicker' => 'events.kicker'],
        'resources' => ['name' => 'nav.resources'],
        'gallery' => ['name' => 'nav.gallery', 'note' => 'nav.galleryNote', 'kicker' => 'gallery.kicker'],
        'devotionals' => ['name' => 'nav.devotionals', 'note' => 'nav.devotionalsNote', 'kicker' => 'devotionals.kicker'],
        'sermons' => ['name' => 'nav.sermons', 'note' => 'nav.sermonsNote', 'kicker' => 'sermons.kicker'],
        'teachings' => ['name' => 'nav.teachings', 'note' => 'nav.teachingsNote', 'kicker' => 'teachings.kicker'],
        'radio' => ['name' => 'nav.radio', 'note' => 'nav.radioNote'],
        'contact' => ['name' => 'nav.prayer', 'note' => 'nav.prayerNote', 'kicker' => 'contact.kicker'],
        'give' => ['name' => 'nav.give', 'note' => 'nav.giveNote', 'kicker' => 'give.kicker'],
        'visit' => ['kicker' => 'visit.kicker'],
    ];

    /**
     * Copy keys whose value becomes a section name.
     *
     * @var array<string, array<string, string>>
     */
    private const SECTION_COPY = [
        'home' => ['essence' => 'home.essenceKicker', 'cells' => 'home.cellsKicker', 'generations' => 'home.generationsKicker', 'events' => 'home.eventsKicker', 'resources' => 'home.resourcesKicker', 'visit' => 'home.visitKicker'],
        'about' => ['pastors' => 'about.pastorsKicker', 'history' => 'about.historyKicker', 'vision' => 'about.visionKicker', 'values' => 'about.valuesKicker', 'first' => 'about.firstKicker'],
        'serve' => ['why' => 'serve.whyKicker', 'areas' => 'serve.areasKicker', 'teams' => 'serve.teamsKicker', 'form' => 'serve.formKicker', 'also' => 'serve.alsoKicker'],
        'baptism' => ['form' => 'baptism.formKicker', 'video' => 'baptism.videoKicker', 'gallery' => 'baptism.galleryKicker'],
        'route' => ['levels' => 'route.levelsKicker', 'access' => 'route.accessKicker'],
        'teachings' => ['more' => 'teachings.more'],
        'contact' => ['prayer' => 'prayer.kicker', 'form' => 'contact.formKicker', 'visit' => 'contact.visitKicker'],
        'give' => ['ways' => 'give.waysKicker'],
        'visit' => ['form' => 'visit.formKicker', 'contact' => 'visit.contactKicker'],
    ];

    /** Copies of a page name that now read the page itself (back links, footer and the second Involúcrate label). */
    private const RETIRED_COPY = ['ministries.back', 'serve.back', 'gallery.back', 'devotionals.back', 'footer.give', 'nav.areas'];

    /** Main-text settings that were a page name or label. */
    private const PAGE_SETTINGS = ['about' => ['kicker' => 'aboutKicker'], 'visit' => ['name' => 'visitCta']];

    public function up(): void
    {
        Schema::create('site_pages', function (Blueprint $table) {
            $table->string('key', 40)->primary();
            $table->string('parent_key', 40)->nullable();
            $table->string('path', 120);
            $table->string('name', 80);
            $table->string('note', 120)->default('');
            $table->string('kicker', 80)->default('');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('parent_key')->references('key')->on('site_pages')->nullOnDelete();
        });

        Schema::create('site_sections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('page_key', 40);
            $table->string('key', 40);
            $table->string('name', 80);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['page_key', 'key']);
            $table->foreign('page_key')->references('key')->on('site_pages')->cascadeOnDelete();
        });

        $site = SiteSetting::query()->find('site');
        $stored = is_array($site?->value) ? $site->value : [];
        $copy = is_array($stored['copy'] ?? null) ? $stored['copy'] : [];

        SyncSitePages::run($this->editedNames($stored, $copy));

        if (! $site) {
            return;
        }
        $carried = [
            ...array_merge(...array_values(array_map('array_values', self::PAGE_COPY))),
            ...array_merge(...array_values(array_map('array_values', self::SECTION_COPY))),
            ...self::RETIRED_COPY,
        ];
        $stored['copy'] = array_diff_key($copy, array_flip($carried));
        foreach (self::PAGE_SETTINGS as $fields) {
            foreach ($fields as $setting) {
                unset($stored[$setting]);
            }
        }
        $site->value = $stored;
        $site->updated_at = now();
        $site->save();
    }

    public function down(): void
    {
        // The carried texts stay out of Textos por página; the pages fall back to their defaults.
        Schema::dropIfExists('site_sections');
        Schema::dropIfExists('site_pages');
    }

    /**
     * @param  array<string, mixed>  $stored
     * @param  array<string, mixed>  $copy
     * @return array<string, array{name?: string, note?: string, kicker?: string, sections?: array<string, string>}>
     */
    private function editedNames(array $stored, array $copy): array
    {
        $filled = fn (mixed $value) => is_string($value) && trim($value) !== '' ? mb_substr(trim($value), 0, 80) : null;
        $names = [];

        foreach (self::PAGE_COPY as $page => $fields) {
            foreach ($fields as $field => $key) {
                if ($value = $filled($copy[$key] ?? null)) {
                    $names[$page][$field] = $value;
                }
            }
        }
        foreach (self::PAGE_SETTINGS as $page => $fields) {
            foreach ($fields as $field => $setting) {
                if ($value = $filled($stored[$setting] ?? null)) {
                    $names[$page][$field] = $value;
                }
            }
        }
        foreach (self::SECTION_COPY as $page => $sections) {
            foreach ($sections as $section => $key) {
                if ($value = $filled($copy[$key] ?? null)) {
                    $names[$page]['sections'][$section] = $value;
                }
            }
        }

        return $names;
    }
};
