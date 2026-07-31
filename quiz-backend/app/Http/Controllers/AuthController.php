<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Authenticate student/teacher/admin and issue Sanctum token (24h expiry).
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request militaryValidation = $request->validated();

        $query = User::query();

        if (!empty($validated['code'])) {
            $query->where('code', $validated['code']);
        } elseif (!empty($validated['serial_number'])) {
            $query->where('serial_number', $validated['serial_number']);
        } elseif (!empty($validated['email'])) {
            $query->where('email', $validated['email']);
        } else {
            return response()->json([
                'status' => 'error',
                'message' => 'بيانات الدخول غير مكتملة (الكود أو الرقم التسلسلي أو البريد الإلكتروني مطلوب)'
            ], 422);
        }

        $user = $query->first();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'المستخدم غير موجود أو بيانات الدخول غير صحيحة'
            ], 401);
        }

        if ($user->is_suspended) {
            return response()->json([
                'status' => 'error',
                'message' => 'حسابك معطل حالياً، يرجى مراجعة إدارة المدرسة'
            ], 403);
        }

        // If user has password set, verify it
        if (!empty($validated['password']) && $user->password) {
            if (!Hash::check($validated['password'], $user->password) && $validated['password'] !== $user->password) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'كلمة المرور غير صحيحة'
                ], 401);
            }
        }

        // Issue Sanctum Token
        $token = $user->createToken('auth-token', ['*'], now()->addMinutes(1440))->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'تم التسجيل بنجاح',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                    'school_id' => $user->school_id,
                    'school_name' => $user->school_name,
                    'branch' => $user->branch,
                    'grade' => $user->grade,
                    'section' => $user->section,
                    'serial_number' => $user->serial_number,
                    'code' => $user->code,
                ]
            ]
        ]);
    }

    /**
     * Get authenticated user profile.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح'], 401);
        }

        return response()->json([
            'status' => 'success',
            'data' => $user->load('school')
        ]);
    }

    /**
     * Logout user and revoke Sanctum token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'تم تسجيل الخروج بنجاح'
        ]);
    }
}
