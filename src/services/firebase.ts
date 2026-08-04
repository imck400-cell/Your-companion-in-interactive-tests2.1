import { QuizMetadata, Submission, RosterUser, SupervisedSchool, LicenseLog } from '../types';
import apiClient from './apiClient';
import {
  saveLocalQuiz,
  getLocalQuizzes,
  getLocalQuizById,
  deleteLocalQuiz,
  saveLocalSubmission,
  getAllLocalSubmissions,
  getLocalSubmissionsForQuiz,
  syncPendingSubmissionsToLaravel,
  markQuizSyncedLocally,
  markSubmissionSyncedLocally
} from './offlineDb';

// Mock Auth & DB objects for backward compatibility with components if referenced
export const auth = {
  currentUser: null,
  signOut: async () => {
    localStorage.removeItem('sanctum_token');
    localStorage.removeItem('auth_token');
  }
};

export const db = {};

// Clean object helper
export function cleanForFirestore<T>(obj: T): T {
  return obj;
}

// Utility to normalize Eastern/Western Arabic digits
export function normalizeDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9')
    .replace(/\s+/g, '')
    .trim();
}

// Utility to convert English digits to Arabic-Indic digits
export function toArabicIndicDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/0/g, '٠')
    .replace(/1/g, '١')
    .replace(/2/g, '٢')
    .replace(/3/g, '٣')
    .replace(/4/g, '٤')
    .replace(/5/g, '٥')
    .replace(/6/g, '٦')
    .replace(/7/g, '٧')
    .replace(/8/g, '٨')
    .replace(/9/g, '٩')
    .replace(/\s+/g, '')
    .trim();
}

export function getSchoolSlug(schoolName?: string): string {
  if (!schoolName) return 'default_school';
  return schoolName.trim().toLowerCase().replace(/\s+/g, '_');
}

export function generateDeterministicUserId(schoolName: string, serialNumber: string): string {
  return `${getSchoolSlug(schoolName)}_${normalizeDigits(serialNumber)}`;
}

// ==========================================
// QUIZZES API (Laravel Backend + Local Cache)
// ==========================================

export async function saveQuiz(quiz: QuizMetadata): Promise<{ success: boolean; synced: boolean; error?: string }> {
  try {
    const isOnline = navigator.onLine;
    await saveLocalQuiz(quiz, !isOnline);

    if (isOnline) {
      const payload = {
        title: quiz.title,
        subject: quiz.subject,
        main_subject: quiz.mainSubject || quiz.main_subject,
        sub_subject: quiz.subSubject || quiz.sub_subject,
        grade: quiz.grade,
        section: quiz.section,
        class_level: quiz.classLevel || quiz.class_level,
        teacher_name: quiz.teacherName,
        owner_teacher_code: quiz.ownerTeacherCode,
        school_name: quiz.schoolName,
        branch: quiz.branch,
        academic_year: quiz.academicYear || quiz.academic_year,
        visibility: quiz.visibility || 'public',
        lesson_number: quiz.lesson_number || quiz.lessonNumber || null,
        show_feedback: quiz.showFeedback || 'immediate',
        time_limit_minutes: quiz.timeLimitMinutes || 0,
        pass_percentage: quiz.passPercentage || 50,
        allow_answer_change: quiz.allowAnswerChange ?? false,
        allow_full_quiz_retake: quiz.allowFullQuizRetake ?? false,
        questions: quiz.questions || [],
      };

      if (quiz.id && !quiz.id.startsWith('temp_')) {
        await apiClient.put(`/quizzes/${quiz.id}`, payload);
      } else {
        const response = await apiClient.post('/quizzes', payload);
        if (response.data && response.data.data) {
          quiz.id = String(response.data.data.id);
        }
      }

      await markQuizSyncedLocally(quiz.id);
      return { success: true, synced: true };
    }

    return { success: true, synced: false };
  } catch (err: any) {
    console.warn('Backend saveQuiz failed, saved to IndexedDB:', err);
    return { success: true, synced: false, error: err.message };
  }
}

export async function fetchQuizById(id: string): Promise<QuizMetadata | null> {
  try {
    if (navigator.onLine) {
      const response = await apiClient.get(`/quizzes/${id}`);
      if (response.data && response.data.data) {
        const q = response.data.data;
        const mappedQuiz: QuizMetadata = {
          id: String(q.id),
          title: q.title,
          subject: q.subject,
          mainSubject: q.main_subject,
          main_subject: q.main_subject,
          subSubject: q.sub_subject,
          sub_subject: q.sub_subject,
          grade: q.grade,
          section: q.section,
          classLevel: q.class_level,
          class_level: q.class_level,
          teacherName: q.teacher_name,
          ownerTeacherCode: q.owner_teacher_code,
          schoolName: q.school_name,
          branch: q.branch,
          academicYear: q.academic_year,
          academic_year: q.academic_year,
          schoolYear: q.academic_year || '2025/2026',
          createdAt: q.created_at || new Date().toISOString(),
          updatedAt: q.updated_at || new Date().toISOString(),
          visibility: q.visibility,
          lesson_number: q.lesson_number ? Number(q.lesson_number) : undefined,
          lessonNumber: q.lesson_number ? Number(q.lesson_number) : undefined,
          showFeedback: q.show_feedback,
          timeLimitMinutes: q.time_limit_minutes,
          passPercentage: q.pass_percentage,
          allowAnswerChange: q.allow_answer_change,
          allowFullQuizRetake: q.allow_full_quiz_retake,
          questions: q.questions || [],
          synced: true,
        };
        await saveLocalQuiz(mappedQuiz, false);
        return mappedQuiz;
      }
    }
  } catch (e) {
    console.warn('API fetchQuizById error, falling back to IndexedDB:', e);
  }

  const local = await getLocalQuizById(id);
  return local || null;
}

export async function fetchAllQuizzes(): Promise<QuizMetadata[]> {
  try {
    if (navigator.onLine) {
      const response = await apiClient.get('/quizzes');
      if (response.data && Array.isArray(response.data.data)) {
        const mappedList: QuizMetadata[] = response.data.data.map((q: any) => ({
          id: String(q.id),
          title: q.title,
          subject: q.subject,
          mainSubject: q.main_subject,
          main_subject: q.main_subject,
          subSubject: q.sub_subject,
          sub_subject: q.sub_subject,
          grade: q.grade,
          section: q.section,
          classLevel: q.class_level,
          class_level: q.class_level,
          teacherName: q.teacher_name,
          ownerTeacherCode: q.owner_teacher_code,
          schoolName: q.school_name,
          branch: q.branch,
          academicYear: q.academic_year,
          academic_year: q.academic_year,
          schoolYear: q.academic_year || '2025/2026',
          createdAt: q.created_at || new Date().toISOString(),
          updatedAt: q.updated_at || new Date().toISOString(),
          visibility: q.visibility,
          lesson_number: q.lesson_number ? Number(q.lesson_number) : undefined,
          lessonNumber: q.lesson_number ? Number(q.lesson_number) : undefined,
          showFeedback: q.show_feedback,
          timeLimitMinutes: q.time_limit_minutes,
          passPercentage: q.pass_percentage,
          allowAnswerChange: q.allow_answer_change,
          allowFullQuizRetake: q.allow_full_quiz_retake,
          questions: q.questions || [],
          synced: true,
        }));

        for (const q of mappedList) {
          await saveLocalQuiz(q, false);
        }
        return mappedList;
      }
    }
  } catch (e) {
    console.warn('API fetchAllQuizzes error, returning local quizzes:', e);
  }

  return await getLocalQuizzes();
}

export async function deleteQuizFromFirebase(quizId: string): Promise<void> {
  await deleteLocalQuiz(quizId);
  if (navigator.onLine) {
    try {
      await apiClient.delete(`/quizzes/${quizId}`);
    } catch (e) {
      console.warn('Failed to delete quiz on server:', e);
    }
  }
}

// ==========================================
// SUBMISSIONS API (Laravel Backend + Deduplication)
// ==========================================

export async function saveSubmission(
  submission: Submission
): Promise<{ success: boolean; synced: boolean; error?: string }> {
  try {
    const isOnline = navigator.onLine;
    await saveLocalSubmission(submission, !isOnline);

    if (isOnline) {
      const payload = {
        quiz_id: submission.quizId,
        student_name: submission.studentName,
        serial_number: submission.serialNumber,
        grade: submission.grade,
        section: submission.section,
        school_name: submission.schoolName,
        teacher_name: submission.teacherName,
        score: submission.score,
        max_score: submission.maxScore,
        percentage: submission.percentage,
        passed: submission.passed,
        correct_count: submission.correctCount,
        incorrect_count: submission.incorrectCount,
        skipped_count: submission.skippedCount,
        total_time_spent_seconds: submission.totalTimeSpentSeconds,
        details: submission.answers,
        guest_device_uuid: submission.guestDeviceUuid,
      };

      await apiClient.post('/submissions', payload);
      await markSubmissionSyncedLocally(submission.id);
      return { success: true, synced: true };
    }

    return { success: true, synced: false };
  } catch (err: any) {
    console.warn('Submission saved locally (offline):', err);
    return { success: true, synced: false, error: err.message };
  }
}

export async function checkGuestAlreadySubmitted(quizId: string, guestDeviceUuid: string): Promise<boolean> {
  try {
    const subs = await fetchSubmissionsForQuiz(quizId);
    return subs.some((s) => s.guestDeviceUuid === guestDeviceUuid);
  } catch {
    return false;
  }
}

export async function fetchSubmissionsForQuiz(quizId: string): Promise<Submission[]> {
  try {
    if (navigator.onLine) {
      const response = await apiClient.get('/submissions', { params: { quiz_id: quizId } });
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data.map((s: any) => ({
          id: String(s.id),
          quizId: String(s.quiz_id),
          quizTitle: s.quiz_title,
          studentName: s.student_name,
          serialNumber: s.serial_number,
          grade: s.grade,
          section: s.section,
          schoolName: s.school_name,
          teacherName: s.teacher_name,
          score: s.score,
          maxScore: s.max_score,
          percentage: s.percentage,
          passed: s.passed,
          correctCount: s.correct_count,
          incorrectCount: s.incorrect_count,
          skippedCount: s.skipped_count,
          totalTimeSpentSeconds: s.total_time_spent_seconds,
          answers: s.details || {},
          submittedAt: s.submitted_at,
          guestDeviceUuid: s.guest_device_uuid,
          synced: true,
        }));
      }
    }
  } catch (e) {
    console.warn('API fetchSubmissionsForQuiz error:', e);
  }

  return await getLocalSubmissionsForQuiz(quizId);
}

export async function fetchAllSubmissions(): Promise<Submission[]> {
  try {
    if (navigator.onLine) {
      const response = await apiClient.get('/submissions');
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data.map((s: any) => ({
          id: String(s.id),
          quizId: String(s.quiz_id),
          quizTitle: s.quiz_title,
          studentName: s.student_name,
          serialNumber: s.serial_number,
          grade: s.grade,
          section: s.section,
          schoolName: s.school_name,
          teacherName: s.teacher_name,
          score: s.score,
          maxScore: s.max_score,
          percentage: s.percentage,
          passed: s.passed,
          correctCount: s.correct_count,
          incorrectCount: s.incorrect_count,
          skippedCount: s.skipped_count,
          totalTimeSpentSeconds: s.total_time_spent_seconds,
          answers: s.details || {},
          submittedAt: s.submitted_at,
          guestDeviceUuid: s.guest_device_uuid,
          synced: true,
        }));
      }
    }
  } catch (e) {
    console.warn('API fetchAllSubmissions error:', e);
  }

  return await getAllLocalSubmissions();
}

// Sync Offline Pending Submissions Queue to Laravel Batch Sync
export async function syncOfflineData(): Promise<{ quizzesSynced: number; submissionsSynced: number }> {
  const result = await syncPendingSubmissionsToLaravel();
  return { quizzesSynced: 0, submissionsSynced: result.count };
}

// ==========================================
// ROSTER & AUTH API (Laravel Sanctum Auth)
// ==========================================

export async function verifyUserLogin(
  serialNumber: string,
  code: string,
  role?: 'student' | 'teacher'
): Promise<RosterUser | null> {
  try {
    const response = await apiClient.post('/auth/login', {
      serial_number: normalizeDigits(serialNumber),
      code: normalizeDigits(code),
      role,
    });

    if (response.data && response.data.data) {
      const { token, user } = response.data.data;
      if (token) {
        localStorage.setItem('sanctum_token', token);
        localStorage.setItem('auth_token', token);
      }
      return {
        id: String(user.id),
        name: user.name,
        role: user.role,
        serialNumber: user.serial_number,
        code: user.code,
        schoolName: user.school_name,
        branch: user.branch,
        grade: user.grade,
        section: user.section,
        createdAt: user.created_at || new Date().toISOString(),
      };
    }
  } catch (error: any) {
    console.warn('Auth login error:', error?.response?.data || error.message);
    const msg = error?.response?.data?.message || 'فشلت عملية الاتصال بالسيرفر لتسجيل الدخول.';
    throw new Error(msg);
  }
  return null;
}

export async function verifyStudentLogin(serialNumber: string, code: string): Promise<RosterUser | null> {
  return verifyUserLogin(serialNumber, code, 'student');
}

export async function verifyTeacherLogin(serialNumber: string, code: string): Promise<RosterUser | null> {
  return verifyUserLogin(serialNumber, code, 'teacher');
}

export async function loginWithSerialAndPasscode(
  serialNumber: string,
  code: string,
  role?: 'student' | 'teacher'
): Promise<{ success: boolean; error?: string; user?: RosterUser | null }> {
  try {
    const user = await verifyUserLogin(serialNumber, code, role);
    if (user) {
      return { success: true, user };
    }
    return { success: false, error: 'لم يتم العثور على سجل المستخدم في النظام.' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function findUserAndSchoolBySerial(
  serialNumber: string
): Promise<{ user: RosterUser; schoolName: string } | null> {
  const norm = normalizeDigits(serialNumber);
  const users = await fetchAllRosterUsers();
  const found = users.find((u) => u.serialNumber === norm || u.code === norm);
  if (found) {
    return { user: found, schoolName: found.schoolName || 'المدرسة' };
  }
  return null;
}

export async function fetchAllRosterUsers(schoolName?: string, forceRefresh: boolean = false): Promise<RosterUser[]> {
  try {
    if (navigator.onLine) {
      const response = await apiClient.get('/roster');
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data.map((u: any) => ({
          id: String(u.id),
          name: u.name,
          role: u.role,
          serialNumber: u.serial_number,
          code: u.code,
          schoolName: u.school_name,
          branch: u.branch,
          grade: u.grade,
          section: u.section,
          email: u.email,
          createdAt: u.created_at || new Date().toISOString(),
        }));
      }
    }
  } catch (e) {
    console.warn('Fetch roster error:', e);
  }
  return [];
}

export async function saveSingleRosterUserToFirebase(user: RosterUser): Promise<void> {
  try {
    await apiClient.post('/roster/single', {
      name: user.name,
      role: user.role,
      grade: user.grade,
      section: user.section,
      serial_number: user.serialNumber,
      code: user.code,
      email: user.email,
      branch: user.branch,
      school_name: user.schoolName,
    });
  } catch (e: any) {
    console.warn('Save single roster user failed:', e);
    const msg = e.response?.data?.message || 'فشلت عملية حفظ ومزامنة المستخدم الجديد مع السيرفر. يرجى التحقق من اتصالك.';
    throw new Error(msg);
  }
}

export async function syncRosterToFirebase(roster: RosterUser[]): Promise<void> {
  for (const user of roster) {
    await saveSingleRosterUserToFirebase(user);
  }
}

export async function deleteRosterUserFromFirebase(userId: string): Promise<void> {
  console.warn('Roster user deletion requested for ID:', userId);
}

// Subscriptions Polling Fallbacks
export function subscribeToQuizzes(onUpdate: (quizzes: QuizMetadata[]) => void, filterObj?: string | any): () => void {
  fetchAllQuizzes().then(onUpdate);
  const interval = setInterval(() => {
    fetchAllQuizzes().then(onUpdate);
  }, 10000);
  return () => clearInterval(interval);
}

export function subscribeToSubmissions(
  onUpdate: (submissions: Submission[]) => void,
  filterObj?: string | any,
  quizId?: string
): () => void {
  if (quizId) {
    fetchSubmissionsForQuiz(quizId).then(onUpdate);
  } else {
    fetchAllSubmissions().then(onUpdate);
  }

  const interval = setInterval(() => {
    if (quizId) {
      fetchSubmissionsForQuiz(quizId).then(onUpdate);
    } else {
      fetchAllSubmissions().then(onUpdate);
    }
  }, 10000);

  return () => clearInterval(interval);
}

export function subscribeToRoster(
  onUpdate: (roster: RosterUser[]) => void,
  filterObj?: string | any
): () => void {
  fetchAllRosterUsers().then(onUpdate);
  const interval = setInterval(() => {
    fetchAllRosterUsers().then(onUpdate);
  }, 15000);
  return () => clearInterval(interval);
}

export function subscribeToSchools(onUpdate: (schools: SupervisedSchool[]) => void): () => void {
  onUpdate([]);
  return () => {};
}

// Admin / License Stubs for full backward compatibility
export async function logLicenseAction(log: Omit<LicenseLog, 'id' | 'timestamp'>): Promise<void> {}
export async function fetchLicenseLogs(): Promise<LicenseLog[]> { return []; }
export async function saveSchoolToFirebase(school: SupervisedSchool): Promise<void> {}
export async function archiveSchoolInFirebase(schoolId: string, schoolName: string): Promise<void> {}
export async function deleteSchoolFromFirebase(schoolId: string): Promise<void> {}
export async function fetchAllSchools(): Promise<SupervisedSchool[]> {
  try {
    const saved = localStorage.getItem('interactive_quiz_schools');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error reading schools from localStorage:', e);
  }
  return [];
}
export async function upsertRosterUserInFirestore(user: RosterUser): Promise<void> { await saveSingleRosterUserToFirebase(user); }
export async function migrateOldUsersToSubCollections(progressCb?: any): Promise<{ success: boolean; totalMigrated: number; error: string | null }> {
  if (progressCb) progressCb(100, 100, 'تم التحويل إلى Laravel API');
  return { success: true, totalMigrated: 0, error: null };
}
export async function getSchoolUsersBySlug(schoolId: string): Promise<RosterUser[]> { return fetchAllRosterUsers(); }
export async function searchUsersGlobal(searchTerm: string): Promise<Array<RosterUser & { schoolId: string }>> { return []; }
export async function transferUserToSchool(...args: any[]): Promise<{ success: boolean; error: string | null }> {
  return { success: true, error: null };
}
export async function getSchoolsCount(): Promise<number> { return 1; }
export async function getRosterCount(role?: string, schoolSlug?: string): Promise<number> { return 0; }
export async function fetchSchoolsPaginated(...args: any[]): Promise<{ schools: SupervisedSchool[], lastDoc: any }> { 
  const schools = await fetchAllSchools();
  return { schools, lastDoc: null };
}
export async function fetchRosterPaginated(role?: string, schoolSlug?: string, lastDoc?: any, limitCount: number = 15): Promise<{ users: RosterUser[], lastDoc: any }> {
  try {
    const allUsers = await fetchAllRosterUsers(schoolSlug);
    let targetSchoolName = schoolSlug;
    if (schoolSlug) {
      const schools = await fetchAllSchools();
      const matchedSchool = schools.find(s => String(s.id) === schoolSlug || getSchoolSlug(s.name) === schoolSlug);
      if (matchedSchool) {
        targetSchoolName = matchedSchool.name;
      }
    }
    
    const filtered = allUsers.filter(u => {
      const roleMatch = !role || u.role === role;
      const schoolMatch = !schoolSlug || u.schoolName === targetSchoolName || getSchoolSlug(u.schoolName || '') === schoolSlug;
      return roleMatch && schoolMatch;
    });
    return { users: filtered, lastDoc: null };
  } catch (e) {
    console.warn('fetchRosterPaginated error:', e);
    return { users: [], lastDoc: null };
  }
}
