<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quiz extends Model
{
    use HasFactory;

    protected $fillable = [
        'school_id',
        'teacher_id',
        'title',
        'lesson_number',
        'subject',
        'main_subject',
        'sub_subject',
        'grade',
        'section',
        'class_level',
        'teacher_name',
        'owner_teacher_code',
        'school_name',
        'branch',
        'academic_year',
        'visibility',
        'show_feedback',
        'time_limit_minutes',
        'pass_percentage',
        'allow_answer_change',
        'allow_full_quiz_retake',
        'is_archived',
    ];

    protected $casts = [
        'time_limit_minutes' => 'integer',
        'pass_percentage' => 'integer',
        'allow_answer_change' => 'boolean',
        'allow_full_quiz_retake' => 'boolean',
        'is_archived' => 'boolean',
    ];

    /**
     * Relationship: Quiz belongs to a School.
     */
    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /**
     * Relationship: Quiz belongs to a Teacher (User).
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    /**
     * Relationship: Quiz has many Questions.
     */
    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('question_order', 'asc');
    }

    /**
     * Relationship: Quiz has many Submissions.
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }
}
