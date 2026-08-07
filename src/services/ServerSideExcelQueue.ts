import * as XLSX from 'xlsx';
import { RosterUser } from '../types';
import { normalizeDigits, generateDeterministicUserId } from '../utils/helpers';

export interface BackgroundQueueJob {
  id: string;
  jobName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'partially_failed';
  progress: number; // 0 - 100
  totalRows: number;
  processedRows: number;
  successfulSchools: string[];
  rolledBackSchools: Array<{ schoolName: string; reason: string }>;
  createdAt: string;
  completedAt?: string;
}

/**
 * Server-Side Big Data Excel Export & Queue Job Handler (Laravel Queues & Maatwebsite/Excel)
 */

// Simulated Eager Loading query function preventing N+1 queries
export async function eagerLoadRosterWithRelations(roster: RosterUser[]): Promise<any[]> {
  // Simulating eager loading RosterUser::with(['school', 'branch', 'permissions'])
  return roster.map((usr) => ({
    ...usr,
    // Eager loaded relation attributes
    school_relation: { name: usr.schoolName || 'المدرسة العامة', code: 'SCH-101' },
    branch_relation: { name: usr.branch || 'الفرع الرئيسي', code: 'BR-01' },
    permissions_formula: `=IF(C${usr.id}="معلم", "صلاحيات كاملة للمعلم", "صلاحيات طالب - حل الاختبارات")`,
  }));
}

/**
 * Server-Side RTL Excel Export with Data Validation Dropdowns and IF Formulas
 */
export function generateServerSideExcelExport(
  roster: RosterUser[],
  filename: string = 'تقرير_الطلاب_والمعلمين_السيرفر.xlsx'
) {
  // 1. Map rows with Eager Loaded structure and Excel IF Formula in column "الصلاحيات"
  const exportRows = roster.map((u, idx) => {
    const rowNum = idx + 2; // Excel header is row 1
    return {
      'الرقم التسلسلي': u.serialNumber,
      'اسم المستخدم': u.name,
      'الصفة': u.role === 'teacher' ? 'معلم' : 'طالب',
      'المدرسة (School)': u.schoolName || 'مدرسة الفاروق النموذجية',
      'الفرع (Branch)': u.branch || 'عام',
      'الصف الدراسي': u.grade || 'الثالث الثانوي',
      'الشعبة': u.section || 'أ',
      'الكود التسلسلي': u.code,
      'الصلاحيات (Formula)': `=IF(C${rowNum}="معلم", "صلاحيات كاملة للمعلم", "صلاحيات طالب - حل الاختبارات")`,
      'حالة الحساب': 'نشط',
    };
  });

  // 2. Create Sheet
  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Set Right-to-Left (RTL) view property for Arabic Excel support
  if (!worksheet['!views']) {
    worksheet['!views'] = [];
  }
  worksheet['!views'].push({ RTL: true });

  // 3. Set Column widths for clean layout
  worksheet['!cols'] = [
    { wch: 16 }, // Serial
    { wch: 25 }, // Name
    { wch: 12 }, // Role
    { wch: 28 }, // School
    { wch: 15 }, // Branch
    { wch: 18 }, // Grade
    { wch: 10 }, // Section
    { wch: 14 }, // Code
    { wch: 35 }, // Permissions Formula
    { wch: 12 }, // Status
  ];

  // 4. Build Workbook & Append
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'بيانات السيرفر');

  // Download Server Generated Excel File
  XLSX.writeFile(workbook, filename);
}

/**
 * Process Background Queue Job with DB::transaction isolation per school
 */
export function dispatchServerImportQueueJob(
  rawRows: any[],
  currentRoster: RosterUser[],
  allowImportDuplicates: boolean,
  onProgress: (job: BackgroundQueueJob) => void,
  onComplete: (newUsers: RosterUser[], job: BackgroundQueueJob) => void
) {
  const jobId = `job-queue-${Date.now()}`;
  const totalRows = rawRows.length;

  const jobState: BackgroundQueueJob = {
    id: jobId,
    jobName: 'ProcessRosterImportJob (Maatwebsite/Excel)',
    status: 'processing',
    progress: 5,
    totalRows,
    processedRows: 0,
    successfulSchools: [],
    rolledBackSchools: [],
    createdAt: new Date().toLocaleTimeString('ar-EG'),
  };

  onProgress({ ...jobState });

  // Group rows by school name to simulate DB::transaction per school
  const schoolGroups: { [schoolName: string]: any[] } = {};
  rawRows.forEach((row) => {
    const school = String(row['المدرسة'] || row['اسم المدرسة'] || row['School'] || 'مدرسة فاروق العامة').trim();
    if (!schoolGroups[school]) schoolGroups[school] = [];
    schoolGroups[school].push(row);
  });

  const schools = Object.keys(schoolGroups);
  const newlyCreatedUsers: RosterUser[] = [];
  const existingSerials = new Set<string>(currentRoster.map((u) => u.serialNumber));
  const existingCodes = new Set<string>(currentRoster.map((u) => u.code));

  let currentSchoolIndex = 0;

  const interval = setInterval(() => {
    if (currentSchoolIndex >= schools.length) {
      clearInterval(interval);
      jobState.status = jobState.rolledBackSchools.length > 0 ? 'partially_failed' : 'completed';
      jobState.progress = 100;
      jobState.processedRows = totalRows;
      jobState.completedAt = new Date().toLocaleTimeString('ar-EG');

      onProgress({ ...jobState });
      onComplete(newlyCreatedUsers, { ...jobState });
      return;
    }

    const schoolName = schools[currentSchoolIndex];
    const schoolRows = schoolGroups[schoolName];

    // DB::transaction Simulation per School Block
    let schoolTransactionSuccess = true;
    let rollbackReason = '';
    const tempSchoolUsers: RosterUser[] = [];

    for (let i = 0; i < schoolRows.length; i++) {
      const row = schoolRows[i];
      const name = String(row['الاسم'] || row['اسم الطالب'] || row['Name'] || '').trim();

      // Check validation error -> triggers DB::rollBack() for this school only
      if (!name) {
        schoolTransactionSuccess = false;
        rollbackReason = `خطأ في بيانات المدرسة (${schoolName}): تم اكتشاف اسم مفقود في الصف رقم ${i + 1}. تم تنفيذ Rollback لهذه المدرسة فقط.`;
        break;
      }

      // Check for name duplicates
      const nameExists = currentRoster.some(u => u.name.trim() === name) || tempSchoolUsers.some(u => u.name.trim() === name);
      if (!allowImportDuplicates && nameExists) {
        continue; // skip this row
      }

      const branch = String(row['الفرع'] || row['Branch'] || 'عام').trim();
      const grade = String(row['الصف'] || row['Grade'] || 'الثالث الثانوي').trim();
      const section = String(row['الشعبة'] || row['Section'] || 'أ').trim();
      const rawRole = String(row['الصفة'] || row['Role'] || '').trim().toLowerCase();
      const role: 'student' | 'teacher' = rawRole.includes('معلم') || rawRole.includes('teacher') ? 'teacher' : 'student';

      let serial = normalizeDigits(String(row['الرقم التسلسلي'] || row['Serial'] || row['الرقم_التسلسلي'] || '').trim());
      let code = normalizeDigits(String(row['الكود'] || row['رقم الكود'] || row['Code'] || '').trim());
      
      let isDuplicate = false;
      
      if (serial && existingSerials.has(serial)) {
        isDuplicate = true;
      }
      if (code && existingCodes.has(code)) {
        isDuplicate = true;
      }

      if (isDuplicate || !serial) {
        let newSerial = normalizeDigits(String(Math.floor(100000000 + Math.random() * 900000000)));
        while (existingSerials.has(newSerial)) {
          newSerial = normalizeDigits(String(Math.floor(100000000 + Math.random() * 900000000)));
        }
        serial = newSerial;
      }
      
      if (isDuplicate || !code || code.length < 4) {
        let newCode = normalizeDigits(String(Math.floor(1000000 + Math.random() * 9000000)));
        while (existingCodes.has(newCode)) {
          newCode = normalizeDigits(String(Math.floor(1000000 + Math.random() * 9000000)));
        }
        code = newCode;
      }

      existingSerials.add(serial);
      existingCodes.add(code);

      tempSchoolUsers.push({
        id: generateDeterministicUserId(schoolName, serial),
        name,
        role,
        schoolName,
        branch,
        grade,
        section,
        serialNumber: serial,
        code,
        createdAt: new Date().toISOString(),
        isDuplicateReplaced: isDuplicate,
      });
    }

    if (schoolTransactionSuccess) {
      // DB::commit() for this school
      newlyCreatedUsers.push(...tempSchoolUsers);
      jobState.successfulSchools.push(schoolName);
    } else {
      // DB::rollBack() for this school only
      jobState.rolledBackSchools.push({ schoolName, reason: rollbackReason });
    }

    jobState.processedRows += schoolRows.length;
    jobState.progress = Math.min(95, Math.round((jobState.processedRows / totalRows) * 100));
    onProgress({ ...jobState });

    currentSchoolIndex++;
  }, 400);
}
