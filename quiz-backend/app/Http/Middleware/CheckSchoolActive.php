<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSchoolActive
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && $user->school_id) {
            $school = $user->school; // Assuming relationship exists, or we query it. Let's query it.
            if (!$school) {
                $school = \App\Models\School::find($user->school_id);
            }
            if ($school && $school->is_active === false) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'حساب المدرسة موقوف حالياً.'
                ], 403);
            }
        }
        return $next($request);
    }
}
