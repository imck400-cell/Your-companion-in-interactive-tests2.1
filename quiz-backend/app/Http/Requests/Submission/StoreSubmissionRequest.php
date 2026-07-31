<?php

namespace App\Http\Requests\Submission;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\Quiz;

class StoreSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $quizId = $this->input('quiz_id');

        if ($quizId) {
            $quiz = Quiz::find($quizId);
            if ($quiz && $user && $user->school_id) {
                // Multi-tenant check: Verify student/user belongs to the same school as the quiz
                if ($quiz->school_id && $quiz->school_id != $user->school_id) {
                    return false;
                }
            }
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'quiz_id' => ['required', 'exists:quizzes,id'],
            'student_name' => ['required', 'string', 'max:100'], // Strict max length: 100 characters for student name
            'serial_number' => ['nullable', 'string', 'max:50'],
            'grade' => ['nullable', 'string', 'max:50'],
            'section' => ['nullable', 'string', 'max:50'],
            'school_name' => ['nullable', 'string', 'max:150'],
            'teacher_name' => ['nullable', 'string', 'max:100'],
            'score' => ['required', 'numeric', 'min:0'],
            'max_score' => ['required', 'numeric', 'min:0'],
            'percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'passed' => ['required', 'boolean'],
            'correct_count' => ['integer', 'min:0'],
            'incorrect_count' => ['integer', 'min:0'],
            'skipped_count' => ['integer', 'min:0'],
            'total_time_spent_seconds' => ['integer', 'min:0'],
            'details' => ['required', 'array'], // JSON breakdown
            'guest_device_uuid' => ['nullable', 'string', 'max:100'],
        ];
    }
}
