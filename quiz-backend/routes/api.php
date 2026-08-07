<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\SubmissionController;
use App\Http\Controllers\RosterController;
use App\Http\Controllers\AnalyticsController;

/*
|--------------------------------------------------------------------------
| API Routes with Rate Limiting (60 requests / min) & Sanctum Auth
|--------------------------------------------------------------------------
*/

// Rate Limiter middleware applied globally to API group (throttle:60,1 = 60 requests per 1 minute)
Route::middleware(['throttle:60,1'])->group(function () {

    // Public Authentication Endpoints
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Public Analytics Endpoints (Optional Auth / Filterable via Query Params)
    Route::get('/analytics/top-performance', [AnalyticsController::class, 'topPerformance']);
    Route::get('/analytics/general-stats', [AnalyticsController::class, 'generalStats']);

    // Sanctum Authenticated Endpoints
    Route::middleware(['auth:sanctum'])->group(function () {
        
        // Auth Management
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Quiz Management (Includes Quiz::with('questions') Eager Loading to avoid N+1)
        Route::get('/quizzes', [QuizController::class, 'index']);
        Route::get('/quizzes/my-school-subjects', [QuizController::class, 'mySchoolSubjects']);
        Route::get('/quizzes/general-grouped', [QuizController::class, 'generalGrouped']);
        Route::post('/quizzes', [QuizController::class, 'store']);
        Route::get('/quizzes/{id}', [QuizController::class, 'show']);
        Route::put('/quizzes/{id}', [QuizController::class, 'update']);
        Route::delete('/quizzes/{id}', [QuizController::class, 'destroy']);

        // Submissions & Deduplicated Batch Offline Sync
        Route::get('/submissions', [SubmissionController::class, 'index']);
        Route::post('/submissions', [SubmissionController::class, 'store']);
        Route::post('/submissions/sync', [SubmissionController::class, 'syncOfflineSubmissions']); // Batch offline sync
        Route::get('/submissions/{id}', [SubmissionController::class, 'show']);

        // Roster & Memory-Optimized Excel Import (Chunk Reading 200 rows)
        Route::get('/roster', [RosterController::class, 'index']);
        Route::post('/roster/import', [RosterController::class, 'importExcel']);
        Route::post('/roster/single', [RosterController::class, 'storeSingle']);
        Route::delete('/roster/{id}', [RosterController::class, 'destroy']);

        // Admin Routes
        Route::get('/admin/submissions/all', [SubmissionController::class, 'index']);
        Route::get('/admin/users', [RosterController::class, 'index']);
        Route::post('/admin/users', [RosterController::class, 'storeSingle']);
        Route::delete('/admin/users/{id}', [RosterController::class, 'destroy']);

        // Analytics & Top Performance Endpoints
        // Route::get('/analytics/top-performance', [AnalyticsController::class, 'topPerformance']);
        // Route::get('/analytics/general-stats', [AnalyticsController::class, 'generalStats']);
    });
});

Route::get('/test-db', function () {
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        return 'Database connection is OK';
    } catch (\Exception $e) {
        return 'DB Error: ' . $e->getMessage();
    }
});
