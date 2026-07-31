const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// Replace {schools.length} with {totalSchoolsCount ?? 0}
code = code.replace(/\{schools\.length\}/g, '{totalSchoolsCount ?? schools.length}');

// Same for users
code = code.replace(/\{localRoster\.length\}/g, '{totalUsersCount ?? localRoster.length}');

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
