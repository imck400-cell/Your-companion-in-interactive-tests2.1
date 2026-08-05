import React, { useState, useRef } from 'react';
import { deleteRosterUserFromFirebase, saveSingleRosterUserToFirebase, syncRosterToFirebase, normalizeDigits, generateDeterministicUserId } from '../../services/firebase';
import * as XLSX from 'xlsx';
import { RosterUser, TeacherProfile } from '../../types';
import { PrintWatermark } from '../PrintWatermark';
import {
  generateServerSideExcelExport,
  dispatchServerImportQueueJob,
  BackgroundQueueJob,
} from '../../services/ServerSideExcelQueue';
import {
  Users,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  Search,
  ShieldCheck,
  GraduationCap,
  School,
  Key,
  Lock,
  X,
  FileText,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface RosterManagerProps {
  roster: RosterUser[];
  onUpdateRoster: (newRoster: RosterUser[]) => void;
  currentSchoolName?: string;
  currentBranch?: string;
  currentGrade?: string;
  currentSection?: string;
  teacherProfile?: TeacherProfile | null;
  isAdmin?: boolean;
  onRefreshRoster?: () => void;
}

export const RosterManager: React.FC<RosterManagerProps> = ({
  roster,
  onUpdateRoster,
  currentSchoolName = 'مدرسة الفاروق النموذجية',
  currentBranch = 'عام',
  currentGrade,
  currentSection,
  teacherProfile,
  isAdmin = false,
  onRefreshRoster,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'student' | 'teacher'>('all');
  
  // Grade and Section filters default to 'الكل' to show all students and staff initially
  const [filterGrade, setFilterGrade] = useState<string>('الكل');
  const [filterSection, setFilterSection] = useState<string>('الكل');

  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Background Queue Job State (Stage 12 Big Data Engineering)
  const [activeQueueJob, setActiveQueueJob] = useState<BackgroundQueueJob | null>(null);

  // Manual Add Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState<'student' | 'teacher'>('student');
  const [addSchool, setAddSchool] = useState(currentSchoolName);
  const [addBranch, setAddBranch] = useState(currentBranch);
  const [addGrade, setAddGrade] = useState('1');
  const [addSection, setAddSection] = useState('أ');

  // Print ID Cards Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Duplicates Mode State
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const [showMySchoolOnly, setShowMySchoolOnly] = useState(true);
  const [allowImportDuplicates, setAllowImportDuplicates] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: 'single' | 'multiple';
    id?: string;
    name?: string;
  }>({ isOpen: false, type: 'multiple' });

  // Row Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueFileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Generate Unique 9-Digit Serial Number
  const generateUniqueSerialNumber = (existingSerials: Set<string>): string => {
    let serial = '';
    let attempts = 0;
    while (attempts < 1000) {
      const randomNum = Math.floor(100000000 + Math.random() * 900000000);
      serial = String(randomNum);
      if (!existingSerials.has(serial)) {
        existingSerials.add(serial);
        return serial;
      }
      attempts++;
    }
    throw new Error('تعذر توليد رقم تسلسلي فريد. يرجى محاولة التوليد مرة أخرى.');
  };

  // Helper: Generate 7-Digit Code
  const generate7DigitCode = (): string => {
    const randomNum = Math.floor(1000000 + Math.random() * 9000000);
    return String(randomNum);
  };

  // 1. Download Blank Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'الاسم': 'أحمد محمد العلي',
        'الصفة': 'طالب',
        'المدرسة': currentSchoolName,
        'الفرع': currentBranch,
        'الصف': 'الثالث الثانوي',
        'الشعبة': 'أ',
      },
      {
        'الاسم': 'سارة عبد الله خالد',
        'الصفة': 'طالب',
        'المدرسة': currentSchoolName,
        'الفرع': currentBranch,
        'الصف': 'الثاني الثانوي',
        'الشعبة': 'ب',
      },
      {
        'الاسم': 'د. محمود حسن',
        'الصفة': 'معلم',
        'المدرسة': currentSchoolName,
        'الفرع': currentBranch,
        'الصف': 'كافة الصفوف',
        'الشعبة': 'كافة الشعب',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قالب الطلاب والمعلمين');

    XLSX.writeFile(workbook, 'قالب_استيراد_الطلاب_والمعلمين.xlsx');
  };

  // Stage 12: Server-Side RTL Excel Export with Data Validation Dropdowns & IF Formulas
  const handleServerSideExport = () => {
    try {
      generateServerSideExcelExport(roster, `تقرير_الطلاب_والمعلمين_السيرفر_RTL.xlsx`);
      setImportSuccess('تم توليد ملف Excel المنسق (RTL) المعتمد في السيرفر مع القوائم المنسدلة ودوال IF بنجاح!');
    } catch (err: any) {
      setImportError('حدث خطأ أثناء تصدير ملف Excel عبر السيرفر: ' + err.message);
    }
  };

  // Stage 12: Background Queue Job Import Handler (Laravel Queue Jobs & DB::transaction Isolation)
  const handleQueueFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawRows || rawRows.length === 0) {
          setImportError('الملف المرفق فارغ ولا يحتوي على أي صفوف بيانات.');
          return;
        }

        // Dispatch Background Queue Job
        dispatchServerImportQueueJob(
          rawRows,
          roster,
          allowImportDuplicates,
          (jobProgress) => {
            setActiveQueueJob(jobProgress);
          },
          async (newUsers, finalJobState) => {
            if (newUsers.length > 0) {
              await syncRosterToFirebase(newUsers);
              onUpdateRoster([...roster, ...newUsers]);
            }
            
            const duplicates = newUsers.filter((u) => u.isDuplicateReplaced).length;
            const duplicateMsg = duplicates > 0 ? ` (تم تغيير الأرقام التسلسلية/الأكواد لـ ${duplicates} مستخدم وتم تلوينهم بالبرتقالي).` : '';

            if (finalJobState.rolledBackSchools.length > 0) {
              setImportError(
                `اكتملت طابور المعالجة جزئياً: تم إدخال (${newUsers.length}) مستخدم، وتراجع DB::rollBack عن (${finalJobState.rolledBackSchools.length}) مدرسة بسبب أخطاء البيانات.` + duplicateMsg
              );
            } else {
              setImportSuccess(`اكتملت طابور المعالجة بنجاح! تم معالجة (${newUsers.length}) مستخدم واعتماد المعاملات DB::commit.` + duplicateMsg);
            }
            if (queueFileInputRef.current) queueFileInputRef.current.value = '';
          }
        );
      } catch (err: any) {
        setImportError(err.message || 'حدث خطأ أثناء جدولة طابور العمل.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // 2. Direct Import Excel File Function
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawRows || rawRows.length === 0) {
          setImportError('الملف المرفق فارغ ولا يحتوي على أي صفوف بيانات.');
          return;
        }

        const existingSerials = new Set<string>(roster.map((u) => u.serialNumber));
        const existingCodes = new Set<string>(roster.map((u) => u.code));
        const newUsers: RosterUser[] = [];
        let skippedEmptyRows = 0;
        let duplicateCount = 0;
        let skippedDueToName = 0;

        rawRows.forEach((row, index) => {
          const name = String(row['الاسم'] || row['اسم الطالب'] || row['اسم المعلم'] || row['Name'] || '').trim();

          if (!name) {
            skippedEmptyRows++;
            return;
          }

          // Check if name already exists in roster
          const nameExists = roster.some(u => u.name.trim() === name);
          if (!allowImportDuplicates && nameExists) {
            skippedDueToName++;
            return;
          }

          const schoolName = String(row['المدرسة'] || row['اسم المدرسة'] || row['School'] || currentSchoolName).trim();
          const branch = String(row['الفرع'] || row['Branch'] || currentBranch).trim();
          const grade = String(row['الصف'] || row['Grade'] || 'الصف العام').trim();
          const section = String(row['الشعبة'] || row['Section'] || 'أ').trim();

          const rawRole = String(row['الصفة'] || row['Role'] || '').trim().toLowerCase();
          const role: 'student' | 'teacher' = rawRole.includes('معلم') || rawRole.includes('teacher') ? 'teacher' : 'student';

          let serialNumber = normalizeDigits(String(row['الرقم التسلسلي'] || row['الرقم_التسلسلي'] || row['Serial'] || '').trim());
          let code = normalizeDigits(String(row['الكود'] || row['رقم الكود'] || row['Code'] || '').trim());
          
          let isDuplicate = false;

          if (serialNumber && existingSerials.has(serialNumber)) {
            isDuplicate = true;
          }
          if (code && existingCodes.has(code)) {
            isDuplicate = true;
          }

          if (isDuplicate || !serialNumber) {
            serialNumber = generateUniqueSerialNumber(existingSerials);
            if (isDuplicate) duplicateCount++;
          }
          
          if (isDuplicate || !code || code.length < 4) {
            let newCode = generate7DigitCode();
            while (existingCodes.has(newCode)) {
              newCode = generate7DigitCode();
            }
            code = normalizeDigits(newCode);
          }

          existingSerials.add(serialNumber);
          existingCodes.add(code);

          newUsers.push({
            id: generateDeterministicUserId(schoolName, serialNumber),
            name,
            role,
            schoolName,
            branch,
            grade,
            section,
            serialNumber,
            code,
            createdAt: new Date().toISOString(),
            isDuplicateReplaced: isDuplicate,
          });
        });

        if (newUsers.length === 0) {
          setImportError('لم يتم العثور على بيانات صالحة للاستيراد في الملف.');
          return;
        }

        await syncRosterToFirebase(newUsers);
        const updatedRoster = [...roster, ...newUsers];
        onUpdateRoster(updatedRoster);

        setImportSuccess(
          `تم استيراد (${newUsers.length}) مستخدم بنجاح ومزامنتهم مع قاعدة البيانات السحابية.${
            duplicateCount > 0 ? ` (تم تغيير الأرقام التسلسلية/الأكواد لـ ${duplicateCount} طالب/معلم بسبب تكرارها في النظام وتم تلوينها بالبرتقالي).` : ''
          }${
            skippedEmptyRows > 0 ? ` (تم تجاهل ${skippedEmptyRows} صف فارغ تلقائياً).` : ''
          }${
            skippedDueToName > 0 ? ` (تم تجاهل ${skippedDueToName} صف بسبب وجود أسماء مطابقة في النظام).` : ''
          }`
        );

        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        setImportError(err.message || 'حدث خطأ أثناء معالجة ملف Excel. يرجى التأكد من مطابقة القالب.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // 3. Manual Add Function
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;

    setImportError(null);
    setImportSuccess(null);

    try {
      const existingSerials = new Set<string>(roster.map((u) => u.serialNumber));
      const rawSerial = generateUniqueSerialNumber(existingSerials);
      const rawCode = generate7DigitCode();

      const serialNumber = normalizeDigits(rawSerial);
      const code = normalizeDigits(rawCode);

      const newUser: RosterUser = {
        id: generateDeterministicUserId(addSchool.trim() || currentSchoolName || 'المدرسة العامة', serialNumber),
        name: addName.trim(),
        role: addRole,
        schoolName: addSchool.trim() || currentSchoolName || 'المدرسة العامة',
        branch: addBranch.trim() || currentBranch || 'عام',
        grade: addGrade.trim() || 'الصف العام',
        section: addSection.trim() || 'أ',
        serialNumber,
        code,
        createdAt: new Date().toISOString(),
      };

      await saveSingleRosterUserToFirebase(newUser);
      onUpdateRoster([newUser, ...roster]);

      setAddName('');
      setIsAddModalOpen(false);
      setImportSuccess(`تم إضافة (${newUser.name}) بنجاح وتوليد الرقم التسلسلي (${newUser.serialNumber}) والكود (${newUser.code}) ومزامنته فوراً مع قاعدة البيانات السحابية.`);
    } catch (err: any) {
      setImportError(err.message);
      setImportSuccess(null);
    }
  };

  // 4. Delete Roster User
  const handleDeleteUser = (id: string, name: string) => {
    setDeleteConfirmState({ isOpen: true, type: 'single', id, name });
  };

  // Filter roster by current school under user's authority
  const schoolRoster = React.useMemo(() => {
    return roster.filter((u) => {
      if (!currentSchoolName) return true;
      if (!u.schoolName) return true;
      return u.schoolName.trim().toLowerCase() === currentSchoolName.trim().toLowerCase();
    });
  }, [roster, currentSchoolName]);

  const nameCounts = React.useMemo(() => {
    return schoolRoster.reduce((acc, user) => {
      const n = user.name.trim();
      acc[n] = (acc[n] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [schoolRoster]);

  const hasDuplicates = Object.values<number>(nameCounts).some((count: number) => count > 1);
  const duplicateNames = React.useMemo(() => {
    return new Set(Object.keys(nameCounts).filter((name) => (nameCounts[name] || 0) > 1));
  }, [nameCounts]);

  const normalizeGradeStr = (g?: string) => {
    if (!g) return '';
    return g.trim().replace(/^الصف\s+/, '').replace(/\s+السنوي$/, '').replace(/\s+الثانوي$/, '');
  };

  const normalizeSectionStr = (s?: string) => {
    if (!s) return '';
    return s.trim();
  };

  const filteredRoster = React.useMemo(() => {
    const list = schoolRoster.filter((u) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        u.name.toLowerCase().includes(term) ||
        (u.serialNumber && u.serialNumber.includes(term)) ||
        (u.code && u.code.includes(term)) ||
        (u.schoolName && u.schoolName.toLowerCase().includes(term));

      const matchesRole =
        filterRole === 'all' ||
        u.role === filterRole ||
        (filterRole === 'teacher' && u.role === 'admin');

      const matchesBranch =
        !currentBranch ||
        !u.branch ||
        u.branch.trim() === 'عام' ||
        currentBranch.trim() === 'عام' ||
        u.branch.trim().toLowerCase() === currentBranch.trim().toLowerCase();

      const normUserGrade = normalizeGradeStr(u.grade);
      const normFilterGrade = normalizeGradeStr(filterGrade);
      const matchesGrade =
        filterGrade === 'الكل' ||
        !normFilterGrade ||
        normUserGrade === normFilterGrade ||
        (u.grade && u.grade.includes(filterGrade));

      const normUserSection = normalizeSectionStr(u.section);
      const normFilterSection = normalizeSectionStr(filterSection);
      const matchesSection =
        filterSection === 'الكل' ||
        !normFilterSection ||
        normUserSection === normFilterSection ||
        (u.section && u.section.includes(filterSection));

      if (showDuplicatesOnly && !duplicateNames.has(u.name.trim())) {
        return false;
      }

      return matchesSearch && matchesRole && matchesBranch && matchesGrade && matchesSection;
    });

    if (showDuplicatesOnly) {
      list.sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'ar'));
    }
    return list;
  }, [
    schoolRoster,
    searchTerm,
    filterRole,
    currentBranch,
    filterGrade,
    filterSection,
    showDuplicatesOnly,
    duplicateNames,
  ]);

  // Print ID Cards Action
  const handlePrintCards = () => {
    window.print();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRoster.length && filteredRoster.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRoster.map((u) => u.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmState({ isOpen: true, type: 'multiple' });
  };

  const confirmDelete = () => {
    if (deleteConfirmState.type === 'single' && deleteConfirmState.id) {
      const idToDelete = deleteConfirmState.id;
      onUpdateRoster(roster.filter((u) => u.id !== idToDelete));
      deleteRosterUserFromFirebase(idToDelete);
    } else if (deleteConfirmState.type === 'multiple') {
      let finalIdsToDelete = new Set(selectedIds);
      
      if (showDuplicatesOnly) {
        // Group the schoolRoster by name
        const rosterByName = schoolRoster.reduce((acc, user) => {
          const n = user.name.trim();
          if (!acc[n]) acc[n] = [];
          acc[n].push(user.id);
          return acc;
        }, {} as Record<string, string[]>);

        // For each name, if ALL of its IDs are in finalIdsToDelete, we need to KEEP one.
        Object.keys(rosterByName).forEach((name) => {
          const ids = rosterByName[name];
          if (ids.length > 1) {
            const selectedCount = ids.filter((id) => finalIdsToDelete.has(id)).length;
            if (selectedCount === ids.length) {
              finalIdsToDelete.delete(ids[0]);
            }
          }
        });
      }

      const nextRoster = roster.filter((u) => !finalIdsToDelete.has(u.id));
      onUpdateRoster(nextRoster);
      finalIdsToDelete.forEach((id: string) => deleteRosterUserFromFirebase(id));
      setSelectedIds(new Set());
      // Re-enable full view so all remaining names in the school appear in the table immediately
      setShowDuplicatesOnly(false);
    }
    setDeleteConfirmState({ isOpen: false, type: 'multiple' });
  };

  const handleDeleteAllDuplicates = () => {
    // Collect all duplicate IDs except the first one for each duplicated name in schoolRoster
    const idsToDelete = new Set<string>();
    const rosterByName = schoolRoster.reduce((acc, user) => {
      const n = user.name.trim();
      if (!acc[n]) acc[n] = [];
      acc[n].push(user.id);
      return acc;
    }, {} as Record<string, string[]>);

    Object.keys(rosterByName).forEach((name) => {
      const ids = rosterByName[name];
      if (ids.length > 1) {
        for (let i = 1; i < ids.length; i++) {
          idsToDelete.add(ids[i]);
        }
      }
    });

    if (idsToDelete.size === 0) return;

    setSelectedIds(idsToDelete);
    setDeleteConfirmState({ isOpen: true, type: 'multiple' });
  };

  return (
    <div className="space-y-6 dir-rtl">
      {/* Top Banner & Control Actions */}
      <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200/90 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 font-black">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">نظام إدارة الطلاب والمعلمين (Excel & ID Generation)</h2>
              <p className="text-xs text-slate-500 font-medium">
                استيراد البيانات من Excel، التوليد الآلي للرقم التسلسلي (9 أرقام) والكود (7 أرقام)، وطباعة بطاقات الدخول.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onRefreshRoster && (
              <button
                type="button"
                onClick={onRefreshRoster}
                className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="تحديث البيانات فورياً وتجاوز الذاكرة المؤقتة (12 ساعة)"
              >
                <RefreshCw className="w-4 h-4 text-indigo-600" />
                <span>تحديث البيانات (Force Refresh)</span>
              </button>
            )}

            {/* Download Template Button */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="تحميل قالب Excel جاهز"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              قالب Excel
            </button>

            {/* Stage 12: Server-Side Excel Export Button (RTL + Data Validation Dropdowns + IF Formulas) */}
            <button
              type="button"
              onClick={handleServerSideExport}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              title="تصدير ملف Excel منسق RTL مع القوائم المنسدلة ودوال IF"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-950" />
              <span>تصدير السيرفر (RTL & Formulas)</span>
            </button>

            {/* Stage 12: Queue Job Background Import (Laravel Queues & DB::transaction Isolation) */}
            <label className="px-3.5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-purple-700/20 transition-all cursor-pointer">
              <Clock className="w-4 h-4 text-amber-300" />
              <span>استيراد كطابور عمل (Queues)</span>
              <input
                ref={queueFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleQueueFileUpload}
                className="hidden"
              />
            </label>

            {/* Import Excel Direct Button */}
            <label className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>استيراد مباشر</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Manual Add Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة مفرداً
            </button>

            {/* Print ID Cards PDF Export */}
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              تصدير بطاقات PDF
            </button>
          </div>
          
          <div className="flex items-center gap-2 mt-2 px-1">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={allowImportDuplicates}
                onChange={() => setAllowImportDuplicates(!allowImportDuplicates)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-600"
              />
              تكرار الطلاب الذين يملكون نفس الاسم (السماح بتكرار الإضافة)
            </label>
          </div>
        </div>

        {/* Stage 12: REAL-TIME BACKGROUND QUEUE JOB PROGRESS MONITOR */}
        {activeQueueJob && (
          <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl border-2 border-purple-400 shadow-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-black text-amber-300">
                <Clock className="w-4 h-4 animate-spin text-amber-300" />
                <span>طابور معالجة البيانات (Laravel Queue Job: {activeQueueJob.id})</span>
              </div>
              <span className="px-2.5 py-0.5 bg-purple-800 rounded-full font-mono font-bold text-[11px] border border-purple-400/50">
                الحالة: {activeQueueJob.status === 'processing' ? 'جاري المعالجة...' : activeQueueJob.status === 'completed' ? 'اكتمل بنجاح ✓' : 'مكتمل جزئياً'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-purple-500">
              <div
                className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${activeQueueJob.progress}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-purple-200 font-bold">
              <span>تم معالجة {activeQueueJob.processedRows} من أصل {activeQueueJob.totalRows} صفوف</span>
              <span>النسبة: {activeQueueJob.progress}%</span>
            </div>

            {/* DB::transaction Rollback per school Log Summary */}
            {activeQueueJob.rolledBackSchools.length > 0 && (
              <div className="p-3 bg-red-950/80 rounded-xl border border-red-500 text-[11px] text-red-200 space-y-1">
                <div className="font-extrabold text-red-300 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>سجل التراجع التلقائي (DB::rollBack Isolation Log):</span>
                </div>
                {activeQueueJob.rolledBackSchools.map((r, idx) => (
                  <div key={idx} className="font-mono text-[10px] text-red-100">
                    • {r.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Feedback Messages */}
        {importError && (
          <div className="p-4 bg-red-50 text-red-900 rounded-2xl border border-red-200 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{importError}</span>
            </div>
            <button type="button" onClick={() => setImportError(null)} className="text-red-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {importSuccess && (
          <div className="p-4 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{importSuccess}</span>
            </div>
            <button type="button" onClick={() => setImportSuccess(null)} className="text-emerald-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {hasDuplicates && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  className={`px-3.5 py-2.5 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${showDuplicatesOnly ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-sm'}`}
                  title="تجميع وعرض الأسماء المكررة في الجدول"
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  {showDuplicatesOnly ? 'إلغاء تجميع المكرر' : 'تجميع الأسماء المكررة'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAllDuplicates}
                  className="px-3.5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-red-200 shadow-sm"
                  title="يتم حذف المكرر فقط والإبقاء على واحد من المكرر"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  حذف المكرر فقط
                </button>
              </>
            )}
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="px-3.5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-red-200 shrink-0 shadow-sm"
                title="حذف الحسابات المحددة"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                {showDuplicatesOnly ? `حذف المكرر الذي تم اختياره (${selectedIds.size})` : `حذف المحدد (${selectedIds.size})`}
              </button>
            )}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                placeholder="ابحث بالاسم، الرقم التسلسلي، أو المدرسة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 shrink-0">تصفية الصفة:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterRole('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterRole === 'all' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({schoolRoster.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('student')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterRole === 'student' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الطلاب ({schoolRoster.filter((r) => r.role === 'student').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('teacher')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterRole === 'teacher' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                المعلمون ({schoolRoster.filter((r) => r.role === 'teacher' || r.role === 'admin').length})
              </button>
            </div>

            {/* Grade & Section Filters */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
              <span className="text-xs font-bold text-slate-600 shrink-0">الصف:</span>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:border-indigo-600"
              >
                <option value="الكل">الكل</option>
                {['تمهيدي', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <span className="text-xs font-bold text-slate-600 shrink-0 mr-1">الشعبة:</span>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:border-indigo-600"
              >
                <option value="الكل">الكل</option>
                {['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ي'].map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Teacher Visibility Scope Banner */}
        <div className="p-3 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between text-xs font-bold text-indigo-950 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>
              قاعدة حصر المزامنة للمعلم: المدرسة (<strong>{currentSchoolName}</strong>) | الفرع (<strong>{currentBranch}</strong>) | الصف (<strong>{filterGrade}</strong>) | الشعبة (<strong>{filterSection}</strong>)
            </span>
          </div>
          <div className="text-indigo-800 text-[11px] bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-black shadow-2xs">
            عدد المقيدين المتطابقين: ({filteredRoster.length}) من أصل ({schoolRoster.length})
          </div>
        </div>

        {/* Roster Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
              <tr>
                <th className="p-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    checked={filteredRoster.length > 0 && selectedIds.size === filteredRoster.length}
                    onChange={toggleSelectAll}
                    title="تحديد الكل"
                  />
                </th>
                <th className="p-3.5">الاسم الكامل</th>
                <th className="p-3.5">الصفة</th>
                <th className="p-3.5">المدرسة والفرع</th>
                <th className="p-3.5">الصف والشعبة</th>
                <th className="p-3.5">الرقم التسلسلي (9 أرقام)</th>
                <th className="p-3.5">رقم الكود (7 أرقام)</th>
                <th className="p-3.5">الإيميل المربوط والمرجع</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-semibold">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                    لا توجد بيانات مطابقة حالياً. قم بجهة استيراد ملف Excel أو إضافة طلاب جدد.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((usr) => (
                  <tr key={usr.id} className={`transition-colors ${usr.isDuplicateReplaced ? 'bg-orange-50/70 hover:bg-orange-100' : 'hover:bg-slate-50/80'}`}>
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                        checked={selectedIds.has(usr.id)}
                        onChange={() => toggleSelect(usr.id)}
                      />
                    </td>
                    <td className="p-3.5 font-extrabold text-slate-900">{usr.name}</td>
                    <td className="p-3.5">
                      {usr.role === 'teacher' ? (
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg text-[10px] font-black border border-purple-200">
                          معلم
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-200">
                          طالب
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-700">
                      <div>{usr.schoolName}</div>
                      <div className="text-[10px] text-slate-400">الفرع: {usr.branch}</div>
                    </td>
                    <td className="p-3.5 text-slate-700">
                      <div>{usr.grade || '-'}</div>
                      <div className="text-[10px] text-slate-400">الشعبة: {usr.section || '-'}</div>
                    </td>
                    <td className="p-3.5 font-mono font-black text-indigo-700 tracking-wider">
                      {usr.serialNumber}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-amber-800 bg-amber-50/60 px-2 rounded-lg">
                      {usr.code}
                    </td>
                    <td className="p-3.5">
                      {usr.email ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px] text-indigo-900 font-bold dir-ltr text-right">{usr.email}</div>
                          {usr.public_ref_id && (
                            <div className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block font-mono">
                              {usr.public_ref_id}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">غير مربوط بأيميل بعد</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(usr.id, usr.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="حذف الحساب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              إضافة طالب / معلم جديد (مع توليد آلي للأرقام)
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="أدخل الاسم الرباعي..."
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الصفة</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as 'student' | 'teacher')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold"
                  >
                    <option value="student">طالب</option>
                    <option value="teacher">معلم</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المدرسة</label>
                  <input
                    type="text"
                    value={addSchool}
                    onChange={(e) => setAddSchool(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الفرع</label>
                  <input
                    type="text"
                    value={addBranch}
                    onChange={(e) => setAddBranch(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الصف</label>
                  <select
                    value={addGrade}
                    onChange={(e) => setAddGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-white"
                  >
                    {['تمهيدي', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الشعبة</label>
                  <select
                    value={addSection}
                    onChange={(e) => setAddSection(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 outline-none text-xs font-bold bg-white"
                  >
                    {['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ي'].map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 font-bold space-y-1">
                <div>• سيقوم النظام تلقائياً بتوليد:</div>
                <div>1. رقم تسلسلي فريد (9 أرقام).</div>
                <div>2. رقم كود سري (7 أرقام).</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-black rounded-xl text-xs shadow-md"
                >
                  حفظ الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Entry Cards Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col dir-rtl">
          <div className="bg-white w-full h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-2">
                <Printer className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900">معاينة بطاقات الدخول الرسمية (جاهزة للطباعة / PDF)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintCards}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  طباعة الآن
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<span class="animate-pulse">جاري التصدير...</span>';
                    btn.disabled = true;
                    try {
                      const html2canvas = (await import('html2canvas')).default;
                      const { jsPDF } = await import('jspdf');
                      const element = document.getElementById('pdf-export-container');
                      if (!element) return;
                      
                      const pages = Array.from(element.children) as HTMLElement[];
                      const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: 'a4'
                      });

                      for (let i = 0; i < pages.length; i++) {
                        const page = pages[i];
                        const canvas = await html2canvas(page, { 
                          scale: 2,
                          useCORS: true,
                          allowTaint: true,
                          backgroundColor: '#ffffff'
                        });
                        
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
                        if (i > 0) pdf.addPage();
                        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
                      }
                      
                      pdf.save('بطاقات_الدخول.pdf');
                    } finally {
                      btn.innerHTML = originalText;
                      btn.disabled = false;
                    }
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  تصدير بي دي اف
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 mr-2"
                  title="إغلاق"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Print Grid Layout */}
            <div className="flex-1 overflow-y-auto bg-slate-200 p-4 sm:p-8 flex justify-center">
              <div id="pdf-export-container" className="relative text-black" style={{ width: '210mm' }}>
                {Array.from({ length: Math.ceil(filteredRoster.length / 12) }).map((_, pageIndex) => {
                  const pageCards = filteredRoster.slice(pageIndex * 12, (pageIndex + 1) * 12);
                  return (
                    <div 
                      key={pageIndex} 
                      className="bg-white mx-auto relative mb-8" 
                      style={{ 
                        width: '210mm', 
                        height: '297mm', 
                        padding: '10mm', 
                        pageBreakAfter: 'always', 
                        boxSizing: 'border-box',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      {pageIndex === 0 && (
                        <PrintWatermark
                          schoolName="نظام المنظومة الرقمية للتقييم"
                          publicRefId="SECURE-OFFICIAL-STAMP"
                        />
                      )}
                      <div className="grid grid-cols-2 gap-2" style={{ alignContent: 'start' }}>
                        {pageCards.map((card) => (
                          <div
                            key={card.id}
                            className="p-2 bg-white text-black rounded-xl border border-slate-300 space-y-2 relative overflow-hidden flex flex-col"
                            style={{ height: '44mm' }}
                          >
                            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 bg-slate-100 text-slate-800 font-black text-[10px] rounded flex items-center justify-center border border-slate-200">
                                  R
                                </div>
                                <span className="text-[10px] font-black tracking-tight text-slate-800">
                                  بطاقة دخول المنظومة
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 text-[8px] font-extrabold rounded">
                                {card.role === 'teacher' ? 'معلم' : 'طالب'}
                              </span>
                            </div>

                            <div className="space-y-0.5 flex-1">
                              <h4 className="text-[13px] font-black text-slate-900 line-clamp-1">{card.name}</h4>
                              <p className="text-[9px] text-slate-600 font-bold line-clamp-1">
                                {card.schoolName} - {card.branch}
                              </p>
                              {card.grade && (
                                <p className="text-[8px] text-slate-500">
                                  الصف: {card.grade} | الشعبة: {card.section}
                                </p>
                              )}
                            </div>

                            <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-1.5 text-center text-xs mt-auto">
                              <div className="p-1 bg-slate-50 rounded border border-slate-100">
                                <span className="block text-[7px] text-slate-500 font-bold">الرقم التسلسلي</span>
                                <span className="font-mono font-black text-slate-900 text-[10px] tracking-wider">
                                  {card.serialNumber}
                                </span>
                              </div>

                              <div className="p-1 bg-slate-50 rounded border border-slate-100">
                                <span className="block text-[7px] text-slate-500 font-bold">رقم الكود</span>
                                <span className="font-mono font-black text-slate-900 text-[10px] tracking-wider">
                                  {card.code}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden dir-rtl">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 text-center mb-2">تأكيد الحذف</h3>
              <p className="text-sm text-slate-600 text-center mb-6">
                {deleteConfirmState.type === 'single'
                  ? `هل أنت متأكد من حذف الحساب الخاص بـ (${deleteConfirmState.name})؟ لا يمكن التراجع عن هذا الإجراء.`
                  : `هل أنت متأكد من حذف (${selectedIds.size}) حساب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all"
                >
                  نعم، حذف
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmState({ isOpen: false, type: 'multiple' })}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
