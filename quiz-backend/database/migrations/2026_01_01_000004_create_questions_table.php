<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained('quizzes')->onDelete('cascade');
            $table->integer('question_order')->default(1);
            $table->string('type'); // multiple_choice, true_false, fill_in, essay, matching, drawing, classify, etc.
            $table->text('question_text');
            $table->json('options')->nullable(); // JSON type for options
            $table->text('correct_answer')->nullable();
            $table->json('matching_pairs')->nullable(); // JSON type for matching pairs
            $table->json('classification')->nullable(); // JSON type for classification groups
            $table->text('drawing_prompt')->nullable();
            $table->text('explanation')->nullable();
            $table->double('points', 8, 2)->default(1.00);
            $table->timestamps();

            // Index
            $table->index('quiz_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
