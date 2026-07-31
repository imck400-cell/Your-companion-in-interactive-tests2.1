import fs from 'fs';
let content = fs.readFileSync('src/components/StudentPortal/StudentLoginForm.tsx', 'utf8');

const importAdd = `import { validateAndAcquireSessionForRosterUser } from '../../services/sessionManager';
import { verifyStudentLogin } from '../../services/firebase';`;

content = content.replace(`import { validateAndAcquireSessionForRosterUser } from '../../services/sessionManager';`, importAdd);

const effectStr = `  useEffect(() => {
    setSessionError(null);
    if (loginMode !== 'serial') return;

    const trimmedSerial = serialNumber.trim();
    const trimmedCode = code.trim();

    if (!trimmedSerial) {
      setMatchedUser(null);
      setMatchError(null);
      return;
    }

    // Search roster for live validation
    const found = roster.find(
      (u) =>
        u.serialNumber === trimmedSerial &&
        (!u.code || u.code === trimmedCode || !trimmedCode)
    );

    if (found) {
      if (trimmedCode && found.code !== trimmedCode) {
        setMatchedUser(null);
        setMatchError('رقم الكود غير صحيح لهذا الرقم التسلسلي.');
      } else {
        setMatchedUser(found);
        setMatchError(null);
        setName(found.name);
        setGrade(found.grade || quiz.grade || 'الصف العام');
        setSection(found.section || quiz.section || 'أ');
        setSchoolName(found.schoolName || quiz.schoolName || '');
        setBranch(found.branch || quiz.branch || 'عام');
      }
    } else {
      setMatchedUser(null);
      if (trimmedCode && trimmedCode.length >= 4) {
         setMatchError('الرقم التسلسلي أو الكود غير صحيح، أو غير مسجل في النظام.');
      } else {
         setMatchError(null);
      }
    }
  }, [serialNumber, code, roster, quiz]);`;

const effectReplace = `  useEffect(() => {
    setSessionError(null);
    if (loginMode !== 'serial') return;

    const trimmedSerial = serialNumber.trim();
    const trimmedCode = code.trim();

    if (!trimmedSerial) {
      setMatchedUser(null);
      setMatchError(null);
      return;
    }

    let isSubscribed = true;

    const validateUser = async () => {
      // 1. Try local roster first
      let found = roster.find(
        (u) =>
          u.serialNumber === trimmedSerial &&
          (!u.code || u.code === trimmedCode || !trimmedCode)
      );

      // 2. If not found locally, and code is present, try Firebase
      if (!found && trimmedCode && trimmedCode.length >= 4) {
         const fbUser = await verifyStudentLogin(trimmedSerial, trimmedCode);
         if (fbUser) found = fbUser;
      }

      if (!isSubscribed) return;

      if (found) {
        if (trimmedCode && found.code !== trimmedCode) {
          setMatchedUser(null);
          setMatchError('رقم الكود غير صحيح لهذا الرقم التسلسلي.');
        } else {
          setMatchedUser(found);
          setMatchError(null);
          setName(found.name);
          setGrade(found.grade || quiz.grade || 'الصف العام');
          setSection(found.section || quiz.section || 'أ');
          setSchoolName(found.schoolName || quiz.schoolName || '');
          setBranch(found.branch || quiz.branch || 'عام');
        }
      } else {
        setMatchedUser(null);
        if (trimmedCode && trimmedCode.length >= 4) {
           setMatchError('الرقم التسلسلي أو الكود غير صحيح، أو غير مسجل في النظام.');
        } else {
           setMatchError(null);
        }
      }
    };
    
    validateUser();

    return () => {
      isSubscribed = false;
    };
  }, [serialNumber, code, roster, quiz]);`;

content = content.replace(effectStr, effectReplace);
fs.writeFileSync('src/components/StudentPortal/StudentLoginForm.tsx', content);
