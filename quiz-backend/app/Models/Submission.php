<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Submission extends Model
{
    use HasFactory;

    protected $fillable = [
        'quiz_id',
        'student_id',
        'school_id',
        'teacher_id',
        'quiz_title',
        'student_name',
        'serial_number',
        'grade',
        'section',
        'school_name',
        'teacher_name',
        'score',
        'max_score',
        'percentage',
        'passed',
        'correct_count',
        'incorrect_count',
        'skipped_count',
        'total_time_spent_seconds',
        'details',
        'submitted_at',
        'guest_device_uuid',
    ];

    /**
     * Cast JSON columns and numbers to appropriate types.
     */
    protected $casts = [
        'details' => 'array',
        'score' => 'float',
        'max_score' => 'float',
        'percentage' => 'float',
        'passed' => 'boolean',
        'correct_count' => 'integer',
        'incorrect_count' => 'integer',
        'skipped_count' => 'integer',
        'total_time_spent_seconds' => 'integer',
        'submitted_at' => 'datetime',
    ];

    /**
     * Relationship: Submission belongs to a Quiz.
     */
    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    /**
     * Relationship: Submission belongs to a Student (User).
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * Relationship: Submission belongs to a School.
     */
    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /**
     * Relationship: Submission belongs to a Teacher (User).
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }
}
