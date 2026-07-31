const fs = require('fs');
let content = fs.readFileSync('src/services/ServerSideExcelQueue.ts', 'utf8');

const targetStr = `
  const existingSerials = new Set<string>(currentRoster.map((u) => u.serialNumber));
  let currentSchoolIndex = 0;
`;

const replaceStr = `
  const existingSerials = new Set<string>(currentRoster.map((u) => u.serialNumber));
  const existingCodes = new Set<string>(currentRoster.map((u) => u.code));
  let currentSchoolIndex = 0;
`;
content = content.replace(targetStr, replaceStr);

const targetStr2 = `
      let serial = String(row['الرقم التسلسلي'] || row['Serial'] || '').trim();
      if (!serial || serial.length < 5) {
        serial = String(Math.floor(100000000 + Math.random() * 900000000));
      }

      if (existingSerials.has(serial)) {
        schoolTransactionSuccess = false;
        rollbackReason = \`خطأ مكرر (Duplicate Key) في المدرسة (\${schoolName}): الرقم التسلسلي (\${serial}) موجود بالفعل. تم تنفيذ DB::rollBack().\`;
        break;
      }

      existingSerials.add(serial);

      tempSchoolUsers.push({
        id: \`usr-job-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
        name,
        role,
        schoolName,
        branch,
        grade,
        section,
        serialNumber: serial,
        code: String(Math.floor(1000000 + Math.random() * 9000000)),
        createdAt: new Date().toISOString(),
      });
`;

const replaceStr2 = `
      let serial = String(row['الرقم التسلسلي'] || row['Serial'] || row['الرقم_التسلسلي'] || '').trim();
      let code = String(row['الكود'] || row['رقم الكود'] || row['Code'] || '').trim();
      
      let isDuplicate = false;
      
      if (serial && existingSerials.has(serial)) {
        isDuplicate = true;
      }
      if (code && existingCodes.has(code)) {
        isDuplicate = true;
      }

      if (isDuplicate || !serial) {
        let newSerial = String(Math.floor(100000000 + Math.random() * 900000000));
        while (existingSerials.has(newSerial)) {
          newSerial = String(Math.floor(100000000 + Math.random() * 900000000));
        }
        serial = newSerial;
      }
      
      if (isDuplicate || !code || code.length < 4) {
        let newCode = String(Math.floor(1000000 + Math.random() * 9000000));
        while (existingCodes.has(newCode)) {
          newCode = String(Math.floor(1000000 + Math.random() * 9000000));
        }
        code = newCode;
      }

      existingSerials.add(serial);
      existingCodes.add(code);

      tempSchoolUsers.push({
        id: \`usr-job-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
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
`;
content = content.replace(targetStr2, replaceStr2);
fs.writeFileSync('src/services/ServerSideExcelQueue.ts', content);
