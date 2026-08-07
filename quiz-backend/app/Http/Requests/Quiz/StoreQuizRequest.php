<?php

namespace App\Http\Requests\Quiz;

use Illuminate\Foundation\Http\FormRequest;

class StoreQuizRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user) {
            return false;
        }

        // Multi-tenant check: Request school_id must match authenticated user's school_id
        if ($this->has('school_id') && $this->input('school_id') != $user->school_id) {
            return false;
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'lesson_number' => ['nullable', 'integer', 'min:1', 'max:50'],
            'subject' => ['required', 'string', 'max:100'],
            'main_subject' => ['nullable', 'string', 'max:100'],
            'sub_subject' => ['nullable', 'string', 'max:100'],
            'grade' => ['nullable', 'string', 'max:50'],
            'section' => ['nullable', 'string', 'max:50'],
            'class_level' => ['nullable', 'string', 'max:50'],
            'teacher_name' => ['nullable', 'string', 'max:100'], // Max 100 length limit
            'owner_teacher_code' => ['nullable', 'string', 'max:50'],
            'school_name' => ['nullable', 'string', 'max:150'],
            'branch' => ['nullable', 'string', 'max:100'],
            'academic_year' => ['nullable', 'string', 'max:50'],
            'visibility' => ['required', 'in:public,private'],
            'show_feedback' => ['required', 'in:immediate,end'],
            'time_limit_minutes' => ['integer', 'min:0', 'max:600'],
            'pass_percentage' => ['integer', 'min:0', 'max:100'],
            'allow_answer_change' => ['boolean'],
            'allow_full_quiz_retake' => ['boolean'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.type' => ['required', 'string', 'max:50'],
            'questions.*.question_text' => ['required', 'string', 'max:2000'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.correct_answer' => ['nullable', 'string', 'max:2000'],
            'questions.*.matching_pairs' => ['nullable', 'array'],
            'questions.*.classification' => ['nullable', 'array'],
            'questions.*.points' => ['numeric', 'min:0.1', 'max:100'],
        ];
    }
}
