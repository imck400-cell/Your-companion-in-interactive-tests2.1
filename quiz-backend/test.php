<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $validated = [
        'name' => 'New Teacher Test',
        'role' => 'teacher',
        'grade' => '1',
        'section' => 'A',
        'serial_number' => '123456789',
        'code' => '1234567',
        'school_name' => 'مدرسة التميز التفاعلية',
        'branch' => 'عام'
    ];

    $schoolId = null;
    if (!empty($validated['school_name'])) {
        $school = \App\Models\School::firstOrCreate(
            ['name' => trim($validated['school_name'])],
            ['branch' => $validated['branch'] ?? 'عام']
        );
        $schoolId = $school->id;
    }
    echo "School ID: $schoolId\n";

    $searchKeys = [];
    $searchKeys['serial_number'] = $validated['serial_number'];
    
    $validated['school_id'] = $schoolId;

    $rosterUser = \App\Models\User::updateOrCreate($searchKeys, $validated);
    echo "User created ID: " . $rosterUser->id . "\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
