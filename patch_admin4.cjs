const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const fetchSchoolsBtn = `
                <button
                  type="button"
                  onClick={() => loadSchoolsPage(false)}
                  disabled={isFetchingSchools}
                  className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <RefreshCw className={\`w-4 h-4 \${isFetchingSchools ? 'animate-spin' : ''}\`} />
                  <span>{isFetchingSchools ? 'جار الجلب...' : 'تحديث القائمة'}</span>
                </button>
`;

// Insert the button before the "إضافة مدرسة جديدة" button, which is somewhere below. 
// Let's just find the Export to Excel button.
const exportBtnRegex = /<button[\s\S]*?onClick=\{exportSchoolsToExcel\}[\s\S]*?تصدير التراخيص لـ Excel[\s\S]*?<\/button>/;
code = code.replace(exportBtnRegex, fetchSchoolsBtn + '\n$&');

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
