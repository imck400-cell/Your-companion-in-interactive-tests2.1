<?php

namespace App\Http\Controllers;

use App\Models\Quiz;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Dashboard Analytics using strict SQL aggregations to prevent PHP RAM exhaustion.
     * Route: GET /api/analytics/dashboard
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolId = $request->input('school_id') ?? ($user?->school_id);
        $teacherId = $request->input('teacher_id') ?? ($user?->role === 'teacher' ? $user->id : null);

        $baseQuery = DB::table('submissions');
        
        if ($schoolId) {
            $baseQuery->where('school_id', $schoolId);
        }
        if ($teacherId) {
            $baseQuery->where('teacher_id', $teacherId);
        }

        // 1. Total Completed Quizzes (count)
        $totalQuizzes = (clone $baseQuery)->count();

        // 2. Average Performance (avg)
        $averagePerformance = (clone $baseQuery)->avg('percentage') ?? 0;

        // 3. Weak Points: Top 3 missed questions (SQL JSON_TABLE extraction)
        $whereSql = [];
        $bindings = [];
        
        if ($schoolId) {
            $whereSql[] = 'submissions.school_id = ?';
            $bindings[] = $schoolId;
        }
        if ($teacherId) {
            $whereSql[] = 'submissions.teacher_id = ?';
            $bindings[] = $teacherId;
        }
        $whereSql[] = 'jt.isCorrect = false';
        
        $whereClause = 'WHERE ' . implode(' AND ', $whereSql);

        $weakPointsSql = "
            SELECT jt.questionText, COUNT(*) as mistakes_count
            FROM submissions, 
            JSON_TABLE(submissions.details, '$[*]' COLUMNS (
                isCorrect BOOLEAN PATH '$.isCorrect',
                questionText VARCHAR(1000) PATH '$.questionText'
            )) AS jt
            {$whereClause}
            GROUP BY jt.questionText
            ORDER BY mistakes_count DESC
            LIMIT 3
        ";
        
        try {
            $weakPoints = DB::select($weakPointsSql, $bindings);
        } catch (\Exception $e) {
            // Fallback for older MySQL/MariaDB versions that do not support JSON_TABLE
            $weakPoints = [];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_completed' => $totalQuizzes,
                'average_performance' => round((float)$averagePerformance, 1),
                'weak_points' => $weakPoints,
            ]
        ]);
    }

    /**
     * Get Top 5 failed/unsolved questions and Top 5 highest performing students.
     * Route: GET /api/analytics/top-performance
     */
    public function topPerformance(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolId = $request->input('school_id') ?? ($user?->school_id);
        $schoolName = $request->input('school_name') ?? ($user?->school_name);
        $teacherId = $request->input('teacher_id') ?? ($user?->role === 'teacher' ? $user->id : null);

        // 1. Build Base Submissions Query
        $subQuery = Submission::query();

        if ($schoolId) {
            $subQuery->where('school_id', $schoolId);
        } elseif ($schoolName) {
            $subQuery->where('school_name', $schoolName);
        }

        if ($teacherId) {
            $subQuery->where('teacher_id', $teacherId);
        }

        if ($request->has('grade') && $request->input('grade') !== 'ALL') {
            $subQuery->where('grade', $request->input('grade'));
        }

        $submissions = $subQuery->orderBy('submitted_at', 'desc')->get();

        // 2. Process Questions Failure Stats from JSON `details`
        $questionStats = [];

        foreach ($submissions as $sub) {
            $details = $sub->details;
            if (!is_array($details)) {
                continue;
            }

            foreach ($details as $idx => $item) {
                if (!is_array($item)) {
                    continue;
                }

                $qId = $item['question_id'] ?? $item['id'] ?? $item['questionId'] ?? ($sub->quiz_id . '_' . $idx);
                $qText = $item['question_text'] ?? $item['text'] ?? $item['title'] ?? ('سؤال #' . ($idx + 1));
                $quizTitle = $sub->quiz_title ?? ($sub->quiz?->title ?? 'اختبار عام');

                $isCorrect = false;
                if (isset($item['is_correct'])) {
                    $isCorrect = (bool)$item['is_correct'];
                } elseif (isset($item['correct'])) {
                    $isCorrect = (bool)$item['correct'];
                } elseif (isset($item['status'])) {
                    $isCorrect = ($item['status'] === 'correct');
                }

                $isSkipped = false;
                if (isset($item['is_skipped'])) {
                    $isSkipped = (bool)$item['is_skipped'];
                } elseif (isset($item['skipped'])) {
                    $isSkipped = (bool)$item['skipped'];
                } elseif (isset($item['status']) && $item['status'] === 'skipped') {
                    $isSkipped = true;
                }

                $key = $sub->quiz_id . '_' . $qId;

                if (!isset($questionStats[$key])) {
                    $questionStats[$key] = [
                        'question_id' => $qId,
                        'question_text' => $qText,
                        'quiz_id' => $sub->quiz_id,
                        'quiz_title' => $quizTitle,
                        'total_attempts' => 0,
                        'failed_count' => 0,
                        'skipped_count' => 0,
                    ];
                }

                $questionStats[$key]['total_attempts'] += 1;
                if (!$isCorrect) {
                    $questionStats[$key]['failed_count'] += 1;
                }
                if ($isSkipped) {
                    $questionStats[$key]['skipped_count'] += 1;
                }
            }
        }

        // Calculate failure rate and sort
        $formattedQuestions = [];
        foreach ($questionStats as $qs) {
            $total = $qs['total_attempts'];
            $failed = $qs['failed_count'];
            $failureRate = $total > 0 ? round(($failed / $total) * 100, 1) : 0;

            $formattedQuestions[] = [
                'question_id' => $qs['question_id'],
                'question_text' => $qs['question_text'],
                'quiz_id' => $qs['quiz_id'],
                'quiz_title' => $qs['quiz_title'],
                'total_attempts' => $total,
                'failed_count' => $failed,
                'skipped_count' => $qs['skipped_count'],
                'failure_rate' => $failureRate,
            ];
        }

        // Sort by failed_count descending, then failure_rate descending
        usort($formattedQuestions, function ($a, $b) {
            if ($b['failed_count'] === $a['failed_count']) {
                return $b['failure_rate'] <=> $a['failure_rate'];
            }
            return $b['failed_count'] <=> $a['failed_count'];
        });

        $topFailedQuestions = array_slice($formattedQuestions, 0, 5);

        // 3. Process Top Performing Students
        $studentStats = [];

        foreach ($submissions as $sub) {
            $studentKey = !empty($sub->student_id)
                ? 'id_' . $sub->student_id
                : (!empty($sub->serial_number) ? 'sn_' . $sub->serial_number : 'name_' . trim($sub->student_name));

            if (!isset($studentStats[$studentKey])) {
                $studentStats[$studentKey] = [
                    'student_id' => $sub->student_id,
                    'student_name' => $sub->student_name ?: 'طالب غير محدد',
                    'serial_number' => $sub->serial_number ?: '-',
                    'grade' => $sub->grade ?: 'عام',
                    'section' => $sub->section ?: 'عام',
                    'school_name' => $sub->school_name ?: '',
                    'total_score' => 0,
                    'total_max_score' => 0,
                    'quizzes_completed' => 0,
                ];
            }

            $studentStats[$studentKey]['total_score'] += (float)$sub->score;
            $studentStats[$studentKey]['total_max_score'] += (float)$sub->max_score;
            $studentStats[$studentKey]['quizzes_completed'] += 1;
        }

        $formattedStudents = [];
        foreach ($studentStats as $st) {
            $avgPct = $st['total_max_score'] > 0
                ? round(($st['total_score'] / $st['total_max_score']) * 100, 1)
                : 0;

            $formattedStudents[] = [
                'student_id' => $st['student_id'],
                'student_name' => $st['student_name'],
                'serial_number' => $st['serial_number'],
                'grade' => $st['grade'],
                'section' => $st['section'],
                'school_name' => $st['school_name'],
                'total_score' => round($st['total_score'], 1),
                'total_max_score' => round($st['total_max_score'], 1),
                'quizzes_completed' => $st['quizzes_completed'],
                'average_percentage' => $avgPct,
            ];
        }

        // Sort by total_score desc, then average_percentage desc
        usort($formattedStudents, function ($a, $b) {
            if ($b['total_score'] === $a['total_score']) {
                return $b['average_percentage'] <=> $a['average_percentage'];
            }
            return $b['total_score'] <=> $a['total_score'];
        });

        $topStudents = array_slice($formattedStudents, 0, 5);

        return response()->json([
            'status' => 'success',
            'data' => [
                'top_failed_questions' => $topFailedQuestions,
                'top_students' => $topStudents,
            ]
        ]);
    }

    /**
     * Get Comprehensive General Stats (Subject -> Branch -> Lessons ordered by lesson_number)
     * including answered/unanswered students and collective reminder summary.
     * Route: GET /api/analytics/general-stats
     */
    public function generalStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolId = $request->input('school_id') ?? ($user?->school_id);
        $schoolName = $request->input('school_name') ?? ($user?->school_name);

        // 1. Fetch Quizzes for this school / scope
        $quizQuery = Quiz::where('is_archived', false);

        if ($schoolId) {
            $quizQuery->where('school_id', $schoolId);
        } elseif ($schoolName) {
            $quizQuery->where('school_name', $schoolName);
        }

        if ($request->has('grade') && $request->input('grade') !== 'ALL') {
            $quizQuery->where('grade', $request->input('grade'));
        }

        $quizzes = $quizQuery
            ->orderBy('subject', 'asc')
            ->orderBy('sub_subject', 'asc')
            ->orderBy('lesson_number', 'asc')
            ->get();

        // 2. Fetch Roster / Enrolled Students for the school
        $studentUserQuery = User::where('role', 'student');
        if ($schoolId) {
            $studentUserQuery->where('school_id', $schoolId);
        } elseif ($schoolName) {
            $studentUserQuery->where('school_name', $schoolName);
        }
        $enrolledUsers = $studentUserQuery->get();

        // If enrolled users in User model is empty, fallback to distinct students from Submissions table
        $enrolledStudentsMap = [];
        if ($enrolledUsers->isNotEmpty()) {
            foreach ($enrolledUsers as $u) {
                $key = !empty($u->serial_number) ? 'sn_' . $u->serial_number : 'name_' . trim(mb_strtolower($u->name));
                $enrolledStudentsMap[$key] = [
                    'id' => $u->id,
                    'name' => $u->name,
                    'serial_number' => $u->serial_number ?: '-',
                    'grade' => $u->grade ?: 'عام',
                    'section' => $u->section ?: 'عام',
                ];
            }
        }

        // Fetch all Submissions for the scope
        $subQuery = Submission::query();
        if ($schoolId) {
            $subQuery->where('school_id', $schoolId);
        } elseif ($schoolName) {
            $subQuery->where('school_name', $schoolName);
        }
        $allSubmissions = $subQuery->get();

        // If no enrolled users found in users table, build from submissions table
        if (empty($enrolledStudentsMap)) {
            foreach ($allSubmissions as $sub) {
                $key = !empty($sub->serial_number)
                    ? 'sn_' . $sub->serial_number
                    : 'name_' . trim(mb_strtolower($sub->student_name));

                if (!isset($enrolledStudentsMap[$key])) {
                    $enrolledStudentsMap[$key] = [
                        'id' => $sub->student_id,
                        'name' => $sub->student_name,
                        'serial_number' => $sub->serial_number ?: '-',
                        'grade' => $sub->grade ?: 'عام',
                        'section' => $sub->section ?: 'عام',
                    ];
                }
            }
        }

        // Map submissions by quiz_id
        $submissionsByQuiz = [];
        foreach ($allSubmissions as $sub) {
            $submissionsByQuiz[$sub->quiz_id][] = $sub;
        }

        // 3. Build Hierarchical Structure (Subject -> Branch -> Lessons)
        $hierarchy = [];
        $studentMissingMap = [];

        foreach ($quizzes as $quiz) {
            $subject = $quiz->subject ?: ($quiz->main_subject ?: 'المادة العامة');
            $branch = $quiz->sub_subject ?: ($quiz->branch ?: 'جميع الفروع');
            $lessonNum = $quiz->lesson_number ?: $quiz->lessonNumber ?: 0;

            $quizSubmissions = $submissionsByQuiz[$quiz->id] ?? [];

            $answeredStudentsMap = [];
            $answeredStudentKeys = [];

            foreach ($quizSubmissions as $s) {
                $key = !empty($s->serial_number)
                    ? 'sn_' . $s->serial_number
                    : 'name_' . trim(mb_strtolower($s->student_name));

                $answeredStudentKeys[$key] = true;
                $answeredStudentsMap[] = [
                    'student_id' => $s->student_id,
                    'name' => $s->student_name,
                    'serial_number' => $s->serial_number ?: '-',
                    'grade' => $s->grade ?: 'عام',
                    'section' => $s->section ?: 'عام',
                    'score' => (float)$s->score,
                    'max_score' => (float)$s->max_score,
                    'percentage' => (float)$s->percentage,
                    'passed' => (bool)$s->passed,
                    'submitted_at' => $s->submitted_at ? $s->submitted_at->toIso8601String() : null,
                ];
            }

            // Target students for this quiz (matching grade if quiz specifies grade)
            $quizGrade = $quiz->grade ?: $quiz->class_level;
            $targetStudents = [];

            foreach ($enrolledStudentsMap as $sKey => $sInfo) {
                if (!$quizGrade || $quizGrade === 'ALL' || $quizGrade === 'جميع الصفوف' || $sInfo['grade'] === $quizGrade) {
                    $targetStudents[$sKey] = $sInfo;
                }
            }

            $unansweredStudentsMap = [];
            foreach ($targetStudents as $sKey => $sInfo) {
                if (!isset($answeredStudentKeys[$sKey])) {
                    $unansweredStudentsMap[] = $sInfo;

                    // Add to collective reminder map
                    if (!isset($studentMissingMap[$sKey])) {
                        $studentMissingMap[$sKey] = [
                            'student_name' => $sInfo['name'],
                            'serial_number' => $sInfo['serial_number'],
                            'grade' => $sInfo['grade'],
                            'section' => $sInfo['section'],
                            'missing_quizzes' => [],
                        ];
                    }

                    $studentMissingMap[$sKey]['missing_quizzes'][] = [
                        'quiz_id' => $quiz->id,
                        'title' => $quiz->title,
                        'subject' => $subject,
                        'branch' => $branch,
                        'lesson_number' => $lessonNum,
                    ];
                }
            }

            $totalRequired = count($targetStudents);
            $answeredCount = count($answeredStudentsMap);
            $unansweredCount = count($unansweredStudentsMap);

            $quizItem = [
                'quiz_id' => $quiz->id,
                'title' => $quiz->title,
                'lesson_number' => $lessonNum,
                'subject' => $subject,
                'branch' => $branch,
                'grade' => $quizGrade ?: 'عام',
                'section' => $quiz->section ?: 'عام',
                'teacher_name' => $quiz->teacherName ?: $quiz->teacher_name ?: 'المعلم',
                'total_required_students' => $totalRequired,
                'answered_students_count' => $answeredCount,
                'unanswered_students_count' => $unansweredCount,
                'answered_students' => $answeredStudentsMap,
                'unanswered_students' => $unansweredStudentsMap,
            ];

            if (!isset($hierarchy[$subject])) {
                $hierarchy[$subject] = [];
            }
            if (!isset($hierarchy[$subject][$branch])) {
                $hierarchy[$subject][$branch] = [];
            }

            $hierarchy[$subject][$branch][] = $quizItem;
        }

        // Sort lessons inside each branch by lesson_number ascending
        foreach ($hierarchy as $subj => $branches) {
            foreach ($branches as $br => $quizList) {
                usort($hierarchy[$subj][$br], function ($a, $b) {
                    return ($a['lesson_number'] ?? 0) <=> ($b['lesson_number'] ?? 0);
                });
            }
        }

        // Build collective reminders list
        $collectiveReminders = array_values($studentMissingMap);
        foreach ($collectiveReminders as &$stRem) {
            $stRem['missing_quizzes_count'] = count($stRem['missing_quizzes']);
        }
        // Sort collective reminders by missing_quizzes_count descending
        usort($collectiveReminders, function ($a, $b) {
            return $b['missing_quizzes_count'] <=> $a['missing_quizzes_count'];
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'hierarchy' => $hierarchy,
                'collective_reminders' => $collectiveReminders,
            ]
        ]);
    }
}
