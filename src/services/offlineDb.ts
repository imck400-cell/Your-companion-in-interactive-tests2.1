import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { QuizMetadata, StudentAnswer, Submission } from '../types';
import apiClient from './apiClient';

export interface StudentDraft {
  draftId: string; // quizId_studentName
  quizId: string;
  studentName: string;
  grade: string;
  section: string;
  answers: Record<string, StudentAnswer>;
  questionTimeSpent: Record<string, number>;
  currentIndex: number;
  lastSavedAt: string;
}

interface QuizCompanionDB extends DBSchema {
  quizzes: {
    key: string;
    value: QuizMetadata;
  };
  pending_quizzes: {
    key: string;
    value: QuizMetadata;
  };
  pending_submissions: {
    key: string;
    value: Submission;
  };
  saved_submissions: {
    key: string;
    value: Submission;
  };
  student_drafts: {
    key: string;
    value: StudentDraft;
  };
}

const DB_NAME = 'InteractiveQuizCompanionDB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<QuizCompanionDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<QuizCompanionDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('quizzes')) {
          db.createObjectStore('quizzes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pending_quizzes')) {
          db.createObjectStore('pending_quizzes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pending_submissions')) {
          db.createObjectStore('pending_submissions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('saved_submissions')) {
          db.createObjectStore('saved_submissions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('student_drafts')) {
          db.createObjectStore('student_drafts', { keyPath: 'draftId' });
        }
      },
    });
  }
  return dbPromise;
}

// Student Draft Auto-Save (every 5 seconds)
export async function saveStudentDraft(draft: StudentDraft): Promise<void> {
  const db = await getDB();
  await db.put('student_drafts', draft);
}

export async function getStudentDraft(quizId: string, studentName: string): Promise<StudentDraft | undefined> {
  const db = await getDB();
  const draftId = `${quizId}_${studentName.trim().toLowerCase()}`;
  return db.get('student_drafts', draftId);
}

export async function deleteStudentDraft(quizId: string, studentName: string): Promise<void> {
  const db = await getDB();
  const draftId = `${quizId}_${studentName.trim().toLowerCase()}`;
  await db.delete('student_drafts', draftId);
}

// Clear all active temporary IndexedDB sessions on logout
export async function clearAllIndexedDBSessions(): Promise<void> {
  const db = await getDB();
  await db.clear('student_drafts');
}

// Local Quizzes
export async function saveLocalQuiz(quiz: QuizMetadata, isPendingSync = false): Promise<void> {
  const db = await getDB();
  await db.put('quizzes', quiz);
  if (isPendingSync) {
    await db.put('pending_quizzes', quiz);
  }
}

export async function getLocalQuizzes(): Promise<QuizMetadata[]> {
  const db = await getDB();
  return db.getAll('quizzes');
}

export async function getLocalQuizById(id: string): Promise<QuizMetadata | undefined> {
  const db = await getDB();
  return db.get('quizzes', id);
}

export async function deleteLocalQuiz(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('quizzes', id);
  await db.delete('pending_quizzes', id);
}

export async function getPendingQuizzes(): Promise<QuizMetadata[]> {
  const db = await getDB();
  return db.getAll('pending_quizzes');
}

export async function markQuizSyncedLocally(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_quizzes', id);
  const quiz = await db.get('quizzes', id);
  if (quiz) {
    quiz.synced = true;
    await db.put('quizzes', quiz);
  }
}

// Student Submissions Offline Cache
export async function saveLocalSubmission(submission: Submission, isPendingSync = true): Promise<void> {
  const db = await getDB();
  await db.put('saved_submissions', submission);
  if (isPendingSync) {
    await db.put('pending_submissions', submission);
  }
}

export async function getAllLocalSubmissions(): Promise<Submission[]> {
  const db = await getDB();
  return db.getAll('saved_submissions');
}

export async function getLocalSubmissionsForQuiz(quizId: string): Promise<Submission[]> {
  const db = await getDB();
  const all = await db.getAll('saved_submissions');
  if (quizId === 'ALL' || quizId === 'all') return all;
  return all.filter((s) => s.quizId === quizId);
}

export async function getPendingSubmissions(): Promise<Submission[]> {
  const db = await getDB();
  return db.getAll('pending_submissions');
}

export async function markSubmissionSyncedLocally(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending_submissions', id);
  const sub = await db.get('saved_submissions', id);
  if (sub) {
    sub.synced = true;
    await db.put('saved_submissions', sub);
  }
}

/**
 * Offline Sync Bridge: Sends all pending offline submissions from IndexedDB
 * as a single batch queue to Laravel API: POST /api/submissions/sync
 */
export async function syncPendingSubmissionsToLaravel(): Promise<{ count: number; success: boolean }> {
  if (!navigator.onLine) {
    return { count: 0, success: false };
  }

  try {
    const pending = await getPendingSubmissions();
    if (!pending || pending.length === 0) {
      return { count: 0, success: true };
    }

    const payload = pending.map((sub) => ({
      quiz_id: sub.quizId,
      student_name: sub.studentName,
      serial_number: sub.serialNumber,
      grade: sub.grade,
      section: sub.section,
      school_name: sub.schoolName,
      teacher_name: sub.teacherName,
      score: sub.score,
      max_score: sub.maxScore,
      percentage: sub.percentage,
      passed: sub.passed,
      correct_count: sub.correctCount,
      incorrect_count: sub.incorrectCount,
      skipped_count: sub.skippedCount,
      total_time_spent_seconds: sub.totalTimeSpentSeconds,
      details: sub.answers,
      submitted_at: sub.submittedAt,
      guest_device_uuid: sub.guestDeviceUuid,
    }));

    const response = await apiClient.post('/submissions/sync', {
      submissions: payload,
    });

    if (response.data && response.data.status === 'success') {
      for (const sub of pending) {
        await markSubmissionSyncedLocally(sub.id);
      }
      return { count: pending.length, success: true };
    }
  } catch (error) {
    console.warn('Failed to sync offline submissions queue to Laravel:', error);
  }

  return { count: 0, success: false };
}

