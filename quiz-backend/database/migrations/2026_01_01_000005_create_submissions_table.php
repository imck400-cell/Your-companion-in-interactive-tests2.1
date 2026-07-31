<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('quizzes')->onDelete('cascade');
            $table->foreignId('student_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->foreignId('school_id')->nullable()->constrained('schools')->onDelete('cascade');
            $table->foreignId('teacher_id')->nullable()->constrained('users')->onDelete('cascade');
            
            $table->string('quiz_title');
            $table->string('student_name');
            $table->string('serial_number')->nullable();
            $table->string('grade')->nullable();
            $table->string('section')->nullable();
            $table->string('school_name')->nullable();
            $table->string('teacher_name')->nullable();
            
            $table->double('score', 8, 2)->default(0.00);
            $table->double('max_score', 8, 2)->default(0.00);
            $table->double('percentage', 5, 2)->default(0.00);
            $table->boolean('passed')->default(false);
            
            $table->integer('correct_count')->default(0);
            $table->integer('incorrect_count')->default(0);
            $table->integer('skipped_count')->default(0);
            $table->integer('total_time_spent_seconds')->default(0);
            
            $table->json('details'); // JSON column for submission breakdown per question
            $table->timestamp('submitted_at')->useCurrent();
            $table->string('guest_device_uuid')->nullable();
            $table->timestamps();

            // Mandatory indexes for quick lookup
            $table->index('quiz_id');
            $table->index('student_id');
            $table->index('school_id');
            $table->index('teacher_id');
            $table->index('serial_number');
            $table->index(['quiz_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submissions');
    }
};
