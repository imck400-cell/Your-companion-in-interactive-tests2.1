const fs = require('fs');
let content = fs.readFileSync('src/components/TeacherDashboard/RosterManager.tsx', 'utf8');

const targetStr = `
        const existingSerials = new Set<string>(roster.map((u) => u.serialNumber));
        const newUsers: RosterUser[] = [];
        let skippedEmptyRows = 0;

        rawRows.forEach((row, index) => {
`;

const replaceStr = `
        const existingSerials = new Set<string>(roster.map((u) => u.serialNumber));
        const existingCodes = new Set<string>(roster.map((u) => u.code));
        const newUsers: RosterUser[] = [];
        let skippedEmptyRows = 0;
        let duplicateCount = 0;

        rawRows.forEach((row, index) => {
`;

content = content.replace(targetStr, replaceStr);

const targetStr2 = `
          let serialNumber = String(row['الرقم التسلسلي'] || row['الرقم_التسلسلي'] || row['Serial'] || '').trim();
          if (serialNumber) {
            if (existingSerials.has(serialNumber)) {
              throw new Error(\`خطأ قاطع: الرقم التسلسلي (\${serialNumber}) في الصف رقم \${index + 2} مكرر بالفعل مسبقاً في النظام.\`);
            }
            existingSerials.add(serialNumber);
          } else {
            serialNumber = generateUniqueSerialNumber(existingSerials);
          }

          let code = String(row['الكود'] || row['رقم الكود'] || row['Code'] || '').trim();
          if (!code || code.length < 4) {
            code = generate7DigitCode();
          }

          newUsers.push({
            id: \`usr-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
            name,
            role,
            schoolName,
            branch,
            grade,
            section,
            serialNumber,
            code,
            createdAt: new Date().toISOString(),
          });
`;

const replaceStr2 = `
          let serialNumber = String(row['الرقم التسلسلي'] || row['الرقم_التسلسلي'] || row['Serial'] || '').trim();
          let code = String(row['الكود'] || row['رقم الكود'] || row['Code'] || '').trim();
          
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
            code = newCode;
          }

          existingSerials.add(serialNumber);
          existingCodes.add(code);

          newUsers.push({
            id: \`usr-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
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
`;

content = content.replace(targetStr2, replaceStr2);

const targetStr3 = `
        setImportSuccess(
          \`تم استيراد (\${newUsers.length}) مستخدم بنجاح وتوليد الأرقام التسلسلية الفريدة وأكواد الدخول.\${
            skippedEmptyRows > 0 ? \` (تم تجاهل \${skippedEmptyRows} صف فارغ تلقائياً).\` : ''
          }\`
        );
`;

const replaceStr3 = `
        setImportSuccess(
          \`تم استيراد (\${newUsers.length}) مستخدم بنجاح.\${
            duplicateCount > 0 ? \` (تم تغيير الأرقام التسلسلية/الأكواد لـ \${duplicateCount} طالب/معلم بسبب تكرارها في النظام وتم تلوينها بالبرتقالي).\` : ''
          }\${
            skippedEmptyRows > 0 ? \` (تم تجاهل \${skippedEmptyRows} صف فارغ تلقائياً).\` : ''
          }\`
        );
`;

content = content.replace(targetStr3, replaceStr3);

fs.writeFileSync('src/components/TeacherDashboard/RosterManager.tsx', content);
