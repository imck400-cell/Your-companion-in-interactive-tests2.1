-- ============================================================
-- Hostinger MySQL Database Schema for Interactive Quiz Platform
-- Engine: InnoDB | Charset: utf8mb4_unicode_ci
-- Strictly NO Soft Deletes | High-Performance Indexing | Native JSON Support
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. SCHOOLS TABLE
DROP TABLE IF EXISTS `schools`;
CREATE TABLE `schools` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `branch` VARCHAR(255) NOT NULL DEFAULT 'عام',
  `activation_year` VARCHAR(100) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `subscription_end_date` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_schools_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS TABLE (Students, Teachers, Admins)
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_id` BIGINT UNSIGNED NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
  `school_name` VARCHAR(255) NULL,
  `branch` VARCHAR(255) NULL,
  `grade` VARCHAR(100) NULL,
  `section` VARCHAR(100) NULL,
  `serial_number` VARCHAR(100) NULL, -- Unique 9-digit serial
  `code` VARCHAR(100) NULL,          -- 7-digit access code
  `email` VARCHAR(255) NULL,
  `password` VARCHAR(255) NULL,
  `active_session_id` VARCHAR(255) NULL,
  `last_activity_at` BIGINT NULL,
  `public_ref_id` VARCHAR(255) NULL,
  `subscription_end_date` TIMESTAMP NULL DEFAULT NULL,
  `is_suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `is_unauthorized` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_school_id` (`school_id`),
  INDEX `idx_users_serial_number` (`serial_number`),
  INDEX `idx_users_code` (`code`),
  INDEX `idx_users_school_role` (`school_id`, `role`),
  CONSTRAINT `fk_users_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. QUIZZES TABLE
DROP TABLE IF EXISTS `quizzes`;
CREATE TABLE `quizzes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_id` BIGINT UNSIGNED NULL,
  `teacher_id` BIGINT UNSIGNED NULL,
  `title` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `main_subject` VARCHAR(255) NULL,
  `sub_subject` VARCHAR(255) NULL,
  `grade` VARCHAR(100) NULL,
  `section` VARCHAR(100) NULL,
  `class_level` VARCHAR(100) NULL,
  `teacher_name` VARCHAR(255) NULL,
  `owner_teacher_code` VARCHAR(100) NULL,
  `school_name` VARCHAR(255) NULL,
  `branch` VARCHAR(255) NULL,
  `academic_year` VARCHAR(100) NULL,
  `visibility` ENUM('public', 'private') NOT NULL DEFAULT 'public',
  `show_feedback` ENUM('immediate', 'end') NOT NULL DEFAULT 'immediate',
  `time_limit_minutes` INT NOT NULL DEFAULT 0,
  `pass_percentage` INT NOT NULL DEFAULT 50,
  `allow_answer_change` TINYINT(1) NOT NULL DEFAULT 0,
  `allow_full_quiz_retake` TINYINT(1) NOT NULL DEFAULT 0,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_quizzes_school_id` (`school_id`),
  INDEX `idx_quizzes_teacher_id` (`teacher_id`),
  INDEX `idx_quizzes_owner_code` (`owner_teacher_code`),
  CONSTRAINT `fk_quizzes_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quizzes_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. QUESTIONS TABLE
DROP TABLE IF EXISTS `questions`;
CREATE TABLE `questions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quiz_id` BIGINT UNSIGNED NOT NULL,
  `question_order` INT NOT NULL DEFAULT 1,
  `type` VARCHAR(100) NOT NULL,
  `question_text` TEXT NOT NULL,
  `options` JSON NULL,             -- JSON field for options array
  `correct_answer` TEXT NULL,
  `matching_pairs` JSON NULL,     -- JSON field for matching pairs
  `classification` JSON NULL,     -- JSON field for category classification
  `drawing_prompt` TEXT NULL,
  `explanation` TEXT NULL,
  `points` DOUBLE(8,2) NOT NULL DEFAULT 1.00,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_questions_quiz_id` (`quiz_id`),
  CONSTRAINT `fk_questions_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SUBMISSIONS TABLE
DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quiz_id` BIGINT UNSIGNED NOT NULL,
  `student_id` BIGINT UNSIGNED NULL,
  `school_id` BIGINT UNSIGNED NULL,
  `teacher_id` BIGINT UNSIGNED NULL,
  `quiz_title` VARCHAR(255) NOT NULL,
  `student_name` VARCHAR(255) NOT NULL,
  `serial_number` VARCHAR(100) NULL,
  `grade` VARCHAR(100) NULL,
  `section` VARCHAR(100) NULL,
  `school_name` VARCHAR(255) NULL,
  `teacher_name` VARCHAR(255) NULL,
  `score` DOUBLE(8,2) NOT NULL DEFAULT 0.00,
  `max_score` DOUBLE(8,2) NOT NULL DEFAULT 0.00,
  `percentage` DOUBLE(5,2) NOT NULL DEFAULT 0.00,
  `passed` TINYINT(1) NOT NULL DEFAULT 0,
  `correct_count` INT NOT NULL DEFAULT 0,
  `incorrect_count` INT NOT NULL DEFAULT 0,
  `skipped_count` INT NOT NULL DEFAULT 0,
  `total_time_spent_seconds` INT NOT NULL DEFAULT 0,
  `details` JSON NOT NULL,          -- JSON column storing submission details per question
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `guest_device_uuid` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_submissions_quiz_id` (`quiz_id`),
  INDEX `idx_submissions_student_id` (`student_id`),
  INDEX `idx_submissions_school_id` (`school_id`),
  INDEX `idx_submissions_teacher_id` (`teacher_id`),
  INDEX `idx_submissions_serial_number` (`serial_number`),
  CONSTRAINT `fk_submissions_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
