<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class School extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'branch',
        'activation_year',
        'is_active',
        'status',
        'subscription_end_date',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'subscription_end_date' => 'datetime',
    ];

    /**
     * Relationship: A school has many registered users (students, teachers, admins).
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Relationship: A school has many created quizzes.
     */
    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class);
    }

    /**
     * Relationship: A school has many quiz submissions.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }
}
