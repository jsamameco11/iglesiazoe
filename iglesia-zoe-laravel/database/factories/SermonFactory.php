<?php

namespace Database\Factories;

use App\Models\Sermon;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Sermon>
 */
class SermonFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => 'Domingo · '.fake()->words(3, true),
            'preacher' => fake()->name(),
            'series' => 'Servicio dominical',
            'sermon_date' => fake()->dateTimeBetween('-2 months')->format('Y-m-d'),
            'youtube_id' => Str::random(11),
            'published' => true,
            'source' => 'manual',
        ];
    }

    /** Brought in by the channel watcher. */
    public function fromChannel(?string $videoId = null): static
    {
        return $this->state(fn () => [
            'source' => 'youtube',
            'youtube_id' => $videoId ?? Str::random(11),
            'channel' => 'Iglesia Cristiana Zoe',
            'duration' => 4411,
            'views' => 353,
            'synced_at' => now(),
        ]);
    }

    /** Found on the channel and waiting for an admin to approve it. */
    public function pending(): static
    {
        return $this->state(fn () => ['published' => false, 'pending' => true]);
    }
}
