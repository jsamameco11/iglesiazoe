<?php

namespace Database\Factories;

use App\Models\LiveStream;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LiveStream>
 */
class LiveStreamFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => 'Reunión de domingo · '.fake()->words(3, true),
            'description' => fake()->sentence(12),
            'preacher' => fake()->name(),
            'kind' => 'predica',
            'show_summary' => true,
            'to_youtube' => false,
            'options' => ['privacy' => 'public'],
            'status' => 'ready',
        ];
    }

    public function live(): static
    {
        return $this->state(fn () => [
            'status' => 'live',
            'signal_at' => now()->subMinutes(20),
            'started_at' => now()->subMinutes(20),
        ]);
    }

    public function toYouTube(string $videoId = 'AbCdEfGhIjK'): static
    {
        return $this->state(fn () => ['to_youtube' => true, 'youtube_id' => $videoId, 'youtube_mode' => 'api']);
    }
}
