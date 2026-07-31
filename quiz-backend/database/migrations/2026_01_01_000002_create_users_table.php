<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->nullable()->constrained('schools')->onDelete('cascade');
            $table->string('name');
            $table->enum('role', ['student', 'teacher', 'admin'])->default('student');
            $table->string('school_name')->nullable();
            $table->string('branch')->nullable();
            $table->string('grade')->nullable();
            $table->string('section')->nullable();
            $table->string('serial_number')->nullable(); // Unique 9-digit serial
            $table->string('code')->nullable(); // 7-digit access code
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('active_session_id')->nullable();
            $table->bigInteger('last_activity_at')->nullable();
            $table->string('public_ref_id')->nullable();
            $table->timestamp('subscription_end_date')->nullable();
            $table->boolean('is_suspended')->default(false);
            $table->boolean('is_unauthorized')->default(false);
            $table->timestamps();

            // Indexes for accelerated search as requested
            $table->index('school_id');
            $table->index('serial_number');
            $table->index('code');
            $table->index(['school_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
