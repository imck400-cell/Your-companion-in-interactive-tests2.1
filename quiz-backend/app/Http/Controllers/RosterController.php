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

        $users = $query->orderBy('role', 'asc')->orderBy('name', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'count' => $users->count(),
            'data' => $users
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
}
