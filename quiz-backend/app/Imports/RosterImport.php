<?php

namespace App\Imports;

use App\Models\User;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithBatchInserts;

class RosterImport implements ToCollection, WithHeadingRow, WithChunkReading, WithBatchInserts
{
    protected ?int $schoolId;
    protected ?string $schoolName;

    public function __construct(?int $schoolId = null, ?string $schoolName = null)
    {
        $this->schoolId = $schoolId;
        $this->schoolName = $schoolName;
    }

    /**
     * Process each collection chunk of 200 rows.
     * Prevents PHP Memory Limit 500 error on Hostinger shared servers.
     */
    public function collection(Collection $rows)
    {
        foreach ($rows as $row) {
            $serialNumber = $row['serial_number'] ?? $row['الرقم_التسلسلي'] ?? $row['رقم_الهوية'] ?? null;
            $code = $row['code'] ?? $row['الكود'] ?? $row['كود_الدخول'] ?? null;
            $name = $row['name'] ?? $row['الاسم'] ?? $row['اسم_الطالب'] ?? $row['اسم_المعلم'] ?? null;

            if (!$name && !$serialNumber && !$code) {
                continue; // Skip empty rows
            }

            $role = strtolower($row['role'] ?? $row['الدور'] ?? 'student');
            if (in_array($role, ['معلم', 'مدرس', 'teacher'])) {
                $role = 'teacher';
            } elseif (in_array($role, ['اداري', 'مدير', 'مشرف', 'admin'])) {
                $role = 'admin';
            } else {
                $role = 'student';
            }

            $schoolName = $this->schoolName ?? $row['school_name'] ?? $row['المدرسة'] ?? null;
            $schoolId = $this->schoolId;

            if (!$schoolId && $schoolName) {
                $school = \App\Models\School::firstOrCreate(
                    ['name' => trim($schoolName)],
                    ['branch' => $row['branch'] ?? $row['الفرع'] ?? 'عام']
                );
                $schoolId = $school->id;
            }

            $searchCriteria = [];
            if ($serialNumber) {
                $searchCriteria['serial_number'] = (string) $serialNumber;
            } elseif ($code) {
                $searchCriteria['code'] = (string) $code;
            } else {
                $searchCriteria['name'] = $name;
                $searchCriteria['school_id'] = $schoolId;
            }

            User::updateOrCreate(
                $searchCriteria,
                [
                    'school_id' => $schoolId,
                    'school_name' => $schoolName,
                    'name' => $name ?? 'مستخدم',
                    'role' => $role,
                    'branch' => $row['branch'] ?? $row['الفرع'] ?? 'عام',
                    'grade' => $row['grade'] ?? $row['الصف'] ?? null,
                    'section' => $row['section'] ?? $row['الشعبة'] ?? $row['الفصل'] ?? null,
                    'serial_number' => $serialNumber ? (string) $serialNumber : null,
                    'code' => $code ? (string) $code : null,
                    'email' => $row['email'] ?? $row['البريد'] ?? null,
                ]
            );
        }
    }

    /**
     * Chunk Size limit: Read file in 200-row chunks to conserve memory.
     */
    public function chunkSize(): int
    {
        return 200;
    }

    /**
     * Batch Insert limit: Insert 200 rows at a time into MySQL.
     */
    public function batchSize(): int
    {
        return 200;
    }
}
