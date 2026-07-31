<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Question extends Model
{
    use HasFactory;

    protected $fillable = [
        'quiz_id',
        'question_order',
        'type',
        'question_text',
        'options',
        'correct_answer',
        'matching_pairs',
        'classification',
        'drawing_prompt',
        'explanation',
        'points',
    ];

    /**
     * Cast JSON columns to native PHP array automatically.
     */
    protected $casts = [
        'options' => 'array',
        'matching_pairs' => 'array',
        'classification' => 'array',
        'points' => 'float',
        'question_order' => 'integer',
    ];

    /**
     * Relationship: Question belongs to a Quiz.
     */
    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }
}
