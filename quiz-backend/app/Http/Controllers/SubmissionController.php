<?php

namespace App\Http\Controllers;

use App\Http\Requests\Submission\StoreSubmissionRequest;
use App\Models\Submission;
use App\Models\Quiz;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubmissionController extends Controller
{
    /**
     * Display a listing of submissions filtered by school_id.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Submission::with('quiz');

        // Multi-tenant check
        if ($user && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }

        if ($request->has('quiz_id')) {
            $query->where('quiz_id', $request->input('quiz_id'));
        }

        if ($request->has('serial_number')) {
            $query->where('serial_number', $request->input('serial_number'));
        }

        $submissions = $query->orderBy('submitted_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'count' => $submissions->count(),
            'data' => $submissions
        ]);
    }

    /**
     * Store or update a submitted quiz response with Deduplication protection.
     * Uses updateOrCreate on (quiz_id, student_id or serial_number) to prevent duplicates.
     */
    public function store(StoreSubmissionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        $quiz = Quiz::findOrFail($validated['quiz_id']);

        $submissionData = $validated;
        $submissionData['quiz_title'] = $quiz->title;
        $submissionData['student_id'] = $user?->id;
        $submissionData['school_id'] = $quiz->school_id ?? $user?->school_id;
        $submissionData['teacher_id'] = $quiz->teacher_id;
        $submissionData['submitted_at'] = $validated['submitted_at'] ?? now();

        // Search keys for deduplication
        $searchAttributes = [
            'quiz_id' => $quiz->id,
        ];

        if (!empty($submissionData['student_id'])) {
            $searchAttributes['student_id'] = $submissionData['student_id'];
        } elseif (!empty($submissionData['serial_number'])) {
            $searchAttributes['serial_number'] = $submissionData['serial_number'];
        } else {
            $searchAttributes['guest_device_uuid'] = $submissionData['guest_device_uuid'] ?? 'unknown_device';
        }

        // Deduplication updateOrCreate
        $submission = Submission::updateOrCreate(
            $searchAttributes,
            $submissionData
        );

        return response()->json([
            'status' => 'success',
            'message' => 'تم حفظ результат الاختبار بنجاح وتم منع التكرار',
            'data' => $submission
        ], 200);
    }

    /**
     * Batch Sync Offline Submissions Queue in a Single Transaction.
     * Guarantees atomic save or rollback.
     */
    public function syncOfflineSubmissions(Request $request): JsonResponse
    {
        $request->validate([
            'submissions' => 'required|array|min:1',
            'submissions.*.quiz_id' => 'required|exists:quizzes,id',
            'submissions.*.student_name' => 'required|string|max:100',
            'submissions.*.score' => 'required|numeric|min:0',
            'submissions.*.max_score' => 'required|numeric|min:0',
            'submissions.*.details' => 'required|array',
        ]);

        $user = $request->user();
        $items = $request->input('submissions');

        $savedSubmissions = DB::transaction(function () use ($items, $user) {
            $synced = [];

            foreach ($items as $item) {
                $quiz = Quiz::find($item['quiz_id']);
                if (!$quiz) continue;

                $itemData = $item;
                $itemData['quiz_title'] = $quiz->title;
                $itemData['student_id'] = $user?->id;
                $itemData['school_id'] = $quiz->school_id ?? $user?->school_id;
                $itemData['teacher_id'] = $quiz->teacher_id;
                $itemData['submitted_at'] = $item['submitted_at'] ?? now();

                $searchKeys = [
                    'quiz_id' => $quiz->id,
                ];

                if (!empty($user?->id)) {
                    $searchKeys['student_id'] = $user->id;
                } elseif (!empty($item['serial_number'])) {
                    $searchKeys['serial_number'] = $item['serial_number'];
                } elseif (!empty($item['guest_device_uuid'])) {
                    $searchKeys['guest_device_uuid'] = $item['guest_device_uuid'];
                } else {
                    $searchKeys['student_name'] = $item['student_name'];
                }

                $record = Submission::updateOrCreate($searchKeys, $itemData);
                $synced[] = $record;
            }

            return $synced;
        });

        return response()->json([
            'status' => 'success',
            'message' => 'تمت مزامنة طابور الإجابات بنجاح بدون تكرار',
            'synced_count' => count($savedSubmissions),
            'data' => $savedSubmissions
        ]);
    }

    /**
     * Display the specified submission.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $submission = Submission::with('quiz')->find($id);

        if (!$submission) {
            return response()->json(['status' => 'error', 'message' => 'نتيجة الاختبار غير موجودة'], 404);
        }

        if ($user && $user->school_id && $submission->school_id && $submission->school_id != $user->school_id) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح'], 403);
        }

        return response()->json([
            'status' => 'success',
            'data' => $submission
        ]);
    }
}
