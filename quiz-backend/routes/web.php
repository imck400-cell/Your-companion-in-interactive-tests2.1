<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'Quiz Platform API',
        'version' => '13.0',
        'status' => 'active'
    ]);
});

Route::get('/clear-all', function () {
    \Illuminate\Support\Facades\Artisan::call('optimize:clear');
    return 'Cache cleared successfully';
});
