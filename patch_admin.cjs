const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const regex = /\/\/ Sync schools with Firebase Firestore & localStorage\s*useEffect\(\(\) => \{[\s\S]*?unsubSchools\(\);\s*};\s*\}, \[\]\);/m;
code = code.replace(regex, `// Phase 1: Disabled Auto-Fetch on Mount for Schools. Using Pagination.`);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
