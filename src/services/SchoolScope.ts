import { QuizMetadata, Submission, RosterUser, TeacherProfile } from '../types';

/**
 * SchoolScope - Global Tenant Scope for Multi-Tenancy Data Isolation
 * Applies school-level isolation for Students, Teachers, Quizzes, and Answers/Submissions
 */

let activeSchoolScope: string | null = null;

export function setActiveSchoolScope(schoolName: string | null) {
  activeSchoolScope = schoolName && schoolName !== 'ALL' ? schoolName.trim() : null;
}

export function getActiveSchoolScope(): string | null {
  return activeSchoolScope;
}

/**
 * Filter Quizzes by SchoolScope
 */
export function applySchoolScopeToQuizzes(quizzes: QuizMetadata[], schoolName?: string | null): QuizMetadata[] {
  const targetSchool = schoolName !== undefined ? schoolName : activeSchoolScope;
  if (!targetSchool || targetSchool === 'ALL') return quizzes;
  const cleanTarget = targetSchool.trim().toLowerCase();
  return quizzes.filter((q) => !q.schoolName || q.schoolName.trim().toLowerCase() === cleanTarget);
}

/**
 * Filter Submissions/Answers by SchoolScope
 */
export function applySchoolScopeToSubmissions(submissions: Submission[], schoolName?: string | null): Submission[] {
  const targetSchool = schoolName !== undefined ? schoolName : activeSchoolScope;
  if (!targetSchool || targetSchool === 'ALL') return submissions;
  const cleanTarget = targetSchool.trim().toLowerCase();
  return submissions.filter((s) => !s.schoolName || s.schoolName.trim().toLowerCase() === cleanTarget);
}

/**
 * Filter Students (Roster) by SchoolScope
 */
export function applySchoolScopeToRoster(roster: RosterUser[], schoolName?: string | null): RosterUser[] {
  const targetSchool = schoolName !== undefined ? schoolName : activeSchoolScope;
  if (!targetSchool || targetSchool === 'ALL') return roster;
  const cleanTarget = targetSchool.trim().toLowerCase();
  return roster.filter((r) => !r.schoolName || r.schoolName.trim().toLowerCase() === cleanTarget);
}

/**
 * Filter Teachers by SchoolScope
 */
export function applySchoolScopeToTeachers(teachers: TeacherProfile[], schoolName?: string | null): TeacherProfile[] {
  const targetSchool = schoolName !== undefined ? schoolName : activeSchoolScope;
  if (!targetSchool || targetSchool === 'ALL') return teachers;
  const cleanTarget = targetSchool.trim().toLowerCase();
  return teachers.filter((t) => !t.schoolName || t.schoolName.trim().toLowerCase() === cleanTarget);
}
