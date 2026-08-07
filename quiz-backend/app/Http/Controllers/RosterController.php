<?php

namespace App\Http\Controllers;

use App\Imports\RosterImport;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class RosterController extends Controller
{
    /**
     * Display a listing of roster users (students & teachers) for current school.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = User::query();

        if ($user && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }

        if ($request->has('role')) {
            $query->where('role', $request->input('role'));
        }

        $users = $query->orderBy('role', 'asc')->orderBy('name', 'asc')->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $users->items(),
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
            'total' => $users->total(),
        ]);
    }

    /**
     * Import Excel file containing Students/Teachers Roster.
     * Uses Chunk Reading (200 rows/chunk) to manage Hostinger memory limits and avoid 500 error.
     */
    public function importExcel(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        $user = $request->user();
        $schoolId = $user?->school_id;
        $schoolName = $user?->school_name;

        try {
            $file = $request->file('file');

            // Import Excel using Maatwebsite with 200-row chunking
            if (class_exists(Excel::class)) {
                Excel::import(new RosterImport($schoolId, $schoolName), $file);
            } else {
                // Fallback JSON batch array if sent as raw batch
                return response()->json([
                    'status' => 'error',
                    'message' => 'حزمة Maatwebsite/Excel غير مثبتة. يرجى تثبيتها عبر composer require maatwebsite/excel'
                ], 500);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'تم استيراد قائمة الطلاب والمعلمين بنجاح بتقنية المعالجة على أجزاء (Chunk Reading 200)'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'حدث خطأ أثناء معالجة ملف الإكسل: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store or update a single roster user.
     */
    public function storeSingle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'role' => 'required|in:student,teacher,admin',
            'grade' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'serial_number' => 'nullable|string|max:50',
            'code' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:100',
            'branch' => 'nullable|string|max:100',
            'school_name' => 'nullable|string|max:150',
        ]);

        $user = $request->user();
        
        $schoolId = null;
        if (!empty($validated['school_name'])) {
            $school = \App\Models\School::firstOrCreate(
                ['name' => trim($validated['school_name'])],
                ['branch' => $validated['branch'] ?? 'عام']
            );
            $schoolId = $school->id;
        }

        if (!$schoolId && $user) {
            $schoolId = $user->school_id;
        }

        $validated['school_id'] = $schoolId;

        $searchKeys = [];
        if (!empty($validated['serial_number'])) {
            $searchKeys['serial_number'] = $validated['serial_number'];
        } elseif (!empty($validated['code'])) {
            $searchKeys['code'] = $validated['code'];
        } else {
            $searchKeys['name'] = $validated['name'];
            $searchKeys['school_id'] = $schoolId;
        }

        $rosterUser = User::updateOrCreate($searchKeys, $validated);

        return response()->json([
            'status' => 'success',
            'message' => 'تم حفظ المستخدم في السجل بنجاح',
            'data' => $rosterUser
        ]);
    }

    /**
     * Sync an array of roster users using bulk chunk inserts.
     */
    public function sync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'users' => 'required|array',
            'users.*.name' => 'required|string',
            'users.*.role' => 'nullable|string',
        ]);

        $usersData = $validated['users'];
        $user = $request->user();
        $schoolId = $user?->school_id;

        DB::beginTransaction();
        try {
            // Chunking the array to insert 500 rows at a time
            $chunks = array_chunk($usersData, 500);
            foreach ($chunks as $chunk) {
                $insertData = [];
                $now = now();
                foreach ($chunk as $userData) {
                    $insertData[] = [
                        'name' => $userData['name'],
                        'role' => $userData['role'] ?? 'student',
                        'school_id' => $schoolId,
                        'grade' => $userData['grade'] ?? null,
                        'section' => $userData['section'] ?? null,
                        'serial_number' => $userData['serialNumber'] ?? ($userData['serial_number'] ?? null),
                        'code' => $userData['code'] ?? null,
                        'email' => $userData['email'] ?? null,
                        'password' => bcrypt($userData['serialNumber'] ?? '12345678'), // Default password
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                User::insert($insertData);
            }
            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'تم استيراد الحسابات بنجاح'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'فشل الاستيراد: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export roster using a memory-efficient streamed response (CSV).
     */
    public function export(Request $request)
    {
        $user = $request->user();
        $schoolId = $user?->school_id;

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="roster_export.csv"',
        ];

        $callback = function () use ($schoolId) {
            $file = fopen('php://output', 'w');
            
            // Add BOM for Excel UTF-8 compatibility
            fputs($file, "\xEF\xBB\xBF");
            
            fputcsv($file, ['الاسم', 'الصفة', 'الصف', 'الشعبة', 'الرقم التسلسلي', 'الكود', 'البريد الإلكتروني']);

            $query = User::query();
            if ($schoolId) {
                $query->where('school_id', $schoolId);
            }

            // Using cursor() to fetch data lazily without exhausting memory
            foreach ($query->cursor() as $rosterUser) {
                fputcsv($file, [
                    $rosterUser->name,
                    $rosterUser->role === 'teacher' ? 'معلم' : 'طالب',
                    $rosterUser->grade,
                    $rosterUser->section,
                    $rosterUser->serial_number,
                    $rosterUser->code,
                    $rosterUser->email,
                ]);
            }

            fclose($file);
        };

        return response()->streamDownload($callback, 'roster_export.csv', $headers);
    }
}
