<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'app' => 'Quiz Platform API',
        'version' => '13.0',
        'status' => 'active'
    ]);
});
