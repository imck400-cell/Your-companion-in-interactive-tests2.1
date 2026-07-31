<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'school_id',
        'name',
        'role',
        'school_name',
        'branch',
        'grade',
        'section',
        'serial_number',
        'code',
        'email',
        'password',
        'active_session_id',
        'last_activity_at',
        'public_ref_id',
        'subscription_end_date',
        'is_suspended',
        'is_unauthorized',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'is_suspended' => 'boolean',
        'is_unauthorized' => 'boolean',
        'last_activity_at' => 'integer',
        'subscription_end_date' => 'datetime',
    ];

    /**
     * Relationship: User belongs to a School.
     */
    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /**
     * Relationship: Teacher has many created quizzes.
     */
    public function quizzes(): HasMany
    {
        return $this->hasMany(Quiz::class, 'teacher_id');
    }

    /**
     * Relationship: Student has many test submissions.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class, 'student_id');
    }
}
