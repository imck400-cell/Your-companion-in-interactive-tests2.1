export const normalizeDigits = (str: string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  return str.replace(/[٠-٩]/g, (w) => arabicDigits.indexOf(w).toString())
            .replace(/[۰-۹]/g, (w) => persianDigits.indexOf(w).toString());
};

export const generateDeterministicUserId = (name: string, grade: string, section: string, schoolName?: string, branch?: string): string => {
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '_');
  const normalizedGrade = grade.trim().toLowerCase().replace(/\s+/g, '_');
  const normalizedSection = section.trim().toLowerCase().replace(/\s+/g, '_');
  const normSchool = schoolName ? schoolName.trim().toLowerCase().replace(/\s+/g, '_') : 'unknown';
  const normBranch = branch ? branch.trim().toLowerCase().replace(/\s+/g, '_') : 'unknown';
  
  return `${normSchool}_${normBranch}_${normalizedGrade}_${normalizedSection}_${normalizedName}`;
};
