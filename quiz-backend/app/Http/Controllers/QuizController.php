<?php

namespace App\Http\Controllers;

use App\Http\Requests\Quiz\StoreQuizRequest;
use App\Models\Quiz;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuizController extends Controller
{
    /**
     * Display a listing of quizzes with Eager Loading (Quiz::with('questions'))
     * to eliminate the N+1 query problem and enforce school_id isolation.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Quiz::with('questions'); // Eager loading prevents N+1 query issues

        // Multi-tenant Isolation: Filter quizzes by school_id if available
        if ($user && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }

        // Optional filters
        if ($request->has('grade')) {
            $query->where('grade', $request->input('grade'));
        }
        if ($request->has('subject')) {
            $query->where('subject', $request->input('subject'));
        }
        if ($request->has('is_archived')) {
            $query->where('is_archived', filter_var($request->input('is_archived'), FILTER_VALIDATE_BOOLEAN));
        }

        $quizzes = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'count' => $quizzes->count(),
            'data' => $quizzes
        ]);
    }

    /**
     * Store a newly created quiz with its questions in a database transaction.
     */
    public function store(StoreQuizRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        $quizData = collect($validated)->except('questions')->toArray();
        $quizData['school_id'] = $user->school_id ?? $request->input('school_id');
        $quizData['teacher_id'] = $user->id;

        $quiz = DB::transaction(function () use ($quizData, $validated) {
            $createdQuiz = Quiz::create($quizData);

            $questionsData = [];
            foreach ($validated['questions'] as $index => $q) {
                $questionsData[] = [
                    'quiz_id' => $createdQuiz->id,
                    'question_order' => $index + 1,
                    'type' => $q['type'],
                    'question_text' => $q['question_text'],
                    'options' => isset($q['options']) ? json_encode($q['options']) : null,
                    'correct_answer' => $q['correct_answer'] ?? null,
                    'matching_pairs' => isset($q['matching_pairs']) ? json_encode($q['matching_pairs']) : null,
                    'classification' => isset($q['classification']) ? json_encode($q['classification']) : null,
                    'points' => $q['points'] ?? 1.0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            Question::insert($questionsData);

            return $createdQuiz->load('questions');
        });

        return response()->json([
            'status' => 'success',
            'message' => 'تم إنشاء الاختبار بنجاح',
            'data' => $quiz
        ], 201);
    }

    /**
     * Display the specified quiz with its questions (Eager Loaded).
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $quiz = Quiz::with('questions')->find($id);

        if (!$quiz) {
            return response()->json(['status' => 'error', 'message' => 'الاختبار غير موجود'], 404);
        }

        // Multi-tenant check
        if ($user && $user->school_id && $quiz->school_id && $quiz->school_id != $user->school_id) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح بالوصول لهذا الاختبار'], 403);
        }

        return response()->json([
            'status' => 'success',
            'data' => $quiz
        ]);
    }

    /**
     * Update the specified quiz.
     */
    public function update(StoreQuizRequest $request, int $id): JsonResponse
    {
        $user = $request->user();
        $quiz = Quiz::find($id);

        if (!$quiz) {
            return response()->json(['status' => 'error', 'message' => 'الاختبار غير موجود'], 404);
        }

        // Multi-tenant isolation check
        if ($user && $user->school_id && $quiz->school_id && $quiz->school_id != $user->school_id) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح لك بتعديل هذا الاختبار'], 403);
        }

        $validated = $request->validated();
        $quizData = collect($validated)->except('questions')->toArray();

        DB::transaction(function () use ($quiz, $quizData, $validated) {
            $quiz->update($quizData);

            // Re-create questions
            $quiz->questions()->delete();

            $questionsData = [];
            foreach ($validated['questions'] as $index => $q) {
                $questionsData[] = [
                    'quiz_id' => $quiz->id,
                    'question_order' => $index + 1,
                    'type' => $q['type'],
                    'question_text' => $q['question_text'],
                    'options' => isset($q['options']) ? json_encode($q['options']) : null,
                    'correct_answer' => $q['correct_answer'] ?? null,
                    'matching_pairs' => isset($q['matching_pairs']) ? json_encode($q['matching_pairs']) : null,
                    'classification' => isset($q['classification']) ? json_encode($q['classification']) : null,
                    'points' => $q['points'] ?? 1.0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            Question::insert($questionsData);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'تم تحديث الاختبار بنجاح',
            'data' => $quiz->load('questions')
        ]);
    }

    /**
     * Remove the specified quiz permanently (No Soft Deletes).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $quiz = Quiz::find($id);

        if (!$quiz) {
            return response()->json(['status' => 'error', 'message' => 'الاختبار غير موجود'], 404);
        }

        if ($user && $user->school_id && $quiz->school_id && $quiz->school_id != $user->school_id) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح'], 403);
        }

        $quiz->delete(); // Hard delete

        return response()->json([
            'status' => 'success',
            'message' => 'تم حذف الاختبار نهائياً بنجاح'
        ]);
    }

    /**
     * Get subjects and branches for student's school
     */
    public function mySchoolSubjects(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolId = $user->school_id ?? null;
        $schoolName = $request->input('school_name') ?? ($user->school_name ?? null);

        $query = Quiz::query();

        if ($schoolId) {
            $query->where('school_id', $schoolId);
        } elseif ($schoolName) {
            $query->where('school_name', $schoolName);
        }

        if ($request->has('grade')) {
            $query->where('grade', $request->input('grade'));
        }

        $quizzes = $query->select('subject', 'main_subject', 'sub_subject', 'branch')
            ->distinct()
            ->get();

        $subjectsMap = [];
        foreach ($quizzes as $q) {
            $subj = $q->subject ?: ($q->main_subject ?: 'المادة العامة');
            $branch = $q->sub_subject ?: ($q->branch ?: 'جميع الفروع');

            if (!isset($subjectsMap[$subj])) {
                $subjectsMap[$subj] = [];
            }
            if (!in_array($branch, $subjectsMap[$subj])) {
                $subjectsMap[$subj][] = $branch;
            }
        }

        $formatted = [];
        foreach ($subjectsMap as $subj => $branches) {
            $formatted[] = [
                'subject' => $subj,
                'branches' => array_values($branches),
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => $formatted
        ]);
    }

    /**
     * Get general quizzes grouped by grade -> subject -> sub_subject -> ordered by lesson_number
     */
    public function generalGrouped(Request $request): JsonResponse
    {
        $quizzes = Quiz::where(function ($q) {
                $q->where('visibility', 'public')
                  ->orWhereNull('visibility');
            })
            ->where('is_archived', false)
            ->orderBy('grade', 'asc')
            ->orderBy('subject', 'asc')
            ->orderBy('sub_subject', 'asc')
            ->orderBy('lesson_number', 'asc')
            ->get();

        $grouped = [];
        foreach ($quizzes as $quiz) {
            $grade = $quiz->grade ?: ($quiz->class_level ?: 'جميع الصفوف');
            $subject = $quiz->subject ?: ($quiz->main_subject ?: 'مادة عامة');
            $subSubject = $quiz->sub_subject ?: ($quiz->branch ?: 'فرع عام');

            if (!isset($grouped[$grade])) {
                $grouped[$grade] = [];
            }
            if (!isset($grouped[$grade][$subject])) {
                $grouped[$grade][$subject] = [];
            }
            if (!isset($grouped[$grade][$subject][$subSubject])) {
                $grouped[$grade][$subject][$subSubject] = [];
            }

            $grouped[$grade][$subject][$subSubject][] = $quiz;
        }

        return response()->json([
            'status' => 'success',
            'data' => $grouped
        ]);
    }
}
