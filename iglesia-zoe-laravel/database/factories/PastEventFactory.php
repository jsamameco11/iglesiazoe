<?php

namespace Database\Factories;

use App\Models\PastEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PastEvent>
 */
class PastEventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->randomElement(['Día de la Madre', 'Noche de Hombres', 'Aniversario', 'Retiro de Jóvenes']),
            'held_on' => fake()->dateTimeBetween('-1 year', '-1 week')->format('Y-m-d'),
            'image_path' => null,
            'url' => 'https://www.instagram.com/p/'.fake()->bothify('C??##??##?'),
            'active' => true,
        ];
    }

    public function hidden(): static
    {
        return $this->state(fn (array $attributes) => ['active' => false]);
    }
}
