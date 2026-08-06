export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_in'
  | 'essay'
  | 'matching'
  | 'drawing'
  | 'explain'
  | 'answer'
  | 'classify';

export interface Option {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface ClassificationGroup {
  category: string;
  items: string[];
}

export interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  options?: Option[];
  correctAnswer?: string; // For fill_in, true_false, direct answer
  matchingPairs?: MatchingPair[]; // For matching
  classification?: ClassificationGroup[]; // For classify
  drawingPrompt?: string; // For drawing
  explanation?: string; // Tawihe / Ilal / Explanation
  points: number;
}

export interface TeacherProfile {
  schoolName: string;
  branch: string;
  academicYear: string;
  teacherName: string;
  teacherCode?: string;
  email?: string;
  serialNumber?: string;
  grade?: string;
  section?: string;
  role?: 'student' | 'teacher' | 'admin';
  active_session_id?: string;
  last_activity_at?: number;
  public_ref_id?: string;
  subscription_end_date?: string;
  is_suspended?: boolean;
  is_unauthorized?: boolean;
}

export interface RosterUser {
  id: string;
  name: string; // الاسم
  role: 'student' | 'teacher' | 'admin'; // الصفة (طالب أو معلم أو مدير/مشرف)
  schoolName: string; // المدرسة
  branch: string; // الفرع
  grade?: string; // الصف
  section?: string; // الشعبة
  serialNumber: string; // الرقم التسلسلي (9 أرقام فريدة)
  code: string; // رقم الكود (7 أرقام)
  createdAt: string;
  updatedAt?: string;
  email?: string; // البريد الإلكتروني المربوط للحساب
  active_session_id?: string; // معرف الجلسة النشطة للحماية من الدخول المزدوج
  last_activity_at?: number; // وقت آخر نشاط للجلسة (تاريخ انتهاء الصلاحية بعد ساعتين)
  public_ref_id?: string; // الرمز المرجعي العام العشوائي (لا يستخدم للدخول)
  subscription_end_date?: string; // تاريخ نهاية الصلاحية / الاشتراك
  isDuplicateReplaced?: boolean; // تم تغيير الرقم التسلسلي/الكود لوجود تكرار
  is_suspended?: boolean;
  is_unauthorized?: boolean;
}

export const SUBJECT_CATEGORIES: Record<string, string[]> = {
  'القرآن الكريم': ['حفظ وتفسير', 'تجويد', 'تلاوة'],
  'التربية الإسلامية': ['إيمان', 'حديث', 'فقه', 'سيرة'],
  'اللغة العربية': ['نحو', 'أدب', 'نصوص', 'بلاغة', 'نقد', 'قراءة'],
  'اللغة الإنجليزية': ['عام'],
  'الرياضيات': ['جبر', 'هندسة', 'تفاضل', 'تكامل', 'إحصاء'],
  'العلوم': ['علوم'],
  'الكيمياء': ['كيمياء'],
  'الفيزياء': ['فيزياء'],
  'الأحياء': ['أحياء'],
  'الاجتماعيات': ['تاريخ', 'مجتمع', 'جغرافيا', 'وطنية'],
  'الحاسوب الآلي': ['حاسوب'],
};

export const CLASS_LEVELS = [
  'الكل',
  'تمهيدي',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
];

export interface QuizMetadata {
  id: string;
  title: string;
  subject: string; // المادة
  grade: string; // الصف
  section: string; // الشعبة
  teacherName: string; // اسم المعلم
  schoolName: string; // اسم المدرسة
  branch: string; // الفرع (أدبي/علمي/عام...)
  schoolYear: string; // السنة الدراسية
  createdAt: string; // تاريخ كتابة الاختبار
  showFeedback: 'immediate' | 'end'; // إظهار التغذية الراجعة (فوراً أم في النهاية)
  timeLimitMinutes?: number;
  passPercentage?: number;
  questions: Question[];
  updatedAt: string;
  synced?: boolean;

  // Phase 4 Fields
  visibility?: 'public' | 'private'; // حالة الاختبار (علني أم خاص)
  lesson_number?: number; // رقم الدرس (1 إلى 50)
  lessonNumber?: number;
  class_level?: string; // الصف الدراسي
  classLevel?: string;
  main_subject?: string; // المادة الأساسية
  mainSubject?: string;
  sub_subject?: string; // فرع المادة
  subSubject?: string;
  academic_year?: string; // العام الدراسي (هجري/ميلادي)
  academicYear?: string;
  ownerTeacherCode?: string; // كود المعلم المنشئ للاختبار
  allowAnswerChange?: boolean; // يسمح للطالب بأن يعيد الإجابة على السؤال (افتراضياً: غير مفعل)
  allowFullQuizRetake?: boolean; // السماح بإعادة الاختبار كاملا (تصفير الإجابات وخلط الأسئلة)
}

export interface StudentAnswer {
  questionId: string;
  answer: any; // string, string[], object, drawing data URL, etc.
  isCorrect?: boolean | null;
  earnedPoints?: number;
  skipped?: boolean;
  timeSpentSeconds?: number;
  isConfirmed?: boolean;
}

export interface SubmissionDetail {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  studentAnswer: any;
  correctAnswer: any;
  isCorrect: boolean | null;
  points: number;
  earnedPoints: number;
  skipped: boolean;
  explanation?: string;
  timeSpentSeconds?: number;
}

export interface Submission {
  id: string;
  quizId: string;
  quizTitle: string;
  studentName: string;
  serialNumber?: string;
  grade: string;
  section: string;
  schoolName?: string;
  teacherName?: string;
  score: number;
  maxScore: number;
  percentage?: number;
  passed?: boolean;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  totalTimeSpentSeconds?: number;
  details: SubmissionDetail[];
  answers?: Record<string, any>;
  submittedAt: string;
  synced: boolean;
  guestDeviceUuid?: string;
}

export interface SecretariatStaff {
  id: string;
  name: string;
  staffCode: string;
  rolePermissions: string[];
  schoolId?: string;
  schoolName?: string;
  branchId?: string;
  branchName?: string;
  isSoftDeleted?: boolean;
  createdAt: string;
}

export interface LicenseLog {
  id: string;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  actionType: 'renewal' | 'status_change' | 'archive' | 'max_quota_update' | 'impersonation';
  details: string;
  adminInfo?: string;
}

export interface SupervisedSchool {
  id: string;
  name: string;
  branch: string;
  activationYear: string;
  teacherCount: number;
  maxTeachers?: number;
  quizCount: number;
  studentCount?: number;
  maxStudents?: number;
  isActive: boolean;
  status?: 'active' | 'warning' | 'expired' | 'suspended' | 'read_only' | 'archived';
  subscription_end_date?: string;
  is_suspended?: boolean;
  is_unauthorized?: boolean;
  is_archived?: boolean;
}
