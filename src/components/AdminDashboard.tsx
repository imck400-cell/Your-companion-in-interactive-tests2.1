import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  saveSingleRosterUserToFirebase,
  deleteRosterUserFromFirebase,
  saveSchoolToFirebase,
  deleteSchoolFromFirebase,
  fetchAllSchools,
  subscribeToSchools,
  normalizeDigits,
  generateDeterministicUserId,
  getSchoolSlug,
  getSchoolUsersBySlug,
  searchUsersGlobal,
  transferUserToSchool,
  migrateOldUsersToSubCollections,
  logLicenseAction,
  fetchLicenseLogs,
  archiveSchoolInFirebase,
  findUserAndSchoolBySerial,
  fetchSchoolsPaginated,
  fetchRosterPaginated,
  getSchoolsCount,
  getRosterCount
} from '../services/firebase';
import {
  ShieldCheck,
  School,
  Building,
  Calendar,
  Clock,
  Database,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Key,
  UserCheck,
  RefreshCw,
  Layers,
  Lock,
  Users,
  ShieldAlert,
  Sparkles,
  UserX,
  Power,
  RotateCcw,
  CalendarPlus,
  UserPlus,
  Check,
  X,
  Code2,
  FileCode,
  Search,
  Filter,
  AlertTriangle,
  LogOut,
  ChevronRight,
  GraduationCap,
  Globe,
  ArrowLeftRight,
  Building2,
  Bell,
  FileSpreadsheet,
  Archive,
  ArchiveX,
  Eye,
  Activity,
  Download
} from 'lucide-react';
import { SecretariatStaff, RosterUser, TeacherProfile, SupervisedSchool, LicenseLog } from '../types';


interface AdminDashboardProps {
  onLogout: () => void;
  roster?: RosterUser[];
  onUpdateRoster?: (updatedRoster: RosterUser[]) => void;
  teacherProfile?: TeacherProfile | null;
  onUpdateTeacherProfile?: (updatedProfile: TeacherProfile) => void;
  onImpersonate?: (school: { id: string; name: string; branch: string }) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLogout,
  roster = [],
  onUpdateRoster,
  teacherProfile,
  onUpdateTeacherProfile,
  onImpersonate,
}) => {
  // Navigation Sub-Tabs inside Admin Panel
  const [adminTab, setAdminTab] = useState<'schools' | 'users' | 'staff' | 'code_views' | 'migration' | 'logs'>('schools');

  // SaaS Admin V2 Additional States
  const [showArchivedSchools, setShowArchivedSchools] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [licenseLogs, setLicenseLogs] = useState<LicenseLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Data Migration Script State (Stage 4)
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; totalMigrated: number; error?: string } | null>(null);

  const handleStartMigration = async () => {
    if (!confirm('هل أنت متأكد من بدء عملية نقل وترحيل البيانات القديمة إلى المجموعات الفرعية المعزولة (/schools/{school_id}/users)؟')) return;
    setIsMigrating(true);
    setMigrationResult(null);
    setMigrationProgress({ current: 0, total: 0, message: 'بدء الاتصال بسحابة Firebase وجلب بيانات roster_users...' });

    const res = await migrateOldUsersToSubCollections((current, total, message) => {
      setMigrationProgress({ current, total, message });
    });

    setIsMigrating(false);
    setMigrationResult(res);

    if (res.success) {
      showToast(`تم اكتمال ترحيل البيانات بنجاح! إجمالي الحسابات التي تم نقلها: ${res.totalMigrated}`);
    } else {
      showToast(`فشلت عملية الترحيل: ${res.error}`);
    }
  };

  // Super Admin Multi-Tenancy Management State
  const [selectedMasterSchoolSlug, setSelectedMasterSchoolSlug] = useState<string>('all');
  const [isolatedSchoolUsers, setIsolatedSchoolUsers] = useState<RosterUser[]>([]);
  const [isLoadingIsolatedUsers, setIsLoadingIsolatedUsers] = useState<boolean>(false);

  // Sub-view toggle in 'users' tab: 'all' | 'teachers' | 'students' | 'global_search'
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'teachers' | 'students' | 'global_search'>('all');

  // Global Cross-Tenant Search State
  const [globalSearchTerm, setGlobalSearchTerm] = useState<string>('');
  const [globalSearchResults, setGlobalSearchResults] = useState<Array<RosterUser & { schoolId: string }>>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState<boolean>(false);

  // Orphan Student Transfer Modal State
  const [transferModalUser, setTransferModalUser] = useState<(RosterUser & { schoolId?: string }) | null>(null);
  const [transferTargetSchoolSlug, setTransferTargetSchoolSlug] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Effect: Fetch isolated users when selecting specific master school
  useEffect(() => {
    if (adminTab !== 'users') return;

    if (selectedMasterSchoolSlug && selectedMasterSchoolSlug !== 'all') {
      setIsLoadingIsolatedUsers(true);
      getSchoolUsersBySlug(selectedMasterSchoolSlug).then((fetchedUsers) => {
        setIsolatedSchoolUsers(fetchedUsers);
        setIsLoadingIsolatedUsers(false);
      });
    } else {
      setIsolatedSchoolUsers([]);
    }
  }, [selectedMasterSchoolSlug, adminTab]);

  // Effect: Fetch Audit Trail logs when navigating to 'logs' tab
  useEffect(() => {
    if (adminTab === 'logs') {
      setIsLoadingLogs(true);
      fetchLicenseLogs().then((logs) => {
        setLicenseLogs(logs);
        setIsLoadingLogs(false);
      });
    }
  }, [adminTab]);

  // Handler: Run Global Cross-Tenant Search using collectionGroup('users')
  const handleRunGlobalSearch = async () => {
    if (!globalSearchTerm.trim()) return;
    setIsSearchingGlobal(true);
    const results = await searchUsersGlobal(globalSearchTerm);
    setGlobalSearchResults(results);
    setIsSearchingGlobal(false);
  };

  // Handler: Execute Transfer of Student from current school path to new school path
  const handleExecuteTransfer = async () => {
    if (!transferModalUser || !transferTargetSchoolSlug) return;
    const targetSchoolObj = schools.find(
      (s) => getSchoolSlug(s.name) === transferTargetSchoolSlug || s.id === transferTargetSchoolSlug
    );
    if (!targetSchoolObj) {
      showToast('خطأ: لم يتم العثور على المدرسة المستهدفة.');
      return;
    }

    setIsTransferring(true);
    const oldSchoolId = transferModalUser.schoolId || getSchoolSlug(transferModalUser.schoolName);
    const targetSchoolSlug = getSchoolSlug(targetSchoolObj.name);

    const res = await transferUserToSchool(
      transferModalUser,
      oldSchoolId,
      targetSchoolSlug,
      targetSchoolObj.name
    );

    setIsTransferring(false);

    if (res.success) {
      showToast(`تم نقل الطالب (${transferModalUser.name}) بنجاح إلى: ${targetSchoolObj.name}`);
      setTransferModalUser(null);

      // Refresh isolated list if viewing that school
      if (selectedMasterSchoolSlug && selectedMasterSchoolSlug !== 'all') {
        const updated = await getSchoolUsersBySlug(selectedMasterSchoolSlug);
        setIsolatedSchoolUsers(updated);
      }
      // Refresh global search if active
      if (globalSearchTerm) {
        handleRunGlobalSearch();
      }
    } else {
      showToast(`فشلت عملية النقل: ${res.error}`);
    }
  };

  // Initial seed default schools
  const DEFAULT_SEED_SCHOOLS: SupervisedSchool[] = [
    {
      id: 'sch-1',
      name: 'مدرسة الفاروق النموذجية الثانوية',
      branch: 'عام / بنين',
      activationYear: '1448هـ / 2026م',
      teacherCount: 18,
      quizCount: 42,
      isActive: true,
      subscription_end_date: '2027-06-30',
      is_suspended: false,
      is_unauthorized: false,
    },
    {
      id: 'sch-2',
      name: 'ثانوية القدس للبنات',
      branch: 'عام / بنات',
      activationYear: '1448هـ / 2026م',
      teacherCount: 22,
      quizCount: 56,
      isActive: true,
      subscription_end_date: '2027-05-15',
      is_suspended: false,
      is_unauthorized: false,
    },
    {
      id: 'sch-3',
      name: 'معهد النور التعليمي المتقدم',
      branch: 'نموذجي / مختلط',
      activationYear: '1448هـ / 2026م',
      teacherCount: 12,
      quizCount: 31,
      isActive: false,
      subscription_end_date: '2026-02-01', // Expired
      is_suspended: false,
      is_unauthorized: false,
    },
    {
      id: 'sch-4',
      name: 'مدرسة الأمل الأهلية الجديدة',
      branch: 'خاص / متميز',
      activationYear: '1448هـ / 2026م',
      teacherCount: 5,
      quizCount: 4,
      isActive: false,
      subscription_end_date: '2026-12-31',
      is_suspended: false,
      is_unauthorized: true, // Pending admin approval
    },
  ];

  // Pre-loaded Supervised Schools (persisted in localStorage & Firestore)
  const [schools, setSchools] = useState<SupervisedSchool[]>(() => {
    const saved = localStorage.getItem('interactive_quiz_schools');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse schools from storage', e);
      }
    }
    return DEFAULT_SEED_SCHOOLS;
  });


  // --- Phase 1 Pagination States ---
  const [schoolsLastDoc, setSchoolsLastDoc] = useState<any>(null);
  const [hasMoreSchools, setHasMoreSchools] = useState(true);
  const [isFetchingSchools, setIsFetchingSchools] = useState(false);
  const [totalSchoolsCount, setTotalSchoolsCount] = useState<number | null>(null);

  const [usersLastDoc, setUsersLastDoc] = useState<any>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);

  const [staffLastDoc, setStaffLastDoc] = useState<any>(null);
  const [hasMoreStaff, setHasMoreStaff] = useState(true);
  const [isFetchingStaff, setIsFetchingStaff] = useState(false);
  const [totalStaffCount, setTotalStaffCount] = useState<number | null>(null);

  const loadSchoolsPage = async (isLoadMore = false) => {
    setIsFetchingSchools(true);
    if (!isLoadMore) {
      const cnt = await getSchoolsCount();
      setTotalSchoolsCount(cnt);
    }
    const { schools: newSchools, lastDoc } = await fetchSchoolsPaginated(isLoadMore ? schoolsLastDoc : null, 15);
    setSchools(prev => isLoadMore ? [...prev, ...newSchools] : newSchools);
    setSchoolsLastDoc(lastDoc);
    setHasMoreSchools(!!lastDoc);
    setIsFetchingSchools(false);
  };

  const loadUsersPage = async (isLoadMore = false) => {
    setIsFetchingUsers(true);
    if (!isLoadMore) {
      const cnt = await getRosterCount('student', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined);
      setTotalUsersCount(cnt);
    }
    const { users: newUsers, lastDoc } = await fetchRosterPaginated('student', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined, isLoadMore ? usersLastDoc : null, 15);
    
    // We update localRoster with the paginated users, but carefully. 
    // Wait, the UI might be mapped to localRoster or isolatedSchoolUsers. Let's merge them into localRoster for display.
    setLocalRoster(prev => {
      const existing = isLoadMore ? prev : [];
      const mergedMap = new Map(existing.map(u => [u.id, u]));
      newUsers.forEach(u => mergedMap.set(u.id, u));
      return Array.from(mergedMap.values());
    });
    
    setUsersLastDoc(lastDoc);
    setHasMoreUsers(!!lastDoc);
    setIsFetchingUsers(false);
  };

  const loadStaffPage = async (isLoadMore = false) => {
    setIsFetchingStaff(true);
    if (!isLoadMore) {
      const cnt = await getRosterCount('teacher', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined);
      setTotalStaffCount(cnt);
    }
    const { users: newStaff, lastDoc } = await fetchRosterPaginated('teacher', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined, isLoadMore ? staffLastDoc : null, 15);
    
    setLocalRoster(prev => {
      // we only replace teachers or we can just keep them separated. 
      // Actually AdminDashboard filters localRoster by role. So we can just merge.
      const existing = isLoadMore ? prev : prev.filter(u => u.role !== 'teacher');
      const mergedMap = new Map(existing.map(u => [u.id, u]));
      newStaff.forEach(u => mergedMap.set(u.id, u));
      return Array.from(mergedMap.values());
    });

    setStaffLastDoc(lastDoc);
    setHasMoreStaff(!!lastDoc);
    setIsFetchingStaff(false);
  };

  // Toast feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Local managed Roster Users (fallback or synchronized with App props)
  const [localRoster, setLocalRoster] = useState<RosterUser[]>(
    roster.length > 0
      ? roster
      : [
          {
            id: 'rost-101',
            name: 'أحمد علي حسن (معلم)',
            role: 'teacher',
            schoolName: 'مدرسة الفاروق النموذجية الثانوية',
            branch: 'عام / بنين',
            grade: '12',
            section: 'أ',
            serialNumber: '772324001',
            code: '7808041',
            createdAt: '2026-01-15',
            email: 'ahmed.teacher@school.edu',
            active_session_id: 'session_active_lab_computer_99',
            last_activity_at: Date.now() - 15 * 60 * 1000, // Active 15 mins ago
            subscription_end_date: '2027-01-01',
            is_suspended: false,
            is_unauthorized: false,
          },
          {
            id: 'rost-102',
            name: 'محمود سامي خليل (طالب)',
            role: 'student',
            schoolName: 'ثانوية القدس للبنات',
            branch: 'عام / بنات',
            grade: '11',
            section: 'ب',
            serialNumber: '772324002',
            code: '7808042',
            createdAt: '2026-02-01',
            email: 'mahmoud@student.edu',
            active_session_id: 'session_active_student_lab_02',
            last_activity_at: Date.now() - 5 * 60 * 1000, // Active 5 mins ago
            subscription_end_date: '2026-12-31',
            is_suspended: false,
            is_unauthorized: false,
          },
          {
            id: 'rost-103',
            name: 'خالد عبدالله العمر (طالب)',
            role: 'student',
            schoolName: 'معهد النور التعليمي المتقدم',
            branch: 'نموذجي / مختلط',
            grade: '10',
            section: 'ج',
            serialNumber: '772324003',
            code: '7808043',
            createdAt: '2026-02-10',
            email: 'khaled@school.edu',
            subscription_end_date: '2026-01-10', // Expired
            is_suspended: false,
            is_unauthorized: false,
          },
          {
            id: 'rost-104',
            name: 'سامر ياسين جابر (مستخدم جديد)',
            role: 'student',
            schoolName: 'مدرسة الأمل الأهلية الجديدة',
            branch: 'خاص',
            grade: '12',
            section: 'أ',
            serialNumber: '772324004',
            code: '7808044',
            createdAt: '2026-03-01',
            subscription_end_date: '2026-12-31',
            is_suspended: false,
            is_unauthorized: true, // Pending manual authorization
          },
        ]
  );

  // School Teachers View Modal State
  const [selectedSchoolForTeachers, setSelectedSchoolForTeachers] = useState<SupervisedSchool | null>(null);
  const [schoolTeacherSearchQuery, setSchoolTeacherSearchQuery] = useState('');

  // Sync roster prop from parent to localRoster
  useEffect(() => {
    if (roster && roster.length > 0) {
      setLocalRoster(roster);
    }
  }, [roster]);

  // Phase 1: Disabled Auto-Fetch on Mount for Schools. Using Pagination.

  // Helper to calculate teachers count for a school
  const getTeachersCountForSchool = (sch: SupervisedSchool) => {
    const matchedCount = localRoster.filter(
      (u) => (u.schoolName === sch.name || u.schoolName?.trim() === sch.name?.trim()) && u.role === 'teacher'
    ).length;
    return Math.max(matchedCount, sch.teacherCount || 0);
  };

  // Filter state for Tab 2
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilterStatus, setUserFilterStatus] = useState<'all' | 'session_locked' | 'suspended' | 'unauthorized' | 'expired'>('all');

  // Modal / Form state for adding new school
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolBranch, setNewSchoolBranch] = useState('عام');
  const [newSchoolEndDate, setNewSchoolEndDate] = useState('2027-06-30');
  const [newSchoolStartUnauthorized, setNewSchoolStartUnauthorized] = useState(true); // "غير مصرح" by default until approved

  // Staff (Teacher) Addition inside School Card
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [selectedSchoolForStaff, setSelectedSchoolForStaff] = useState<SupervisedSchool | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffSerial, setStaffSerial] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [staffPermissions, setStaffPermissions] = useState('معلم');
  const [staffValidity, setStaffValidity] = useState('سنة دراسية واحدة');
  const [staffAcademicYear, setStaffAcademicYear] = useState('1448هـ / 2026 - 2027م');
  const [staffGrades, setStaffGrades] = useState<string[]>(['1']);
  const [staffSections, setStaffSections] = useState<string[]>(['أ']);

  // Filters for School Teachers & Staff Table inside Modal
  const [schoolStaffRoleFilter, setSchoolStaffRoleFilter] = useState<'all' | 'teachers' | 'students'>('all');
  const [schoolStaffGradeFilter, setSchoolStaffGradeFilter] = useState<string>('all');
  const [schoolStaffSectionFilter, setSchoolStaffSectionFilter] = useState<string>('all');

  // Staff Editing State
  const [editingStaff, setEditingStaff] = useState<RosterUser | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffSerial, setEditStaffSerial] = useState('');
  const [editStaffCode, setEditStaffCode] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'teacher' | 'admin' | 'student'>('teacher');
  const [editStaffGrades, setEditStaffGrades] = useState<string[]>(['1']);
  const [editStaffSections, setEditStaffSections] = useState<string[]>(['أ']);
  const [editStaffBranch, setEditStaffBranch] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');

  const ALL_GRADES = ['تمهيدي', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const ALL_SECTIONS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ي'];

  const toggleStaffGrade = (g: string) => {
    setStaffGrades((prev) =>
      prev.includes(g) ? (prev.length > 1 ? prev.filter((item) => item !== g) : prev) : [...prev, g]
    );
  };

  const toggleStaffSection = (s: string) => {
    setStaffSections((prev) =>
      prev.includes(s) ? (prev.length > 1 ? prev.filter((item) => item !== s) : prev) : [...prev, s]
    );
  };

  const toggleEditStaffGrade = (g: string) => {
    setEditStaffGrades((prev) =>
      prev.includes(g) ? (prev.length > 1 ? prev.filter((item) => item !== g) : prev) : [...prev, g]
    );
  };

  const toggleEditStaffSection = (s: string) => {
    setEditStaffSections((prev) =>
      prev.includes(s) ? (prev.length > 1 ? prev.filter((item) => item !== s) : prev) : [...prev, s]
    );
  };

  // Date Extension Modal State
  const [selectedSchoolForRenewal, setSelectedSchoolForRenewal] = useState<SupervisedSchool | null>(null);
  const [customRenewalDate, setCustomRenewalDate] = useState('');

  // User Date Extension Modal State
  const [selectedUserForRenewal, setSelectedUserForRenewal] = useState<RosterUser | null>(null);
  const [userRenewalDate, setUserRenewalDate] = useState('');

  // Permissions Control Gate State
  const [isPermissionsAuthOpen, setIsPermissionsAuthOpen] = useState(false);
  const [secondaryPassword, setSecondaryPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasPermissionsAccess, setHasPermissionsAccess] = useState(false);

  // Secretariat Staff Table State
  const [staffList, setStaffList] = useState<SecretariatStaff[]>([
    {
      id: 'st-1',
      name: 'أحمد محمود السكرتير العام',
      staffCode: 'SEC-8821',
      rolePermissions: ['إدارة الطلاب', 'عرض تقارير المدرسة', 'الإشراف على الفروع'],
      schoolName: 'مدرسة الفاروق النموذجية الثانوية',
      branchName: 'عام / بنين',
      isSoftDeleted: false,
      createdAt: '2026-02-10',
    },
    {
      id: 'st-2',
      name: 'سارة خالد مشرف القبول',
      staffCode: 'SEC-4412',
      rolePermissions: ['تصدير النتائج', 'عرض تقارير المدرسة'],
      schoolName: 'ثانوية القدس للبنات',
      branchName: 'عام / بنات',
      isSoftDeleted: false,
      createdAt: '2026-03-01',
    },
  ]);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [selectedStaffSchool, setSelectedStaffSchool] = useState('مدرسة الفاروق النموذجية الثانوية');

  // Code Copy State
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => setCopiedSection(null), 3000);
  };

  // Helper date checker
  const todayStr = new Date().toISOString().split('T')[0];

  const getSchoolStatusBadge = (sch: SupervisedSchool) => {
    if (sch.is_suspended) {
      return {
        label: 'معلق إدارياً',
        className: 'bg-rose-100 text-rose-800 border-rose-300',
        icon: UserX,
      };
    }
    if (sch.is_unauthorized) {
      return {
        label: 'غير مصرح (في الانتظار)',
        className: 'bg-purple-100 text-purple-800 border-purple-300',
        icon: Lock,
      };
    }
    if (sch.subscription_end_date && sch.subscription_end_date < todayStr) {
      return {
        label: 'منتهي الصلاحية',
        className: 'bg-amber-100 text-amber-900 border-amber-300',
        icon: Clock,
      };
    }
    return {
      label: 'نشط ومصرح',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: CheckCircle2,
    };
  };

  const getUserStatusBadge = (usr: RosterUser) => {
    if (usr.is_suspended) {
      return {
        label: 'حساب موقوف',
        className: 'bg-rose-100 text-rose-800 border-rose-300',
        icon: UserX,
      };
    }
    if (usr.is_unauthorized) {
      return {
        label: 'غير مصرح له',
        className: 'bg-purple-100 text-purple-800 border-purple-300',
        icon: Lock,
      };
    }
    if (usr.subscription_end_date && usr.subscription_end_date < todayStr) {
      return {
        label: 'منتهي الصلاحية',
        className: 'bg-amber-100 text-amber-900 border-amber-300',
        icon: Clock,
      };
    }
    return {
      label: 'ساري ومصرح',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: CheckCircle2,
    };
  };

  // 1. Add School Handler
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    const newSch: SupervisedSchool = {
      id: `sch-${Date.now()}`,
      name: newSchoolName.trim(),
      branch: newSchoolBranch,
      activationYear: '1448هـ / 2026م',
      teacherCount: 1,
      quizCount: 0,
      isActive: !newSchoolStartUnauthorized,
      subscription_end_date: newSchoolEndDate,
      is_suspended: false,
      is_unauthorized: newSchoolStartUnauthorized,
    };

    const updatedSchools = [newSch, ...schools];
    setSchools(updatedSchools);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));
    await saveSchoolToFirebase(newSch);
    setNewSchoolName('');
    setIsAddSchoolOpen(false);
    showToast(
      newSchoolStartUnauthorized
        ? `تم إضافة مدرسة (${newSch.name}) بحالة (غير مصرح) وحفظها في سحابة Firebase.`
        : `تم إضافة وتفعيل ترخيص مدرسة (${newSch.name}) بنجاح في سحابة Firebase حتى تاريخ ${newSch.subscription_end_date}.`
    );
  };

  const openAddStaffModal = (school: SupervisedSchool) => {
    setSelectedSchoolForStaff(school);
    setStaffName('');
    setStaffSerial('');
    setStaffCode('');
    setStaffPermissions('معلم');
    setStaffValidity('سنة دراسية واحدة');
    setStaffGrades(['1']);
    setStaffSections(['أ']);
    setIsAddStaffOpen(true);
  };

  const generateStaffSerial = () => {
    const randomNum = Math.floor(100000000 + Math.random() * 900000000);
    setStaffSerial(String(randomNum));
  };

  const generateStaffCode = () => {
    const randomNum = Math.floor(1000000 + Math.random() * 9000000);
    setStaffCode(String(randomNum));
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolForStaff || !staffName.trim() || !staffSerial.trim() || !staffCode.trim()) return;

    const normSerial = normalizeDigits(staffSerial.trim());
    const normCode = normalizeDigits(staffCode.trim());

    const userRole = staffPermissions === 'طالب' ? 'student' : staffPermissions === 'مدير' || staffPermissions === 'مشرف' ? 'admin' : 'teacher';

    const newUser: RosterUser = {
      id: generateDeterministicUserId(selectedSchoolForStaff.name, normSerial),
      name: staffName.trim(),
      role: userRole,
      schoolName: selectedSchoolForStaff.name,
      branch: selectedSchoolForStaff.branch,
      grade: staffGrades.length > 0 ? staffGrades.join(', ') : '1',
      section: staffSections.length > 0 ? staffSections.join(', ') : 'أ',
      serialNumber: normSerial,
      code: normCode,
      createdAt: new Date().toISOString(),
      subscription_end_date: selectedSchoolForStaff.subscription_end_date,
    };

    const updatedRoster = [newUser, ...localRoster];
    setLocalRoster(updatedRoster);
    if (onUpdateRoster) {
      onUpdateRoster(updatedRoster);
    }

    try {
      await saveSingleRosterUserToFirebase(newUser);
    } catch (err) {
      console.error('Failed to save staff to Firebase', err);
    }

    // Update school's teacher count locally, in localStorage & in Firebase
    const updatedSchools = schools.map((s) => {
      if (s.id === selectedSchoolForStaff.id || s.name === selectedSchoolForStaff.name) {
        const updatedS = { ...s, teacherCount: (s.teacherCount || 0) + 1 };
        saveSchoolToFirebase(updatedS);
        return updatedS;
      }
      return s;
    });
    setSchools(updatedSchools);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));

    setIsAddStaffOpen(false);
    showToast(`تم إضافة (${newUser.name}) برقم تسلسلي (${newUser.serialNumber}) وكود (${newUser.code}) بنجاح وحفظه في سحابة Firebase.`);
  };

  const handleDeleteTeacherFromSchool = async (user: RosterUser) => {
    if (!confirm(`هل أنت متأكد من حذف المعلم/الكادر (${user.name}) المضاف لهذه المدرسة؟`)) return;

    const updatedRoster = localRoster.filter((u) => u.id !== user.id);
    setLocalRoster(updatedRoster);
    if (onUpdateRoster) {
      onUpdateRoster(updatedRoster);
    }

    try {
      await deleteRosterUserFromFirebase(user.id);
    } catch (err) {
      console.error('Failed to delete teacher from Firebase:', err);
    }

    if (selectedSchoolForTeachers) {
      const updatedSchools = schools.map((s) => {
        if (s.name === selectedSchoolForTeachers.name || s.id === selectedSchoolForTeachers.id) {
          const updatedS = { ...s, teacherCount: Math.max(0, (s.teacherCount || 1) - 1) };
          saveSchoolToFirebase(updatedS);
          return updatedS;
        }
        return s;
      });
      setSchools(updatedSchools);
      localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));
    }

    showToast(`تم حذف المعلم/الكادر (${user.name}) من المدرسة وسحابة Firebase بنجاح.`);
  };

  // Open Edit Staff Modal
  const openEditStaffModal = (usr: RosterUser) => {
    setEditingStaff(usr);
    setEditStaffName(usr.name || '');
    setEditStaffSerial(usr.serialNumber || '');
    setEditStaffCode(usr.code || '');
    setEditStaffRole(usr.role || 'teacher');

    const parsedGrades = usr.grade ? usr.grade.split(',').map((g) => g.trim()).filter(Boolean) : ['1'];
    setEditStaffGrades(parsedGrades.length > 0 ? parsedGrades : ['1']);

    const parsedSections = usr.section ? usr.section.split(',').map((s) => s.trim()).filter(Boolean) : ['أ'];
    setEditStaffSections(parsedSections.length > 0 ? parsedSections : ['أ']);

    setEditStaffBranch(usr.branch || (selectedSchoolForTeachers?.branch || 'عام'));
    setEditStaffEmail(usr.email || '');
  };

  // Save Edit Staff Submit
  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editStaffName.trim() || !editStaffSerial.trim() || !editStaffCode.trim()) return;

    const normSerial = normalizeDigits(editStaffSerial.trim());
    const normCode = normalizeDigits(editStaffCode.trim());

    const updatedUser: RosterUser = {
      ...editingStaff,
      name: editStaffName.trim(),
      serialNumber: normSerial,
      code: normCode,
      role: editStaffRole,
      grade: editStaffGrades.length > 0 ? editStaffGrades.join(', ') : '1',
      section: editStaffSections.length > 0 ? editStaffSections.join(', ') : 'أ',
      branch: editStaffBranch.trim(),
      email: editStaffEmail.trim(),
      updatedAt: new Date().toISOString(),
    };

    const updatedRoster = localRoster.map((u) => (u.id === editingStaff.id ? updatedUser : u));
    setLocalRoster(updatedRoster);
    if (onUpdateRoster) {
      onUpdateRoster(updatedRoster);
    }

    try {
      await saveSingleRosterUserToFirebase(updatedUser);
    } catch (err) {
      console.error('Failed to save edited staff to Firebase:', err);
    }

    setEditingStaff(null);
    showToast(`تم تعديل بيانات وصلاحيات المعلم/الكادر (${updatedUser.name}) بنجاح ومزامنتها سحابياً عبر Firebase.`);
  };

  // Excel Staff Export Handler (Export RTL Excel for School)
  const handleExportSchoolStaffExcel = (targetSchool: SupervisedSchool) => {
    const schoolUsers = localRoster.filter(
      (u) =>
        u.schoolName === targetSchool.name ||
        (targetSchool.name && u.schoolName?.trim() === targetSchool.name?.trim())
    );

    if (schoolUsers.length === 0) {
      showToast('لا يوجد أسماء كادر أو طلاب مسجلة في هذه المدرسة لتصديرها.');
      return;
    }

    const exportData = schoolUsers.map((usr) => {
      let roleLabel = 'معلم / كادر تدريسي';
      if (usr.role === 'student') roleLabel = 'طالب';
      else if (usr.role === 'admin') roleLabel = 'مدير / مشرف';

      return {
        'الاسم': usr.name || '',
        'الرقم التسلسلي': usr.serialNumber || '',
        'رقم الكود': usr.code || '',
        'الصلاحيات': roleLabel,
        'الصف': usr.grade || '1',
        'الشعبة': usr.section || 'أ',
        'البريد الإلكتروني': usr.email || '',
        'المدرسة': usr.schoolName || targetSchool.name,
        'الفرع': usr.branch || targetSchool.branch || 'عام',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!dir'] = 'rtl';

    const workbook = XLSX.utils.book_new();
    if (!workbook.Workbook) workbook.Workbook = {};
    if (!workbook.Workbook.Views) workbook.Workbook.Views = [{}];
    workbook.Workbook.Views[0].RTL = true;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة الكادر والطلاب');

    const cleanSchoolName = targetSchool.name.replace(/[/\\?%*:|"<>]/g, '_');
    XLSX.writeFile(
      workbook,
      `جدول_كادر_وططلاب_${cleanSchoolName}_${new Date().toISOString().split('T')[0]}.xlsx`
    );

    showToast(
      `تم تصدير ملف اكسل لـ (${schoolUsers.length}) اسم في مدرسة ${targetSchool.name} بنجاح من اليمين إلى اليسار.`
    );
  };

  // Excel Staff Import Handler
  const handleImportStaffExcel = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetSchool: SupervisedSchool
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!jsonRows || jsonRows.length === 0) {
        showToast('ملف الاكسل فارغ أو لا يحتوي على بيانات صالحة.');
        e.target.value = '';
        return;
      }

      const newImportedUsers: RosterUser[] = [];
      let importedCount = 0;

      for (let i = 0; i < jsonRows.length; i++) {
        const row = jsonRows[i];

        // Extract Name
        const name = String(
          row['الاسم'] ||
          row['اسم المعلم'] ||
          row['المعلم'] ||
          row['اسم الموظف'] ||
          row['الكادر'] ||
          row['Name'] ||
          row['Full Name'] ||
          Object.values(row)[0] ||
          ''
        ).trim();

        if (!name) continue;

        // Extract or Auto-generate Serial Number
        let serialNumber = String(
          row['الرقم التسلسلي'] ||
          row['رقم التسلسل'] ||
          row['التسلسلي'] ||
          row['Serial'] ||
          row['Serial Number'] ||
          ''
        ).trim();

        if (!serialNumber) {
          const random9 = Math.floor(100000000 + Math.random() * 900000000);
          serialNumber = String(random9);
        } else {
          serialNumber = normalizeDigits(serialNumber);
        }

        // Extract or Auto-generate Code
        let code = String(
          row['رقم الكود'] ||
          row['الكود'] ||
          row['رمز الدخول'] ||
          row['كلمة المرور'] ||
          row['Code'] ||
          ''
        ).trim();

        if (!code) {
          const random7 = Math.floor(1000000 + Math.random() * 9000000);
          code = String(random7);
        } else {
          code = normalizeDigits(code);
        }

        // Extract Role/Permissions
        const roleRaw = String(row['الصلاحيات'] || row['الصفة'] || row['الرتبة'] || row['Role'] || '').trim();
        let role: 'teacher' | 'admin' | 'student' = 'teacher';
        if (roleRaw.includes('مدير') || roleRaw.includes('مشرف') || roleRaw.toLowerCase() === 'admin') {
          role = 'admin';
        } else if (roleRaw.includes('طالب') || roleRaw.toLowerCase() === 'student') {
          role = 'student';
        }

        const grade = String(row['الصف'] || row['Grade'] || '1').trim();
        const section = String(row['الشعبة'] || row['Section'] || 'أ').trim();
        const email = String(row['البريد'] || row['Email'] || '').trim();

        const newUserId = generateDeterministicUserId(targetSchool.name, serialNumber);

        const newUser: RosterUser = {
          id: newUserId,
          name,
          role,
          schoolName: targetSchool.name,
          branch: targetSchool.branch,
          grade,
          section,
          serialNumber,
          code,
          email,
          createdAt: new Date().toISOString(),
          subscription_end_date: targetSchool.subscription_end_date,
        };

        newImportedUsers.push(newUser);
        importedCount++;
      }

      if (newImportedUsers.length === 0) {
        showToast('لم يتم العثور على أسماء كادر صالحة للاستيراد من الملف.');
        e.target.value = '';
        return;
      }

      const existingIds = new Set(localRoster.map((u) => u.id));
      const mergedRoster = [...localRoster];

      for (const u of newImportedUsers) {
        if (existingIds.has(u.id)) {
          const idx = mergedRoster.findIndex((x) => x.id === u.id);
          if (idx !== -1) mergedRoster[idx] = u;
        } else {
          mergedRoster.unshift(u);
          existingIds.add(u.id);
        }
        try {
          await saveSingleRosterUserToFirebase(u);
        } catch (err) {
          console.error('Error saving imported user to Firebase:', err);
        }
      }

      setLocalRoster(mergedRoster);
      if (onUpdateRoster) {
        onUpdateRoster(mergedRoster);
      }

      const updatedSchools = schools.map((s) => {
        if (s.id === targetSchool.id || s.name === targetSchool.name) {
          const updatedS = { ...s, teacherCount: (s.teacherCount || 0) + importedCount };
          saveSchoolToFirebase(updatedS);
          return updatedS;
        }
        return s;
      });
      setSchools(updatedSchools);
      localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));

      showToast(
        `تم استيراد ${importedCount} معلم/كادر بنجاح! وتوليد الأرقام التسلسلية والأكواد المفقودة وتفعيل أسمائهم ومزامنتها سحابياً مع Firebase.`
      );
    } catch (err) {
      console.error('Error importing Excel staff file:', err);
      showToast('حدث خطأ أثناء قراءة ملف الاكسل. يرجى التأكد من أن صيغة الملف صالحة (.xlsx, .xls, .csv).');
    } finally {
      e.target.value = '';
    }
  };

  // Excel Report Export Handler (Requirement 8)
  const handleExportLicensingReportExcel = () => {
    const exportData = schools.map((sch) => {
      const schoolId = sch.id || getSchoolSlug(sch.name);
      const endDate = sch.subscription_end_date || 'غير محدد';
      const remainingDays = sch.subscription_end_date
        ? Math.ceil((new Date(sch.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
        : 0;

      let statusLabel = 'نشط ومصرح';
      if (sch.is_archived || sch.status === 'archived') statusLabel = 'مؤرشف';
      else if (sch.is_suspended || sch.status === 'suspended') statusLabel = 'موقوف إدارياً';
      else if (sch.status === 'read_only') statusLabel = 'قراءة فقط (منتهي)';
      else if (sch.subscription_end_date && sch.subscription_end_date < todayStr) statusLabel = 'منتهي الصلاحية';
      else if (sch.is_unauthorized) statusLabel = 'غير مصرح';

      return {
        'اسم المدرسة': sch.name,
        'الفرع': sch.branch || 'عام',
        'معرف المدرسة (School ID)': schoolId,
        'حالة الترخيص': statusLabel,
        'عدد المعلمين الحالي': getTeachersCountForSchool(sch),
        'الحد الأقصى للمعلمين': sch.maxTeachers || 50,
        'عدد الطلاب الحقيقي': sch.studentCount || 0,
        'الحد الأقصى للطلاب': sch.maxStudents || 1000,
        'تاريخ انتهاء الاشتراك': endDate,
        'الأيام المتبقية': remainingDays > 0 ? remainingDays : 0,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير التراخيص');
    XLSX.writeFile(workbook, `تقرير_تراخيص_المدارس_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('تم تصدير تقرير التراخيص المالي والتنظيمي إلى ملف Excel بنجاح.');
  };

  // Impersonation Handler (Requirement 9)
  const handleImpersonateSchool = async (sch: SupervisedSchool) => {
    const schoolSlug = sch.id || getSchoolSlug(sch.name);
    await logLicenseAction({
      schoolId: schoolSlug,
      schoolName: sch.name,
      actionType: 'impersonation',
      details: `قام المشرف العام بالدخول الاستثنائي لمعاينة النظام كمدير لمدرسة (${sch.name}).`,
      adminInfo: 'المشرف العام',
    });
    if (onImpersonate) {
      onImpersonate({ id: schoolSlug, name: sch.name, branch: sch.branch });
    }
  };

  // Soft Delete / Archive Handler (Requirement 6)
  const handleArchiveSchool = async (sch: SupervisedSchool) => {
    if (
      !confirm(
        `هل أنت متأكد من أرشفة مدرسة (${sch.name})؟ ستختفي من القائمة النشطة مع الحفاظ الكلي والآمن على بيانات طلابها وتاريخها المالي.`
      )
    )
      return;

    await archiveSchoolInFirebase(sch.id, sch.name);
    const updated = schools.map((s) =>
      s.id === sch.id ? { ...s, is_archived: true, status: 'archived' as const, isActive: false } : s
    );
    setSchools(updated);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updated));
    showToast(`تمت أرشفة مدرسة (${sch.name}) بنجاح.`);
  };

  const handleUnarchiveSchool = async (sch: SupervisedSchool) => {
    const updatedS: SupervisedSchool = { ...sch, is_archived: false, status: 'active', isActive: true };
    await saveSchoolToFirebase(updatedS);
    await logLicenseAction({
      schoolId: sch.id,
      schoolName: sch.name,
      actionType: 'status_change',
      details: `إلغاء أرشفة مدرسة (${sch.name}) وإعادتها للوضع النشط.`,
      adminInfo: 'المشرف العام',
    });
    const updated = schools.map((s) => (s.id === sch.id ? updatedS : s));
    setSchools(updated);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updated));
    showToast(`تم إلغاء أرشفة مدرسة (${sch.name}) وإعادتها للخدمة بنجاح.`);
  };

  // 2. Toggle School Suspension
  const handleToggleSchoolSuspension = async (schId: string) => {
    const updatedSchools = schools.map((s) => {
      if (s.id === schId) {
        const nextState = !s.is_suspended;
        const updatedS: SupervisedSchool = {
          ...s,
          is_suspended: nextState,
          status: nextState ? 'suspended' : 'active',
        };
        saveSchoolToFirebase(updatedS);
        logLicenseAction({
          schoolId: schId,
          schoolName: s.name,
          actionType: 'status_change',
          details: nextState
            ? `تعليق وإيقاف حساب مدرسة (${s.name}) إدارياً.`
            : `رفع التعليق عن مدرسة (${s.name}) واستعادة نشاطها.`,
          adminInfo: 'المشرف العام',
        });
        showToast(
          nextState
            ? `تم إيقاف حساب مدرسة (${s.name}) وتعليق الدخول إليها إدارياً.`
            : `تم فك التعليق عن مدرسة (${s.name}) واستعادة الدخول بنجاح.`
        );
        return updatedS;
      }
      return s;
    });
    setSchools(updatedSchools);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));
  };

  // 3. Toggle School Authorization
  const handleToggleSchoolAuthorization = async (schId: string) => {
    const updatedSchools = schools.map((s) => {
      if (s.id === schId) {
        const nextUnauthorized = !s.is_unauthorized;
        const updatedS: SupervisedSchool = {
          ...s,
          is_unauthorized: nextUnauthorized,
          isActive: !nextUnauthorized,
          status: nextUnauthorized ? 'warning' : 'active',
        };
        saveSchoolToFirebase(updatedS);
        logLicenseAction({
          schoolId: schId,
          schoolName: s.name,
          actionType: 'status_change',
          details: nextUnauthorized
            ? `تحويل مدرسة (${s.name}) إلى غير مصرح.`
            : `منح التصريح اليدوي لمدرسة (${s.name}).`,
          adminInfo: 'المشرف العام',
        });
        showToast(
          nextUnauthorized
            ? `تم تحويل مدرسة (${s.name}) إلى حالة (غير مصرح).`
            : `تم منح الإذن اليدوي وتصريح الدخول لمدرسة (${s.name}) بنجاح.`
        );
        return updatedS;
      }
      return s;
    });
    setSchools(updatedSchools);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));
  };

  // 4. Extend School Subscription
  const handleExtendSchoolSubscription = async (schId: string, newDateStr: string) => {
    const updatedSchools = schools.map((s) => {
      if (s.id === schId) {
        const updatedS: SupervisedSchool = {
          ...s,
          subscription_end_date: newDateStr,
          is_unauthorized: false,
          isActive: true,
          status: 'active',
        };
        saveSchoolToFirebase(updatedS);
        logLicenseAction({
          schoolId: schId,
          schoolName: s.name,
          actionType: 'renewal',
          details: `تم تمديد اشتراك وترخيص مدرسة (${s.name}) حتى تاريخ: ${newDateStr}.`,
          adminInfo: 'المشرف العام',
        });
        showToast(`تم تمديد اشتراك وترخيص مدرسة (${s.name}) بنجاح حتى تاريخ: ${newDateStr}`);
        return updatedS;
      }
      return s;
    });
    setSchools(updatedSchools);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));
    setSelectedSchoolForRenewal(null);
  };

  // Set School Status directly (e.g. read_only)
  const handleSetSchoolStatus = async (schId: string, newStatus: 'active' | 'warning' | 'expired' | 'suspended' | 'read_only' | 'archived') => {
    const updatedSchools = schools.map((s) => {
      if (s.id === schId) {
        const updatedS: SupervisedSchool = {
          ...s,
          status: newStatus,
          is_suspended: newStatus === 'suspended',
          is_archived: newStatus === 'archived',
        };
        saveSchoolToFirebase(updatedS);
        logLicenseAction({
          schoolId: schId,
          schoolName: s.name,
          actionType: 'status_change',
          details: `تحديث حالة ترخيص مدرسة (${s.name}) إلى: ${newStatus}`,
          adminInfo: 'المشرف العام',
        });
        showToast(`تم تحديث حالة ترخيص مدرسة (${s.name}) إلى (${newStatus}).`);
        return updatedS;
      }
      return s;
    });
    setSchools(updatedSchools);
    localStorage.setItem('interactive_quiz_schools', JSON.stringify(updatedSchools));
  };

  // 5. Force Reset Session for User ("تصفير الجلسة")
  const handleForceResetUserSession = async (userId: string) => {
    const target = baseRosterPool.find((u) => u.id === userId) || localRoster.find((u) => u.id === userId);
    if (!target) return;

    const resetUser: RosterUser = {
      ...target,
      active_session_id: '',
      last_activity_at: 0,
    };

    // Save to Firestore directly
    await saveSingleRosterUserToFirebase(resetUser);

    // Update localRoster
    const nextLocalRoster = localRoster.map((u) => (u.id === userId ? resetUser : u));
    if (!nextLocalRoster.some((u) => u.id === userId)) {
      nextLocalRoster.push(resetUser);
    }
    setLocalRoster(nextLocalRoster);

    // Update isolatedSchoolUsers if present
    setIsolatedSchoolUsers((prev) => prev.map((u) => (u.id === userId ? resetUser : u)));

    if (onUpdateRoster) {
      onUpdateRoster(nextLocalRoster);
    }

    showToast(
      `تم تصفير الجلسة بنجاح للمستخدم (${resetUser.name})! تم فك الارتباط بالجهاز القديم ويمكنه الدخول فوراً الآن.`
    );
  };

  // 5.b Force Reset Sessions for All Displayed Users in Table ("تصفير الجلسات لجميع المستخدمين")
  const [isResettingAllSessions, setIsResettingAllSessions] = useState(false);

  const handleForceResetAllSessions = async () => {
    if (filteredRoster.length === 0) {
      showToast('لا يوجد مستخدمون حالياً في الجدول لتصفير جلساتهم.');
      return;
    }

    const confirmReset = window.confirm(
      `هل أنت متأكد من تصفير الجلسات لجميع المستخدمين الظاهرين حالياً في الجدول وعددهم (${filteredRoster.length}) مستخدم؟\nسيعمل هذا على فك الارتباط بأي أجهزة قديمة وتفريغ active_session_id لهم جميعاً.`
    );
    if (!confirmReset) return;

    setIsResettingAllSessions(true);

    try {
      const resetMap = new Map<string, RosterUser>();
      const promises = filteredRoster.map(async (u) => {
        const resetUser: RosterUser = {
          ...u,
          active_session_id: '',
          last_activity_at: 0,
        };
        resetMap.set(u.id, resetUser);
        await saveSingleRosterUserToFirebase(resetUser);
      });

      await Promise.all(promises);

      // Update localRoster
      const nextLocalRoster = localRoster.map((u) => {
        if (resetMap.has(u.id)) {
          return resetMap.get(u.id)!;
        }
        return u;
      });

      resetMap.forEach((user, id) => {
        if (!nextLocalRoster.some((u) => u.id === id)) {
          nextLocalRoster.push(user);
        }
      });

      setLocalRoster(nextLocalRoster);

      // Update isolatedSchoolUsers
      setIsolatedSchoolUsers((prev) =>
        prev.map((u) => (resetMap.has(u.id) ? resetMap.get(u.id)! : u))
      );

      if (onUpdateRoster) {
        onUpdateRoster(nextLocalRoster);
      }

      showToast(
        `تم تصفير الجلسات بنجاح لجميع المستخدمين الظاهرين في الجدول (${filteredRoster.length} مستخدم)!`
      );
    } catch (err) {
      console.error('Error resetting all sessions:', err);
      showToast('حدث خطأ أثناء تصفير الجلسات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsResettingAllSessions(false);
    }
  };

  // 6. Force Reset Teacher Profile Session
  const handleForceResetTeacherProfileSession = async () => {
    if (!teacherProfile) return;
    const updatedProf: TeacherProfile = {
      ...teacherProfile,
      active_session_id: '',
      last_activity_at: 0,
    };
    if (onUpdateTeacherProfile) {
      onUpdateTeacherProfile(updatedProf);
    }

    if (teacherProfile.serialNumber) {
      const discovered = await findUserAndSchoolBySerial(teacherProfile.serialNumber);
      if (discovered?.user) {
        const resetTeacherUser: RosterUser = {
          ...discovered.user,
          active_session_id: '',
          last_activity_at: 0,
        };
        await saveSingleRosterUserToFirebase(resetTeacherUser);
      }
    }

    showToast(
      `تم تصفير الجلسة بنجاح لحساب المعلم الحالي (${teacherProfile.teacherName})! تم تفريغ active_session_id.`
    );
  };

  // 7. Toggle User Suspension
  const handleToggleUserSuspension = (userId: string) => {
    let targetUser: RosterUser | null = null;
    const updatedList = localRoster.map((u) => {
      if (u.id === userId) {
        const nextState = !u.is_suspended;
        targetUser = { ...u, is_suspended: nextState };
        showToast(
          nextState
            ? `تم إيقاف حساب (${u.name}) وتعليقه إدارياً.`
            : `تم فك التعليق عن حساب (${u.name}) بنجاح.`
        );
        return targetUser;
      }
      return u;
    });

    if (targetUser) {
      saveSingleRosterUserToFirebase(targetUser);
    }

    setLocalRoster(updatedList);
    if (onUpdateRoster) {
      onUpdateRoster(updatedList);
    }
  };

  // 8. Toggle User Authorization
  const handleToggleUserAuthorization = (userId: string) => {
    let targetUser: RosterUser | null = null;
    const updatedList = localRoster.map((u) => {
      if (u.id === userId) {
        const nextState = !u.is_unauthorized;
        targetUser = { ...u, is_unauthorized: nextState };
        showToast(
          nextState
            ? `تم تحويل حساب (${u.name}) إلى حالة (غير مصرح).`
            : `تم منح الإذن اليدوي والتصريح لحساب (${u.name}) بنجاح.`
        );
        return targetUser;
      }
      return u;
    });

    if (targetUser) {
      saveSingleRosterUserToFirebase(targetUser);
    }

    setLocalRoster(updatedList);
    if (onUpdateRoster) {
      onUpdateRoster(updatedList);
    }
  };

  // 9. Extend User Subscription
  const handleExtendUserSubscription = (userId: string, newDateStr: string) => {
    let targetUser: RosterUser | null = null;
    const updatedList = localRoster.map((u) => {
      if (u.id === userId) {
        showToast(`تم تحديث وتمديد تاريخ الانتهاء للمستخدم (${u.name}) حتى: ${newDateStr}`);
        targetUser = {
          ...u,
          subscription_end_date: newDateStr,
          is_unauthorized: false,
        };
        return targetUser;
      }
      return u;
    });

    if (targetUser) {
      saveSingleRosterUserToFirebase(targetUser);
    }

    setLocalRoster(updatedList);
    if (onUpdateRoster) {
      onUpdateRoster(updatedList);
    }
    setSelectedUserForRenewal(null);
  };

  const handleDeleteSchool = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المدرسة هيكلياً (Cascade Delete) مع إتاحة الحذف المرن (Soft Delete)؟')) {
      const updated = schools.filter((s) => s.id !== id);
      setSchools(updated);
      localStorage.setItem('interactive_quiz_schools', JSON.stringify(updated));
      await deleteSchoolFromFirebase(id);
      showToast('تم حذف سجل المدرسة بنجاح من Firebase.');
    }
  };

  const handlePermissionsAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const SECRET_PIN_REF = '2#3#2*4*a';
    if (secondaryPassword.trim() === SECRET_PIN_REF) {
      setHasPermissionsAccess(true);
      setIsPermissionsAuthOpen(false);
      setSecondaryPassword('');
      setAuthError(null);
      showToast('تم التحقق المزدوج بنجاح وفتح بوابة الصلاحيات والسكرتارية.');
    } else {
      setAuthError('الرقم السري الإضافي غير صحيح! يرجى التحقق من مفتاح الأمان المعتمد.');
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffCode.trim()) return;

    const newStaff: SecretariatStaff = {
      id: `st-${Date.now()}`,
      name: newStaffName.trim(),
      staffCode: newStaffCode.trim(),
      rolePermissions: ['إدارة الطلاب', 'عرض تقارير المدرسة'],
      schoolName: selectedStaffSchool,
      branchName: 'فرع عام',
      isSoftDeleted: false,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setStaffList([...staffList, newStaff]);
    setNewStaffName('');
    setNewStaffCode('');
    showToast(`تم إضافة موظف السكرتارية (${newStaff.name}) وتعيين الصلاحيات بنجاح.`);
  };

  const handleToggleSoftDeleteStaff = (id: string) => {
    setStaffList(
      staffList.map((st) => (st.id === id ? { ...st, isSoftDeleted: !st.isSoftDeleted } : st))
    );
  };

  // Filtered Users List for Tab 2 (isolated multi-tenant pool or local pool)
  const baseRosterPool =
    selectedMasterSchoolSlug !== 'all'
      ? isolatedSchoolUsers
      : localRoster;

  const filteredRoster = baseRosterPool.filter((u) => {
    // Role filter
    if (userRoleFilter === 'teachers' && u.role !== 'teacher') return false;
    if (userRoleFilter === 'students' && u.role === 'teacher') return false;

    const matchesQuery =
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.serialNumber.includes(userSearchQuery) ||
      u.schoolName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.code && u.code.includes(userSearchQuery)) ||
      (u.grade && u.grade.includes(userSearchQuery));

    if (!matchesQuery) return false;

    const hasActiveSession =
      u.active_session_id && u.last_activity_at && Date.now() - u.last_activity_at < 2 * 60 * 60 * 1000;

    if (userFilterStatus === 'session_locked') return !!hasActiveSession;
    if (userFilterStatus === 'suspended') return !!u.is_suspended;
    if (userFilterStatus === 'unauthorized') return !!u.is_unauthorized;
    if (userFilterStatus === 'expired') return !!(u.subscription_end_date && u.subscription_end_date < todayStr);

    return true;
  });

  // Source Code for Laravel Controller & Blade Views (Commercial License System)
  const LARAVEL_CONTROLLER_CODE = `<?php

namespace App\\Http\\Controllers\\Admin;

use App\\Http\\Controllers\\Controller;
use App\\Models\\School;
use App\\Models\\User;
use Illuminate\\Http\\Request;
use Carbon\\Carbon;

class LicenseAdminController extends Controller
{
    /**
     * Display License & Permissions Control Dashboard
     */
    public function index()
    {
        $schools = School::withCount(['teachers', 'quizzes'])->get();
        $usersWithSessions = User::whereNotNull('active_session_id')->get();
        
        return view('admin.licenses.index', compact('schools', 'usersWithSessions'));
    }

    /**
     * Extend Subscription End Date (تجديد الترخيص)
     */
    public function extendSubscription(Request $request, $id)
    {
        $request->validate([
            'subscription_end_date' => 'required|date|after:today',
        ]);

        $school = School::findOrFail($id);
        $school->update([
            'subscription_end_date' => $request->subscription_end_date,
            'is_unauthorized' => false,
            'is_active' => true,
        ]);

        return back()->with('success', 'تم تمديد اشتراك وتحديث تاريخ الانتهاء بنجاح.');
    }

    /**
     * Force Logout & Reset Active Session (تصفير الجلسة المركزية)
     */
    public function forceResetSession($userId)
    {
        $user = User::findOrFail($userId);
        $user->update([
            'active_session_id' => null,
            'last_activity_at' => null,
        ]);

        return back()->with('success', 'تم تصفير الجلسة بنجاح! يمكن للمستخدم الدخول فوراً من أي جهاز آخر.');
    }

    /**
     * Administrative Account Suspension (إيقاف الحساب / تعليق)
     */
    public function toggleSuspension($userId)
    {
        $user = User::findOrFail($userId);
        $user->is_suspended = !$user->is_suspended;
        $user->save();

        $msg = $user->is_suspended ? 'تم إيقاف الحساب وتعليقه إدارياً.' : 'تم رفع التعليق واستعادة الحساب بنجاح.';
        return back()->with('success', $msg);
    }

    /**
     * Manual Authorization & Access Grant (الإذن اليدوي)
     */
    public function manualAuthorize(Request $request, $userId)
    {
        $user = User::findOrFail($userId);
        $user->update([
            'is_unauthorized' => false,
            'subscription_end_date' => $request->get('end_date', Carbon::now()->addYear()->toDateString()),
        ]);

        return back()->with('success', 'تم منح الإذن اليدوي وتصريح الدخول للحساب.');
    }
}`;

  const LARAVEL_BLADE_VIEW_CODE = `{{-- resources/views/admin/licenses/index.blade.php --}}
@extends('layouts.admin')

@section('content')
<div class="container-fluid dir-rtl text-right py-4">
    <div class="card shadow-lg border-0 rounded-3 mb-4 bg-dark text-white">
        <div class="card-body p-4 flex justify-between items-center">
            <div>
                <h2 class="fw-black text-warning">لوحة إدارة التراخيص المركزية - المشرف العام</h2>
                <p class="text-muted mb-0">مراقبة تواريخ الانتهاء، تصفير الجلسات المعلقة، وتخصيص الصلاحيات</p>
            </div>
            <span class="badge bg-emerald-500 text-dark p-2">اتصال خادم التراخيص : نشط</span>
        </div>
    </div>

    {{-- Schools License Table --}}
    <div class="card border-0 shadow-sm rounded-3 mb-4">
        <div class="card-header bg-white py-3 fw-bold flex justify-between">
            <span>جدول المدارس والتراخيص التجارية</span>
            <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addSchoolModal">إضافة مدرسة</button>
        </div>
        <div class="card-body p-0">
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>المدرسة / الفرع</th>
                        <th>تاريخ الانتهاء</th>
                        <th>حالة التفعيل</th>
                        <th>إجراءات التحكم (Force Reset / Extend)</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($schools as $sch)
                    <tr>
                        <td>
                            <strong>{{ $sch->name }}</strong>
                            <div class="text-muted small">{{ $sch->branch }}</div>
                        </td>
                        <td><span class="badge bg-light text-dark font-mono">{{ $sch->subscription_end_date }}</span></td>
                        <td>
                            @if($sch->is_suspended)
                                <span class="badge bg-danger">معلق إدارياً</span>
                            @elseif($sch->is_unauthorized)
                                <span class="badge bg-purple text-white">غير مصرح (بانتظار الموافقة)</span>
                            @elseif($sch->subscription_end_date < now())
                                <span class="badge bg-warning text-dark">منتهي</span>
                            @else
                                <span class="badge bg-success">نشط ومصرح</span>
                            @endif
                        </td>
                        <td>
                            {{-- Force Reset Session Button --}}
                            <form action="{{ route('admin.schools.reset-sessions', $sch->id) }}" method="POST" class="d-inline">
                                @csrf
                                <button type="submit" class="btn btn-sm btn-outline-warning">تصفير كافة الجلسات</button>
                            </form>

                            {{-- Extend Subscription Button --}}
                            <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#renewModal{{ $sch->id }}">تمديد الترخيص</button>

                            {{-- Toggle Suspend --}}
                            <form action="{{ route('admin.schools.toggle-suspend', $sch->id) }}" method="POST" class="d-inline">
                                @csrf
                                <button type="submit" class="btn btn-sm {{ $sch->is_suspended ? 'btn-success' : 'btn-outline-danger' }}">
                                    {{ $sch->is_suspended ? 'فك التعليق' : 'إيقاف الحساب' }}
                                </button>
                            </form>
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
</div>
@endsection`;

  return (
    <div className="space-y-8 dir-rtl animate-fadeIn pb-12">
      {/* Toast Alert System */}
      {toastMessage && (
        <div className="fixed top-5 left-5 z-50 max-w-md bg-gradient-to-r from-emerald-700 to-indigo-900 text-white p-4 rounded-2xl shadow-2xl border-2 border-amber-300 font-extrabold text-xs flex items-center justify-between gap-3 animate-bounce dir-rtl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/20 rounded-lg text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Official Admin Welcoming Hero Header */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-2xl border border-purple-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-purple-500/20 text-purple-300 rounded-full text-xs font-black border border-purple-400/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>المرحلة 18 الختامية - إدارة التراخيص المركزية وحل المشكلات (SchoolScope Admin)</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white">
              لوحة التحكم المركزية: <span className="text-amber-300">إبراهيم دخان المشرف العام</span>
            </h2>

            <p className="text-xs sm:text-sm text-purple-200 font-medium">
              مراقبة التراخيص وتواريخ الانتهاء، تصفير الجلسات المزدوجة (Force Logout)، والتعليق الإداري
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Key Permissions Security Gate Toggle Button */}
            <button
              type="button"
              onClick={() => {
                if (hasPermissionsAccess) {
                  setHasPermissionsAccess(false);
                } else {
                  setIsPermissionsAuthOpen(true);
                }
              }}
              className={`px-4 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-xl border transition-all cursor-pointer ${
                hasPermissionsAccess
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/20'
                  : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400/50 shadow-purple-600/30'
              }`}
            >
              <Key className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>{hasPermissionsAccess ? 'إغلاق بوابة الصلاحيات' : 'التحكم بالصلاحيات والإضافة'}</span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-3 bg-red-900/80 hover:bg-red-800 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 border border-red-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-300" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECONDARY PASSCODE MODAL FOR "التحكم بالصلاحيات" */}
      {isPermissionsAuthOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-purple-200 space-y-6 relative dir-rtl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">بوابة الأمان المزدوجة للمشرف العام</h3>
                <p className="text-xs text-slate-500">أدخل الرقم السري الإضافي المعتمد لفتح لوحة الصلاحيات السريعة</p>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-xs font-extrabold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handlePermissionsAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-purple-600" />
                  الرقم السري الإضافي للتحكم بالصلاحيات (2#3#2*4*a) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="أدخل الرقم السري المعتمد..."
                  value={secondaryPassword}
                  onChange={(e) => setSecondaryPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm font-mono font-bold bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPermissionsAuthOpen(false);
                    setAuthError(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl text-xs shadow-lg shadow-purple-600/30 cursor-pointer flex items-center gap-2"
                >
                  <Key className="w-4 h-4 text-amber-300" />
                  تأكيد الفتح والتحقق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-200/80">
        <button
          type="button"
          onClick={() => setAdminTab('schools')}
          className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            adminTab === 'schools'
              ? 'bg-purple-950 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <School className="w-4 h-4 text-amber-300" />
          <span>لوحة تراخيص المدارس وتخصيص الصلاحيات ({totalSchoolsCount ?? schools.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            adminTab === 'users'
              ? 'bg-purple-950 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-emerald-400" />
          <span>إدارة الجلسات وحل القفل المزدوج (تصفير الجلسات) ({totalUsersCount ?? localRoster.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('staff')}
          className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            adminTab === 'staff'
              ? 'bg-purple-950 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-400" />
          <span>طاقم السكرتارية والصلاحيات ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('code_views')}
          className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            adminTab === 'code_views'
              ? 'bg-purple-950 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Code2 className="w-4 h-4 text-teal-300" />
          <span>أكواد Controller & Blade Views للمشرف</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('migration')}
          className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            adminTab === 'migration'
              ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-300'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 text-amber-600" />
          <span>أداة ترحيل البيانات السحابية (True Multi-Tenancy)</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('logs')}
          className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            adminTab === 'logs'
              ? 'bg-purple-950 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>سجل الحركات والتدقيق (Audit Trail)</span>
        </button>
      </div>

      {/* TAB 5: DATA MIGRATION SCRIPT TOOL (المرحلة 4) */}
      {adminTab === 'migration' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">أداة ترحيل البيانات السحابية (Data Migration Tool)</h3>
                <p className="text-xs text-slate-500">نقل الحسابات من الجدول المسطح roster_users إلى الهيكلة المعزولة /schools/school_id/users/user_id</p>
              </div>
            </div>

            <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200/80 space-y-3 text-xs text-amber-900 font-bold">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-black">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>شرح آلية الترحيل والأمان السحابي:</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-slate-700 font-medium leading-relaxed">
                <li>يتم جلب كافة المستخدمين المسجلين في المجموعة القديمة <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-amber-950">roster_users</code>.</li>
                <li>يتم استخراج اسم المدرسة وتمريره على دالة <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-amber-950">getSchoolSlug()</code> لتوليد <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-amber-950">school_id</code> المعياري السحابي.</li>
                <li>تُنقل جميع البيانات إلى المسار المعزول: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-amber-950">/schools/school_id/users/user_id</code>.</li>
                <li><strong className="text-emerald-800 font-bold">إجراء احترازي للأمان:</strong> لا يتم حذف البيانات القديمة من <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-amber-950">roster_users</code> تلقائياً، بل تبقى كنسخة احتياطية (Backup).</li>
              </ul>
            </div>

            {/* Migration Control Actions */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-slate-800">تشغيل أداة الترحيل السحابية</h4>
                  <p className="text-xs text-slate-500 mt-0.5">انقر لبدء نقل الحسابات وضمان عزلة البيانات التامة بين المدارس</p>
                </div>

                <button
                  type="button"
                  onClick={handleStartMigration}
                  disabled={isMigrating}
                  className={`px-6 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                    isMigrating
                      ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 hover:brightness-110 shadow-amber-500/20'
                  }`}
                >
                  {isMigrating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                      <span>جاري الترحيل الآن...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>بدء عملية ترحيل البيانات السحابية الآن</span>
                    </>
                  )}
                </button>
              </div>

              {/* Real-time Progress State */}
              {migrationProgress && (
                <div className="space-y-3 pt-4 border-t border-slate-200 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>حالة التقدم:</span>
                    <span className="font-mono text-indigo-700">
                      {migrationProgress.total > 0
                        ? `${Math.round((migrationProgress.current / migrationProgress.total) * 100)}% (${migrationProgress.current} من ${migrationProgress.total})`
                        : 'جاري البدء...'}
                    </span>
                  </div>

                  {migrationProgress.total > 0 && (
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, (migrationProgress.current / migrationProgress.total) * 100)}%` }}
                      />
                    </div>
                  )}

                  <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl flex items-center gap-2 dir-ltr">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{migrationProgress.message}</span>
                  </div>
                </div>
              )}

              {/* Completion Result Badge */}
              {migrationResult && (
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 animate-fadeIn ${
                  migrationResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {migrationResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                  <div>
                    <div className="font-black text-sm">
                      {migrationResult.success ? 'تم اكتمال الترحيل بنجاح!' : 'حدث خطأ أثناء الترحيل'}
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      {migrationResult.success
                        ? `تم نقل وتأمين ${migrationResult.totalMigrated} حساب في المجموعات الفرعية السحابية المعزولة /schools/{school_id}/users.`
                        : migrationResult.error}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL LOGS */}
      {adminTab === 'logs' && (
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">سجل الحركات والتدقيق (Audit Trail - License Logs)</h3>
                <p className="text-xs text-slate-500">
                  تتبع موثق ومحمي لكافة قرارات المشرف العام (التجديد، التعليق، الدخول الاستثنائي، تغيير الصلاحيات).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsLoadingLogs(true);
                const logs = await fetchLicenseLogs();
                setLicenseLogs(logs);
                setIsLoadingLogs(false);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span>تحديث السجل</span>
            </button>
          </div>

          {isLoadingLogs ? (
            <div className="p-8 text-center text-slate-500 text-xs font-bold animate-pulse">
              جاري جلب سجل الحركات من سحابة Firebase...
            </div>
          ) : licenseLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-bold">
              لا توجد حركات مسجلة حالياً في السجل.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right text-slate-700">
                <thead className="bg-slate-50 font-black text-slate-900 border-b border-slate-200">
                  <tr>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">اسم المدرسة</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">التفاصيل</th>
                    <th className="p-3">المنفذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {licenseLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-500">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-SA') : 'الآن'}
                      </td>
                      <td className="p-3 font-bold text-indigo-900">{log.schoolName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="p-3 text-slate-800">{log.details}</td>
                      <td className="p-3 font-bold text-slate-600">{log.adminInfo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: SCHOOLS LICENSE MANAGEMENT */}
      {adminTab === 'schools' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500">إجمالي المدارس المغطاة</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{totalSchoolsCount ?? schools.length} مدارس</div>
              </div>
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                <School className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500">التراخيص النشطة والمصرحة</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {schools.filter((s) => !s.is_suspended && !s.is_unauthorized && s.subscription_end_date && s.subscription_end_date >= todayStr).length}
                </div>
              </div>
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500">التراخيص المنتهية</span>
                <div className="text-2xl font-black text-amber-600 mt-1">
                  {schools.filter((s) => s.subscription_end_date && s.subscription_end_date < todayStr).length}
                </div>
              </div>
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500">الحسابات المعلقة / غير المصرحة</span>
                <div className="text-2xl font-black text-purple-700 mt-1">
                  {schools.filter((s) => s.is_suspended || s.is_unauthorized).length}
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Add School Header & Commercial Tools Bar */}
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-800 rounded-xl flex items-center justify-center font-bold">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">إدارة تراخيص المدارس وتخصيص الصلاحيات</h3>
                  <p className="text-xs text-slate-500">
                    يمكنك تمديد الاشتراكات، تصدير التراخيص لـ Excel، المعاينة كمدير مدرسة، أو التحكم بالأرشفة.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* REQUIREMENT 7: Notification Bell for Expiring Licenses (< 30 days) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer relative shadow-xs"
                    title="تنبيهات تراخيص قريبة الانتهاء"
                  >
                    <Bell className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>تنبيهات الانتهاء</span>
                    {schools.filter((sch) => {
                      if (sch.is_archived || sch.status === 'archived') return false;
                      if (!sch.subscription_end_date) return false;
                      const diffDays = Math.ceil(
                        (new Date(sch.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                      );
                      return diffDays <= 30;
                    }).length > 0 && (
                      <span className="w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-bounce">
                        {
                          schools.filter((sch) => {
                            if (sch.is_archived || sch.status === 'archived') return false;
                            if (!sch.subscription_end_date) return false;
                            const diffDays = Math.ceil(
                              (new Date(sch.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                            );
                            return diffDays <= 30;
                          }).length
                        }
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Popup */}
                  {isNotificationsOpen && (
                    <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-amber-300 p-4 z-50 space-y-3 dir-rtl">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          تراخيص متبقي عليها أقل من 30 يوماً
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsNotificationsOpen(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                        >
                          إغلاق
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {schools
                          .filter((sch) => {
                            if (sch.is_archived || sch.status === 'archived') return false;
                            if (!sch.subscription_end_date) return false;
                            const diffDays = Math.ceil(
                              (new Date(sch.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                            );
                            return diffDays <= 30;
                          })
                          .map((sch) => {
                            const diffDays = Math.ceil(
                              (new Date(sch.subscription_end_date!).getTime() - new Date().getTime()) /
                                (1000 * 3600 * 24)
                            );
                            return (
                              <div
                                key={sch.id}
                                className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <div className="font-extrabold text-slate-900">{sch.name}</div>
                                  <div className="text-[10px] text-amber-800 font-bold">
                                    متبقي: {diffDays > 0 ? `${diffDays} يوماً` : 'منتهي الصلاحية'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextYear = new Date();
                                    nextYear.setFullYear(nextYear.getFullYear() + 1);
                                    handleExtendSchoolSubscription(
                                      sch.id,
                                      nextYear.toISOString().split('T')[0]
                                    );
                                  }}
                                  className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[10px] shrink-0"
                                >
                                  تجديد عام
                                </button>
                              </div>
                            );
                          })}
                        {schools.filter((sch) => {
                          if (sch.is_archived || sch.status === 'archived') return false;
                          if (!sch.subscription_end_date) return false;
                          const diffDays = Math.ceil(
                            (new Date(sch.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                          );
                          return diffDays <= 30;
                        }).length === 0 && (
                          <p className="text-xs text-slate-500 text-center py-4">جميع التراخيص سارية وبحالة جيدة 👍</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* REQUIREMENT 8: Excel Export Button */}
                <button
                  type="button"
                  onClick={handleExportLicensingReportExcel}
                  className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  title="تصدير تقرير التراخيص لملف Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                  <span>تصدير تقرير Excel</span>
                </button>

                {/* REQUIREMENT 6: Show Archived Schools Toggle */}
                <button
                  type="button"
                  onClick={() => setShowArchivedSchools(!showArchivedSchools)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
                    showArchivedSchools
                      ? 'bg-slate-800 text-amber-300 border-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  <span>{showArchivedSchools ? 'إخفاء المؤرشف' : 'عرض المدارس المؤرشفة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddSchoolOpen(!isAddSchoolOpen)}
                  className="px-4 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  إضافة مدرسة جديدة
                </button>
              </div>
            </div>

            {/* Add School Form Drawer */}
            {isAddSchoolOpen && (
              <form onSubmit={handleAddSchool} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fadeIn">
                <h4 className="text-xs font-extrabold text-slate-800">بيانات المدرسة والترخيص التجاري الجديد:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم المدرسة</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: مدرسة الفاروق النموذجية"
                      value={newSchoolName}
                      onChange={(e) => setNewSchoolName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-xs font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الفرع / القسم (زر إضافة فرع)</label>
                    <input
                      type="text"
                      placeholder="اكتب اسم فرع المدرسة هنا..."
                      value={newSchoolBranch}
                      onChange={(e) => setNewSchoolBranch(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-xs font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ انتهاء الترخيص المبدئي</label>
                    <input
                      type="date"
                      required
                      value={newSchoolEndDate}
                      onChange={(e) => setNewSchoolEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 outline-none text-xs font-bold bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <input
                    type="checkbox"
                    id="chkUnauthorized"
                    checked={newSchoolStartUnauthorized}
                    onChange={(e) => setNewSchoolStartUnauthorized(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                  />
                  <label htmlFor="chkUnauthorized" className="text-xs font-bold text-purple-900 cursor-pointer">
                    إبقاء المدرسة في حالة (غير مصرح) حتى يقوم المشرف بتأكيد السماح بالدخول فوراً.
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddSchoolOpen(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer"
                  >
                    حفظ المدرسة والترخيص
                  </button>
                </div>
              </form>
            )}

            {/* Schools Cards / Table List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schools
                .filter((sch) => (showArchivedSchools ? true : !sch.is_archived && sch.status !== 'archived'))
                .map((sch) => {
                  const statusBadge = getSchoolStatusBadge(sch);
                  const BadgeIcon = statusBadge.icon;

                  return (
                    <div
                      key={sch.id}
                      className={`p-5 rounded-2xl border shadow-xs transition-all space-y-4 relative ${
                        sch.is_archived || sch.status === 'archived'
                          ? 'bg-slate-100 border-slate-300 opacity-75'
                          : sch.is_suspended
                          ? 'bg-rose-50/50 border-rose-200'
                          : sch.status === 'read_only'
                          ? 'bg-amber-50/70 border-amber-300'
                          : sch.is_unauthorized
                          ? 'bg-purple-50/50 border-purple-200'
                          : sch.subscription_end_date && sch.subscription_end_date < todayStr
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="text-base font-black text-slate-900">{sch.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded-md text-[10px]">
                              الفرع: {sch.branch}
                            </span>
                            <span className="text-[11px] text-slate-500 font-bold">
                              تاريخ الانتهاء: <span className="font-mono text-slate-800">{sch.subscription_end_date || 'غير محدد'}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {sch.id || getSchoolSlug(sch.name)}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1 ${statusBadge.className}`}>
                            <BadgeIcon className="w-3.5 h-3.5" />
                            <span>{statusBadge.label}</span>
                          </span>

                          {/* Quick Status Selector Dropdown */}
                          <select
                            value={sch.is_archived ? 'archived' : sch.is_suspended ? 'suspended' : sch.status || 'active'}
                            onChange={(e) => handleSetSchoolStatus(sch.id, e.target.value as any)}
                            className="px-2 py-0.5 text-[11px] font-bold rounded-lg border border-slate-300 bg-white text-slate-800 outline-none cursor-pointer"
                          >
                            <option value="active">نشط ومصرح</option>
                            <option value="warning">تحذير (متبقي قليل)</option>
                            <option value="read_only">قراءة فقط (منتهي / سماح)</option>
                            <option value="suspended">موقوف إدارياً</option>
                            <option value="archived">مؤرشف</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick Stats & Quotas bar for this school */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSchoolForTeachers(sch);
                            setSchoolTeacherSearchQuery('');
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl flex items-center gap-2 transition-all cursor-pointer hover:shadow-xs group font-bold"
                          title="انقر لعرض جدول معلمي وكادر هذه المدرسة"
                        >
                          <Users className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                          <span>المعلمين:</span>
                          <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[11px] font-mono font-black shadow-2xs">
                            {getTeachersCountForSchool(sch)} / {sch.maxTeachers || 50}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        </button>

                        <div className="flex items-center gap-1.5 text-slate-800">
                          <GraduationCap className="w-4 h-4 text-emerald-600" />
                          <span>الطلاب:</span>
                          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full text-[11px] font-mono font-black">
                            {sch.studentCount || 0} / {sch.maxStudents || 1000}
                          </span>
                        </div>

                        <span>الاختبارات: <strong className="text-slate-900">{sch.quizCount}</strong></span>
                      </div>

                      {/* ACTION CONTROLS BUTTONS */}
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        {/* Requirement 9: Impersonate School Manager Button */}
                        <button
                          type="button"
                          onClick={() => handleImpersonateSchool(sch)}
                          className="w-full px-3 py-2 bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 hover:brightness-125 text-amber-300 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all border border-amber-400/30"
                          title="الدخول الاستثنائي لمعاينة النظام كمدير للمدرسة وحل المشكلات"
                        >
                          <Eye className="w-4 h-4 text-amber-300 animate-pulse" />
                          <span>الدخول كمدير للمدرسة (Super Admin Impersonation)</span>
                        </button>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => openAddStaffModal(sch)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer bg-blue-600 hover:bg-blue-500 text-white"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              إضافة كادر
                            </button>

                            {/* Manual Authorize */}
                            <button
                              type="button"
                              onClick={() => handleToggleSchoolAuthorization(sch.id)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer ${
                                sch.is_unauthorized
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300'
                              }`}
                            >
                              {sch.is_unauthorized ? 'تصريح الدخول' : 'حظر (غير مصرح)'}
                            </button>

                            {/* Extension */}
                            <button
                              type="button"
                              onClick={() => setSelectedSchoolForRenewal(sch)}
                              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              تمديد الاشتراك
                            </button>

                            {/* Suspend */}
                            <button
                              type="button"
                              onClick={() => handleToggleSchoolSuspension(sch.id)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                                sch.is_suspended
                                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                  : 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                              }`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                              {sch.is_suspended ? 'رفع التعليق' : 'تعليق إداري'}
                            </button>
                          </div>

                          {/* Requirement 6: Soft Delete / Archive Toggle Button */}
                          {sch.is_archived || sch.status === 'archived' ? (
                            <button
                              type="button"
                              onClick={() => handleUnarchiveSchool(sch)}
                              className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all font-bold text-xs flex items-center gap-1"
                              title="إلغاء الأرشفة وإعادة المدرسة للخدمة"
                            >
                              <ArchiveX className="w-4 h-4 text-emerald-600" />
                              <span>استعادة</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleArchiveSchool(sch)}
                              className="p-2 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all"
                              title="أرشفة المدرسة بدلاً من الحذف لتأمين البيانات"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* RENEWAL / EXTENSION MODAL FOR SCHOOLS */}
      {selectedSchoolForRenewal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-5 dir-rtl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold shrink-0">
                <CalendarPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  تمديد اشتراك وترخيص: <span className="text-indigo-900">{selectedSchoolForRenewal.name}</span>
                </h3>
                <p className="text-xs text-slate-500">اختر مدة التمديد بضغطة واحدة أو حدد تاريخ انتهاء مخصص</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">خيارات التمديد السريعة:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    handleExtendSchoolSubscription(selectedSchoolForRenewal.id, nextMonth.toISOString().split('T')[0]);
                  }}
                  className="p-3 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-extrabold text-slate-800 text-center cursor-pointer"
                >
                  + شهر واحد (30 يوماً)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextYear = new Date();
                    nextYear.setFullYear(nextYear.getFullYear() + 1);
                    handleExtendSchoolSubscription(selectedSchoolForRenewal.id, nextYear.toISOString().split('T')[0]);
                  }}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-black text-emerald-900 text-center cursor-pointer"
                >
                  + سنة كاملة (365 يوماً)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ انتهاء مخصص بالروزنامة:</label>
                <input
                  type="date"
                  value={customRenewalDate}
                  onChange={(e) => setCustomRenewalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 outline-none text-xs font-bold bg-slate-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSchoolForRenewal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!customRenewalDate}
                onClick={() => {
                  if (customRenewalDate) {
                    handleExtendSchoolSubscription(selectedSchoolForRenewal.id, customRenewalDate);
                  }
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                حفظ التاريخ المخصص
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHOOL TEACHERS & STAFF MODAL */}
      {selectedSchoolForTeachers && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative max-h-[90vh] flex flex-col dir-rtl">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center font-bold shadow-xs">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    جدول المعلمين والكادر المضافين
                  </h3>
                  <p className="text-xs font-extrabold text-indigo-700 mt-0.5">
                    مدرسة: <span className="text-slate-900">{selectedSchoolForTeachers.name}</span> | الفرع: <span className="text-slate-900">{selectedSchoolForTeachers.branch}</span> | العام الدراسي: <span className="text-slate-900">{selectedSchoolForTeachers.activationYear}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportSchoolStaffExcel(selectedSchoolForTeachers)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="تصدير جميع بيانات الكادر والطلاب إلى ملف اكسل باللغة العربية (RTL)"
                >
                  <Download className="w-4 h-4 text-emerald-100" />
                  <span>تصدير اكسل</span>
                </button>
                <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                  <span>استيراد اكسل</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => handleImportStaffExcel(e, selectedSchoolForTeachers)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openAddStaffModal(selectedSchoolForTeachers)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  إضافة معلم/كادر جديد
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSchoolForTeachers(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Bar & Filters Control Bar */}
            <div className="space-y-3 shrink-0 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ابحث باسم المعلم أو الطالب، الرقم التسلسلي، أو رقم الكود..."
                  value={schoolTeacherSearchQuery}
                  onChange={(e) => setSchoolTeacherSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-white"
                />
              </div>

              {/* Filters Row: Role Filter Buttons, Grade Filter & Section Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Role Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSchoolStaffRoleFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      schoolStaffRoleFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-300/60'
                    }`}
                  >
                    👥 الجميع
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchoolStaffRoleFilter('teachers')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      schoolStaffRoleFilter === 'teachers'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-300/60'
                    }`}
                  >
                    👨‍🏫 المعلمون والكادر
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchoolStaffRoleFilter('students')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      schoolStaffRoleFilter === 'students'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-300/60'
                    }`}
                  >
                    🎓 الطلاب
                  </button>
                </div>

                {/* Grade & Section Dropdown Filters */}
                <div className="flex items-center gap-2 grow sm:grow-0">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <select
                      value={schoolStaffGradeFilter}
                      onChange={(e) => setSchoolStaffGradeFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:border-indigo-600 outline-none cursor-pointer"
                    >
                      <option value="all">تصفية الصف: (جميع الصفوف)</option>
                      {ALL_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g === 'تمهيدي' ? 'الصف: تمهيدي' : `الصف: ${g}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={schoolStaffSectionFilter}
                      onChange={(e) => setSchoolStaffSectionFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:border-indigo-600 outline-none cursor-pointer"
                    >
                      <option value="all">تصفية الشعبة: (جميع الشعب)</option>
                      {ALL_SECTIONS.map((sec) => (
                        <option key={sec} value={sec}>
                          الشعبة: {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(schoolStaffRoleFilter !== 'all' || schoolStaffGradeFilter !== 'all' || schoolStaffSectionFilter !== 'all' || schoolTeacherSearchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSchoolStaffRoleFilter('all');
                        setSchoolStaffGradeFilter('all');
                        setSchoolStaffSectionFilter('all');
                        setSchoolTeacherSearchQuery('');
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline px-2 cursor-pointer"
                    >
                      إعادة تصفية
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-y-auto grow rounded-2xl border border-slate-200">
              {(() => {
                const teachers = localRoster.filter((u) => {
                  const matchesSchool =
                    u.schoolName === selectedSchoolForTeachers.name ||
                    (selectedSchoolForTeachers.name && u.schoolName?.trim() === selectedSchoolForTeachers.name?.trim());
                  if (!matchesSchool) return false;

                  if (schoolTeacherSearchQuery.trim()) {
                    const q = schoolTeacherSearchQuery.toLowerCase().trim();
                    const matchQ =
                      u.name.toLowerCase().includes(q) ||
                      (u.serialNumber && u.serialNumber.includes(q)) ||
                      (u.code && u.code.includes(q));
                    if (!matchQ) return false;
                  }

                  // Role Filter
                  if (schoolStaffRoleFilter === 'teachers') {
                    if (u.role !== 'teacher' && u.role !== 'admin') return false;
                  } else if (schoolStaffRoleFilter === 'students') {
                    if (u.role !== 'student') return false;
                  }

                  // Grade Filter
                  if (schoolStaffGradeFilter !== 'all') {
                    if (!u.grade) return false;
                    const uGrades = u.grade.split(',').map((g) => g.trim());
                    if (!uGrades.includes(schoolStaffGradeFilter) && !u.grade.includes(schoolStaffGradeFilter)) {
                      return false;
                    }
                  }

                  // Section Filter
                  if (schoolStaffSectionFilter !== 'all') {
                    if (!u.section) return false;
                    const uSections = u.section.split(',').map((s) => s.trim());
                    if (!uSections.includes(schoolStaffSectionFilter) && !u.section.includes(schoolStaffSectionFilter)) {
                      return false;
                    }
                  }

                  return true;
                });

                if (teachers.length === 0) {
                  return (
                    <div className="p-12 text-center space-y-3 bg-slate-50">
                      <Users className="w-12 h-12 text-slate-300 mx-auto" />
                      <p className="text-sm font-extrabold text-slate-600">
                        لا يوجد معلمون أو كادر مضافون لهذه المدرسة حتى الآن.
                      </p>
                      <button
                        type="button"
                        onClick={() => openAddStaffModal(selectedSchoolForTeachers)}
                        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        إضافة معلم/كادر الآن
                      </button>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-white font-extrabold sticky top-0 z-10">
                      <tr>
                        <th className="p-3.5 text-center w-10">#</th>
                        <th className="p-3.5">الرقم التسلسلي</th>
                        <th className="p-3.5">رقم الكود</th>
                        <th className="p-3.5">اسم المعلم / الكادر</th>
                        <th className="p-3.5">اسم المدرسة</th>
                        <th className="p-3.5">الفرع</th>
                        <th className="p-3.5">الصف والشعبة</th>
                        <th className="p-3.5">الصلاحيات والصفة</th>
                        <th className="p-3.5 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 font-semibold bg-white">
                      {teachers.map((usr, idx) => (
                        <tr key={usr.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-purple-50 text-purple-900 border border-purple-200 rounded-lg font-mono font-bold">
                              {usr.serialNumber}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg font-mono font-bold">
                              {usr.code}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-extrabold text-slate-900 text-sm">{usr.name}</div>
                            {usr.email && <div className="text-[10px] text-slate-500 font-mono">{usr.email}</div>}
                          </td>
                          <td className="p-3.5 font-bold text-slate-800">{usr.schoolName}</td>
                          <td className="p-3.5 text-slate-600">{usr.branch || selectedSchoolForTeachers.branch}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md text-[11px] font-bold">
                              الصف: {usr.grade || '1'} | الشعبة: {usr.section || 'أ'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                                usr.role === 'teacher'
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                  : usr.role === 'admin'
                                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}
                            >
                              {usr.role === 'teacher' ? 'معلم / كادر تدريسي' : usr.role === 'admin' ? 'مدير / مشرف' : 'طالب'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditStaffModal(usr)}
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer text-[11px] border border-indigo-200 shadow-2xs"
                                title="تعديل بيانات وصلاحيات المعلم/الكادر"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTeacherFromSchool(usr)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer text-[11px] border border-rose-200 shadow-2xs"
                                title="حذف هذا المعلم/الكادر من المدرسة وسحابة Firebase"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0 text-xs font-bold text-slate-600">
              <div>
                إجمالي المعلمين/الكادر لهذه المدرسة: <strong className="text-indigo-900 text-sm font-mono font-black">{getTeachersCountForSchool(selectedSchoolForTeachers)}</strong>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchoolForTeachers(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STAFF/TEACHER MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-indigo-200 space-y-6 relative dir-rtl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">تعديل بيانات وصلاحيات المعلم / الكادر</h3>
                  <p className="text-xs font-bold text-slate-500">تحديث أسمائهم والأكواد والأرقام التسلسلية والصلاحيات وسنقرها في Firebase</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  اسم المعلم / الكادر *
                </label>
                <input
                  type="text"
                  required
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-slate-50"
                  placeholder="أدخل الاسم الكامل..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    الرقم التسلسلي (Serial Number) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStaffSerial}
                    onChange={(e) => setEditStaffSerial(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-mono font-bold bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    رقم الكود / كلمة المرور (Code) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStaffCode}
                    onChange={(e) => setEditStaffCode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-mono font-bold bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  الصفة والصلاحية
                </label>
                <select
                  value={editStaffRole}
                  onChange={(e) => setEditStaffRole(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-slate-50"
                >
                  <option value="teacher">معلم / كادر تدريسي</option>
                  <option value="admin">مدير / مشرف</option>
                  <option value="student">طالب</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>تحديد الصفوف (يمكن اختيار أكثر من صف) *</span>
                  <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    المحدد: {editStaffGrades.join(', ')}
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {ALL_GRADES.map((g) => {
                    const isSel = editStaffGrades.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleEditStaffGrade(g)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSel
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {g === 'تمهيدي' ? 'تمهيدي' : `صف ${g}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>تحديد الشعب (يمكن اختيار أكثر من شعبة) *</span>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    المحدد: {editStaffSections.join(', ')}
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {ALL_SECTIONS.map((sec) => {
                    const isSel = editStaffSections.includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => toggleEditStaffSection(sec)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSel
                            ? 'bg-emerald-600 text-white shadow-xs font-black'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        شعبة {sec}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    الفرع
                  </label>
                  <input
                    type="text"
                    value={editStaffBranch}
                    onChange={(e) => setEditStaffBranch(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    البريد الإلكتروني (اختياري)
                  </label>
                  <input
                    type="email"
                    value={editStaffEmail}
                    onChange={(e) => setEditStaffEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-slate-50"
                    placeholder="email@domain.com"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  حفظ التعديلات والتزامن السحابي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: USERS, SESSION RESET & FORCE LOGOUT CONTROLS */}
      {adminTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-6 animate-fadeIn">
          {/* Top Header & Force Logout Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  حل القفل المزدوج وتصفير الجلسات المركزية (Force Logout)
                </h3>
                <p className="text-xs text-slate-500">
                  إذا نسي معلم أو طالب تسجيل الخروج من جهاز معمل المدرسة، اضغط على زر "تصفير الجلسة" لتفريغ active_session_id فوراً
                </p>
              </div>
            </div>

            {/* Reset All & Current Teacher Profile Sessions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleForceResetAllSessions}
                disabled={isResettingAllSessions || filteredRoster.length === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 transition-all"
                title="تصفير الجلسات وفك القفل المزدوج لجميع المستخدمين المعروضين حالياً بالجدول"
              >
                {isResettingAllSessions ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-white" />
                )}
                <span>تصفير الجلسات لجميع الظاهرين بالجدول ({filteredRoster.length})</span>
              </button>

              {teacherProfile && (
                <button
                  type="button"
                  onClick={handleForceResetTeacherProfileSession}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  تصفير جلسة المعلم الحالي ({teacherProfile.teacherName})
                </button>
              )}
            </div>
          </div>

          {/* MASTER SCHOOL DROPDOWN (قائمة المدارس المركزية) */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-sm font-black text-amber-300">قائمة المدارس المركزية (Master School Dropdown):</h4>
                <p className="text-xs text-slate-300">تصفية واستعلام الحسابات والطلاب مباشرة من المجموعات المعزولة السحابية (/schools/school_id/users)</p>
              </div>
            </div>

            <div className="min-w-[280px]">
              <select
                value={selectedMasterSchoolSlug}
                onChange={(e) => setSelectedMasterSchoolSlug(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 text-amber-300 font-extrabold text-xs border border-amber-500/50 outline-none focus:border-amber-400 cursor-pointer shadow-inner"
              >
                <option value="all">🌐 جميع المدارس (العرض العام المركزي)</option>
                {schools.map((s) => {
                  const slug = getSchoolSlug(s.name);
                  return (
                    <option key={s.id} value={slug}>
                      🏫 {s.name} ({s.branch})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* ROLE & SEARCH SUB-TAB BUTTONS */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setUserRoleFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                userRoleFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              جميع الحسابات ({baseRosterPool.length})
            </button>

            <button
              type="button"
              onClick={() => setUserRoleFilter('teachers')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                userRoleFilter === 'teachers'
                  ? 'bg-indigo-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>الكادر التعليمي والمعلمون</span>
            </button>

            <button
              type="button"
              onClick={() => setUserRoleFilter('students')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                userRoleFilter === 'students'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>جدول الطلاب والصفوف المعزول</span>
            </button>

            <button
              type="button"
              onClick={() => setUserRoleFilter('global_search')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                userRoleFilter === 'global_search'
                  ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-slate-900" />
              <span>شريط البحث العالمي السحابي (Cross-Tenant Search)</span>
            </button>
          </div>

          {/* CROSS-TENANT GLOBAL SEARCH PANEL */}
          {userRoleFilter === 'global_search' && (
            <div className="space-y-4 p-5 bg-gradient-to-br from-amber-500/10 via-slate-50 to-slate-100 rounded-2xl border-2 border-amber-400/60 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-amber-600 shrink-0" />
                <h4 className="text-sm font-black text-slate-900">
                  البحث الشامل عبر جميع المدارس المعزولة سحابياً (collectionGroup):
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                ابحث عن أي طالب أو معلم عبر قاعدة Firebase بأكملها في كافة المسارات (/schools/*/users).
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="أدخل اسم الطالب، الرقم التسلسلي، أو الكود للبحث الفوري..."
                    value={globalSearchTerm}
                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunGlobalSearch()}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 outline-none text-xs font-bold bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRunGlobalSearch}
                  disabled={isSearchingGlobal}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isSearchingGlobal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>تنفيذ البحث السحابي</span>
                </button>
              </div>

              {/* Search Results Table */}
              {globalSearchResults.length > 0 && (
                <div className="space-y-3 pt-3">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم العثور على ({globalSearchResults.length}) حساب مطاق:</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-900 text-white font-extrabold">
                        <tr>
                          <th className="p-3">اسم المستخدم والصفة</th>
                          <th className="p-3">المدرسة والمسار المعزول (School Slug)</th>
                          <th className="p-3">بيانات الدخول (Serial / Code)</th>
                          <th className="p-3 text-center">أداة تصحيح المسار والنقل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {globalSearchResults.map((resUser) => (
                          <tr key={`${resUser.schoolId}_${resUser.id}`} className="hover:bg-amber-50/60">
                            <td className="p-3">
                              <div className="font-extrabold text-slate-900">{resUser.name}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-900">
                                  {resUser.role === 'teacher' ? 'معلم' : 'طالب'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-indigo-900">{resUser.schoolName}</div>
                              <div className="text-[10px] font-mono text-slate-500">/schools/{resUser.schoolId}/users</div>
                            </td>
                            <td className="p-3 font-mono">
                              <div className="text-purple-900 font-bold">تسلسلي: {resUser.serialNumber}</div>
                              <div className="text-slate-600 text-[10px]">كود: {resUser.code}</div>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferModalUser(resUser);
                                  setTransferTargetSchoolSlug('');
                                }}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-[11px] flex items-center gap-1 mx-auto shadow-xs cursor-pointer"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                <span>نقل لمدرسة أخرى</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search & Filter Bar for Table */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم، الرقم التسلسلي، الكود، الصف، أو المدرسة..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={userFilterStatus}
                  onChange={(e: any) => setUserFilterStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-white"
                >
                  <option value="all">جميع الحالات ({baseRosterPool.length})</option>
                  <option value="session_locked">مربوط بجلسة نشطة (يحتاج تصفير)</option>
                  <option value="suspended">الحسابات الموقوفة إدارياً</option>
                  <option value="unauthorized">الحسابات غير المصرحة</option>
                  <option value="expired">الحسابات منتهية الصلاحية</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleForceResetAllSessions}
              disabled={isResettingAllSessions || filteredRoster.length === 0}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 shrink-0 transition-all"
              title="تصفير القفل المزدوج لجميع المستخدمين المعروضين في الجدول حالياً"
            >
              {isResettingAllSessions ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <RotateCcw className="w-4 h-4 text-white" />
              )}
              <span>تصفير الجلسات لجميع المستخدمين في الجدول ({filteredRoster.length})</span>
            </button>
          </div>

          {/* Users Roster Table */}
          {isLoadingIsolatedUsers ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">جاري جلب حسابات المدرسة المعزولة سحابياً من Firebase...</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-extrabold">
                  <tr>
                    <th className="p-3.5">اسم المستخدم والصفة</th>
                    <th className="p-3.5">المدرسة والفرع / الصف</th>
                    <th className="p-3.5">بيانات الدخول (Serial / Code)</th>
                    <th className="p-3.5">تاريخ انتهاء الترخيص</th>
                    <th className="p-3.5">حالة الجلسة النشطة (Active Session)</th>
                    <th className="p-3.5 text-center">الإجراءات والتحكم الإداري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 font-semibold">
                  {filteredRoster.map((usr) => {
                    const statusBadge = getUserStatusBadge(usr);
                    const hasActiveSession =
                      usr.active_session_id &&
                      usr.last_activity_at &&
                      Date.now() - usr.last_activity_at < 2 * 60 * 60 * 1000;

                    return (
                      <tr
                        key={usr.id}
                        className={
                          usr.is_suspended
                            ? 'bg-rose-50/60'
                            : usr.is_unauthorized
                            ? 'bg-purple-50/60'
                            : hasActiveSession
                            ? 'bg-amber-50/40'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="p-3.5">
                          <div className="font-extrabold text-slate-900 text-sm">{usr.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                usr.role === 'teacher'
                                  ? 'bg-indigo-100 text-indigo-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {usr.role === 'teacher' ? 'معلم / إدارة' : 'طالب'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] border font-bold ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{usr.schoolName}</div>
                          <div className="text-[11px] text-slate-500">
                            {usr.branch} {usr.grade ? `| الصف: ${usr.grade}` : ''} {usr.section ? `(${usr.section})` : ''}
                          </div>
                        </td>

                        <td className="p-3.5 font-mono">
                          <div className="text-purple-900 font-bold">تسلسلي: {usr.serialNumber}</div>
                          <div className="text-slate-600 text-[11px]">كود: {usr.code}</div>
                          {usr.email && <div className="text-indigo-700 text-[10px]">{usr.email}</div>}
                        </td>

                        <td className="p-3.5">
                          <div className="font-mono font-bold text-slate-900">
                            {usr.subscription_end_date || 'غير محدد'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedUserForRenewal(usr)}
                            className="text-[10px] text-amber-700 font-extrabold underline hover:text-amber-900 mt-0.5 block cursor-pointer"
                          >
                            تعديل تاريخ الانتهاء
                          </button>
                        </td>

                        {/* Active Session Column */}
                        <td className="p-3.5">
                          {hasActiveSession ? (
                            <div className="space-y-1">
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black inline-flex items-center gap-1 animate-pulse">
                                <Lock className="w-3 h-3 text-amber-600" />
                                جلسة نشطة على جهاز محدد
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                ID: {usr.active_session_id?.substring(0, 14)}...
                              </div>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                              مستقر (لا توجد جلسة معلقة)
                            </span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="p-3.5 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {/* Orphan Transfer Button for Students */}
                            {usr.role !== 'teacher' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferModalUser(usr);
                                  setTransferTargetSchoolSlug('');
                                }}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                                title="نقل الطالب ومستنداته إلى مدرسة أخرى"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                                نقل مدرسة
                              </button>
                            )}

                            {/* Force Logout / Reset Session */}
                            <button
                              type="button"
                              onClick={() => handleForceResetUserSession(usr.id)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-black rounded-xl text-[11px] shadow-xs flex items-center gap-1 cursor-pointer"
                              title="إلغاء الارتباط بالجهاز القديم فوراً"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              تصفير الجلسة
                            </button>

                            {/* Toggle Authorization */}
                            <button
                              type="button"
                              onClick={() => handleToggleUserAuthorization(usr.id)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                usr.is_unauthorized
                                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {usr.is_unauthorized ? 'منح الإذن' : 'غير مصرح'}
                            </button>

                            {/* Toggle Suspend */}
                            <button
                              type="button"
                              onClick={() => handleToggleUserSuspension(usr.id)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                usr.is_suspended
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                              }`}
                            >
                              {usr.is_suspended ? 'فك التعليق' : 'إيقاف الحساب'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RENEWAL / EXTENSION MODAL FOR USERS */}
      {selectedUserForRenewal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-5 dir-rtl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold shrink-0">
                <CalendarPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  تمديد ترخيص المستخدم: <span className="text-indigo-900">{selectedUserForRenewal.name}</span>
                </h3>
                <p className="text-xs text-slate-500">خصص تاريخ الانتهاء الجديد لحساب المستخدم</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    handleExtendUserSubscription(selectedUserForRenewal.id, nextMonth.toISOString().split('T')[0]);
                  }}
                  className="p-3 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 text-center cursor-pointer"
                >
                  + شهر واحد
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextYear = new Date();
                    nextYear.setFullYear(nextYear.getFullYear() + 1);
                    handleExtendUserSubscription(selectedUserForRenewal.id, nextYear.toISOString().split('T')[0]);
                  }}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-black text-emerald-900 text-center cursor-pointer"
                >
                  + سنة كاملة
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ مخصص:</label>
                <input
                  type="date"
                  value={userRenewalDate}
                  onChange={(e) => setUserRenewalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 outline-none text-xs font-bold bg-slate-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedUserForRenewal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!userRenewalDate}
                onClick={() => {
                  if (userRenewalDate) {
                    handleExtendUserSubscription(selectedUserForRenewal.id, userRenewalDate);
                  }
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                حفظ التمديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORPHAN STUDENT TRANSFER MODAL */}
      {transferModalUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-amber-400 space-y-5 dir-rtl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold shrink-0">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  أداة تصحيح مسار الطالب ونقله (Orphan Transfer Tool)
                </h3>
                <p className="text-xs text-slate-500">نقل الطالب برمجياً بين المجموعات الفرعية المعزولة (/schools/school_id/users)</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div><span className="font-bold text-slate-500">اسم الطالب: </span> <strong className="text-slate-900 text-sm">{transferModalUser.name}</strong></div>
              <div><span className="font-bold text-slate-500">الرقم التسلسلي: </span> <code className="font-mono text-purple-900 font-bold">{transferModalUser.serialNumber}</code></div>
              <div><span className="font-bold text-slate-500">المدرسة الحالية: </span> <strong className="text-rose-700">{transferModalUser.schoolName}</strong> <span className="text-[10px] text-slate-400 font-mono">(/schools/{transferModalUser.schoolId || getSchoolSlug(transferModalUser.schoolName)}/users)</span></div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">اختر المدرسة المستهدفة الجديدة لنقل الطالب إليها:</label>
              <select
                value={transferTargetSchoolSlug}
                onChange={(e) => setTransferTargetSchoolSlug(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 focus:border-amber-500 outline-none text-xs font-extrabold text-slate-900"
              >
                <option value="">-- اختر مدرسة من قائمة التراخيص الرسمية --</option>
                {schools.map((s) => {
                  const slug = getSchoolSlug(s.name);
                  return (
                    <option key={s.id} value={slug}>
                      🏫 {s.name} ({s.branch})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTransferModalUser(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!transferTargetSchoolSlug || isTransferring}
                onClick={handleExecuteTransfer}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isTransferring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>تأكيد نقل الطالب الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECRETARIAT STAFF CONTROL */}
      {adminTab === 'staff' && (
        <div className="p-6 bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-3xl shadow-2xl border-2 border-amber-400/60 space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-purple-800/80">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-400 text-slate-950 rounded-2xl flex items-center justify-center font-black">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-amber-300">
                  طاقم السكرتارية وتعيين الصلاحيات (Secretariat Staff)
                </h3>
                <p className="text-xs text-purple-200">
                  إدارة الصلاحيات المتقدمة وقواعد العزل المؤسسي (SchoolScope)
                </p>
              </div>
            </div>

            <div className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>العزل التام (Multi-Tenancy Global Scope) : نشطة</span>
            </div>
          </div>

          {/* Add Staff Form */}
          <form onSubmit={handleAddStaff} className="p-4 bg-purple-950/60 rounded-2xl border border-purple-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1">اسم موظف السكرتارية / المشرف</label>
              <input
                type="text"
                required
                placeholder="أدخل الاسم الرباعي..."
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-600 text-white text-xs font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1">كود الموظف المسجل (SEC-Code)</label>
              <input
                type="text"
                required
                placeholder="مثال: SEC-9912"
                value={newStaffCode}
                onChange={(e) => setNewStaffCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-600 text-white text-xs font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1">المدرسة التابع لها</label>
              <select
                value={selectedStaffSchool}
                onChange={(e) => setSelectedStaffSchool(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-600 text-white text-xs font-bold outline-none"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة موظف سكرتارية وتعيين الصلاحيات
              </button>
            </div>
          </form>

          {/* Staff List Table */}
          <div className="overflow-x-auto rounded-2xl border border-purple-700/60 bg-slate-900/60">
            <table className="w-full text-right text-xs">
              <thead className="bg-purple-950 text-purple-200 font-extrabold border-b border-purple-800">
                <tr>
                  <th className="p-3">اسم الموظف والكود</th>
                  <th className="p-3">المدرسة المخصصة</th>
                  <th className="p-3">الصلاحيات الممنوحة</th>
                  <th className="p-3">حالة السجل (Soft Delete)</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/60 text-purple-100 font-medium">
                {staffList.map((st) => (
                  <tr key={st.id} className={st.isSoftDeleted ? 'opacity-40 bg-purple-950/40' : 'hover:bg-purple-900/30'}>
                    <td className="p-3">
                      <div className="font-extrabold text-white">{st.name}</div>
                      <div className="text-[10px] text-amber-300 font-mono">{st.staffCode}</div>
                    </td>
                    <td className="p-3">{st.schoolName}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {st.rolePermissions.map((p, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-purple-800/80 border border-purple-600 rounded-md text-[10px] font-bold">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {st.isSoftDeleted ? (
                        <span className="px-2.5 py-1 bg-red-900/60 text-red-300 border border-red-700 rounded-lg text-[10px] font-bold">
                          مخفي برمجياً (Soft Deleted)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-900/60 text-emerald-300 border border-emerald-700 rounded-lg text-[10px] font-bold">
                          سجل نشط (Active Record)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSoftDeleteStaff(st.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-purple-500 text-amber-300 font-bold rounded-lg text-[11px] transition-all cursor-pointer"
                      >
                        {st.isSoftDeleted ? 'استعادة السجل' : 'إخفاء مرن (Soft Delete)'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LARAVEL CONTROLLERS & BLADE VIEWS REFERENCE CODE */}
      {adminTab === 'code_views' && (
        <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-700 space-y-6 animate-fadeIn dir-rtl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center font-bold border border-teal-500/30">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-teal-300">
                  أكواد نظام التحكم التجاري (Admin Controllers & Blade Views)
                </h3>
                <p className="text-xs text-slate-400">
                  أكواد برمجية معتمدة ومجهزة بالكامل لوظائف التراخيص، إغلاق الجلسة المركزية، وتجديد الاشتراكات.
                </p>
              </div>
            </div>
          </div>

          {/* Section A: LicenseAdminController.php */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 font-mono">
                1. app/Http/Controllers/Admin/LicenseAdminController.php
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(LARAVEL_CONTROLLER_CODE, 'controller')}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-teal-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                {copiedSection === 'controller' ? 'تم النسخ ✓' : 'نسخ كود Controller'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-2xl text-[11px] font-mono text-emerald-300 overflow-x-auto border border-slate-800 leading-relaxed dir-ltr">
              {LARAVEL_CONTROLLER_CODE}
            </pre>
          </div>

          {/* Section B: license-management.blade.php */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 font-mono">
                2. resources/views/admin/licenses/index.blade.php
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(LARAVEL_BLADE_VIEW_CODE, 'blade')}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-teal-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                {copiedSection === 'blade' ? 'تم النسخ ✓' : 'نسخ كود Blade View'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-2xl text-[11px] font-mono text-indigo-300 overflow-x-auto border border-slate-800 leading-relaxed dir-ltr">
              {LARAVEL_BLADE_VIEW_CODE}
            </pre>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddStaffOpen && selectedSchoolForStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-fadeIn">
            <div className="bg-blue-600 p-4 flex items-center justify-between text-white">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <UserPlus className="w-5 h-5" />
                إضافة كادر إلى مدرسة ({selectedSchoolForStaff.name})
              </h3>
              <button type="button" onClick={() => setIsAddStaffOpen(false)} className="text-blue-100 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddStaffSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المعلم</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أ. إبراهيم دخان"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none text-sm font-semibold bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرقم التسلسلي</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      readOnly
                      placeholder="9 أرقام"
                      value={staffSerial}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 outline-none text-xs font-mono font-bold bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={generateStaffSerial}
                      className="px-3 py-2.5 bg-blue-100 text-blue-700 font-bold rounded-xl text-xs hover:bg-blue-200"
                    >
                      توليد
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الكود</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      readOnly
                      placeholder="7 أرقام"
                      value={staffCode}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 outline-none text-xs font-mono font-bold bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={generateStaffCode}
                      className="px-3 py-2.5 bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs hover:bg-indigo-200"
                    >
                      توليد
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>الصف / الصفوف (يمكن اختيار أكثر من صف) *</span>
                  <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    المحدد: {staffGrades.join(', ')}
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {ALL_GRADES.map((g) => {
                    const isSel = staffGrades.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleStaffGrade(g)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSel
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {g === 'تمهيدي' ? 'تمهيدي' : `صف ${g}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>الشعبة / الشعب (يمكن اختيار أكثر من شعبة) *</span>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    المحدد: {staffSections.join(', ')}
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {ALL_SECTIONS.map((sec) => {
                    const isSel = staffSections.includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => toggleStaffSection(sec)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSel
                            ? 'bg-emerald-600 text-white shadow-xs font-black'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        شعبة {sec}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الصلاحيات</label>
                  <select
                    value={staffPermissions}
                    onChange={(e) => setStaffPermissions(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 outline-none text-xs font-bold bg-white focus:border-blue-600"
                  >
                    <option value="معلم">معلم</option>
                    <option value="مشرف">مشرف</option>
                    <option value="مدير">مدير</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الفترة الزمنية للصلاحيات</label>
                  <select
                    value={staffValidity}
                    onChange={(e) => setStaffValidity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 outline-none text-xs font-bold bg-white focus:border-blue-600"
                  >
                    <option value="سنة دراسية واحدة">سنة دراسية واحدة</option>
                    <option value="فصل دراسي واحد">فصل دراسي واحد</option>
                    <option value="دائم">دائم</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العام الدراسي</label>
                <input
                  type="text"
                  required
                  value={staffAcademicYear}
                  onChange={(e) => setStaffAcademicYear(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-600 outline-none text-xs font-bold bg-slate-50 text-indigo-900"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30"
                >
                  حفظ البيانات للموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
