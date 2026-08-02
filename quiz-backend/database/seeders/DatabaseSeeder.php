<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\School;
use App\Models\User;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        // 1. Create default school
        $school = School::firstOrCreate(
            ['name' => 'مدرسة التميز التفاعلية'],
            [
                'branch' => 'عام',
                'is_active' => true,
                'status' => 'active',
            ]
        );

        // 2. Create seed users
        $users = [
            [
                'name' => 'أحمد محمد العلي',
                'role' => 'student',
                'school_name' => 'مدرسة التميز التفاعلية',
                'branch' => 'عام',
                'grade' => 'الثالث الثانوي',
                'section' => 'أ',
                'serial_number' => '982341052',
                'code' => '6109234',
            ],
            [
                'name' => 'سارة عبد الله خالد',
                'role' => 'student',
                'school_name' => 'مدرسة التميز التفاعلية',
                'branch' => 'عام',
                'grade' => 'الثاني الثانوي',
                'section' => 'ب',
                'serial_number' => '912837465',
                'code' => '5281039',
            ],
            [
                'name' => 'أ. إبراهيم دخان',
                'role' => 'teacher',
                'school_name' => 'مدرسة التميز التفاعلية',
                'branch' => 'عام',
                'serial_number' => '772324000',
                'code' => '7808040',
            ]
        ];

        foreach ($users as $userData) {
            User::firstOrCreate(
                ['serial_number' => $userData['serial_number']],
                array_merge($userData, ['school_id' => $school->id])
            );
        }
    }
}