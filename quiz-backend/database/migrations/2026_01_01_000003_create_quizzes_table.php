<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained('schools')->onDelete('cascade');
            $table->foreignId('teacher_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->integer('lesson_number')->nullable();
            $table->string('subject');
            $table->string('main_subject')->nullable();
            $table->string('sub_subject')->nullable();
            $table->string('grade')->nullable();
            $table->string('section')->nullable();
            $table->string('class_level')->nullable();
            $table->string('teacher_name')->nullable();
            $table->string('owner_teacher_code')->nullable();
            $table->string('school_name')->nullable();
            $table->string('branch')->nullable();
            $table->string('academic_year')->nullable();
            $table->enum('visibility', ['public', 'private'])->default('public');
            $table->enum('show_feedback', ['immediate', 'end'])->default('immediate');
            $table->integer('time_limit_minutes')->default(0);
            $table->integer('pass_percentage')->default(50);
            $table->boolean('allow_answer_change')->default(false);
            $table->boolean('allow_full_quiz_retake')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->timestamps();

            // Indexes for accelerated search
            $table->index('school_id');
            $table->index('teacher_id');
            $table->index('owner_teacher_code');
            $table->index(['school_id', 'is_archived']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quizzes');
    }
};
