<?php

namespace Database\Factories;

use App\Models\ChurchEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ChurchEvent>
 */
class ChurchEventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->randomElement(['Retiro de Matrimonios', 'Noche de Jóvenes', 'Bautismos', 'Conferencia']),
            'starts_on' => now('America/Lima')->addDays(7)->toDateString(),
            'ends_on' => null,
            'time_label' => '7:00 p. m.',
            'location' => 'Auditorio principal',
            'active' => true,
        ];
    }

    public function on(string $date): static
    {
        return $this->state(fn (array $attributes) => ['starts_on' => $date]);
    }

    public function hidden(): static
    {
        return $this->state(fn (array $attributes) => ['active' => false]);
    }
}
