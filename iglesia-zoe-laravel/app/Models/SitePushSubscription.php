<?php

namespace App\Models;

use Database\Factories\SitePushSubscriptionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** A visitor's browser that receives the notifications of the public site (radio programs, live services, new sermons). */
class SitePushSubscription extends Model
{
    /** @use HasFactory<SitePushSubscriptionFactory> */
    use HasFactory;

    protected $fillable = ['endpoint', 'endpoint_hash', 'public_key', 'auth_token', 'content_encoding', 'user_agent'];
}
