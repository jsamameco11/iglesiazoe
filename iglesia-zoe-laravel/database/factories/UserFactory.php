<?php

namespace Database\Factories;

use App\Domain\Shared\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'username' => fake()->unique()->userName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'role' => 'cell_leader',
            'remember_token' => Str::random(10),
        ];
    }

    public function superadmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => Role::Superadmin,
            'active' => true,
        ]);
    }

    /**
     * A panel administrator with these account types and functions, optionally created by another account.
     *
     * @param  list<string>  $types
     * @param  list<string>  $permissions
     */
    public function administrator(array $types, array $permissions, ?User $creator = null): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => $permissions,
            'active' => true,
            'created_by' => $creator?->id,
        ]);
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
