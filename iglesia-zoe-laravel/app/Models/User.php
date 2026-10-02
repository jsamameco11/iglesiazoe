<?php

namespace App\Models;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'username', 'dni', 'role', 'network_id', 'admin_types', 'permissions', 'active', 'created_by', 'inbox_seen', 'push_muted'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'admin_types' => 'array',
            'permissions' => 'array',
            'active' => 'boolean',
            'inbox_seen' => 'array',
            'push_muted' => 'boolean',
        ];
    }

    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }

    public function cells(): BelongsToMany
    {
        return $this->belongsToMany(Cell::class, 'user_cells');
    }

    public function isSuperadmin(): bool
    {
        return Permissions::isSuperadmin($this);
    }

    public function profilePayload(): array
    {
        return [
            'id' => (string) $this->id,
            'username' => $this->username,
            'full_name' => $this->name,
            'role' => $this->role->value,
            'network_id' => $this->network_id,
        ];
    }
}
