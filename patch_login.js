import fs from 'fs';
let content = fs.readFileSync('src/components/StudentPortal/StudentLoginForm.tsx', 'utf8');

const effectTarget = `  // Live Validation on input change for Serial & Code
  useEffect(() => {
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
      setMatchedUser(found);
      setName(found.name);
      setGrade(found.grade || quiz.grade || 'الصف العام');
      setSection(found.section || quiz.section || 'أ');
      setSchoolName(found.schoolName || quiz.schoolName || '');
      setBranch(found.branch || quiz.branch || '');
      if (found.email) setBindEmailInput(found.email);
      setMatchError(null);
    } else if (trimmedSerial.length >= 4 && trimmedCode.length >= 2) {
      setMatchedUser(null);
      setMatchError('جاري البحث... لم نجد طالباً ينطبق عليه الرقم التسلسلي والكود.');
    } else {
      setMatchedUser(null);
      setMatchError(null);
    }
  }, [serialNumber, code, roster, quiz, loginMode]);`;

const effectReplace = `  // Live Validation on input change for Serial & Code
  useEffect(() => {
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

      // 2. If not found locally, try Firebase (crucial for students on new devices)
      if (!found && trimmedSerial.length >= 4 && trimmedCode.length >= 4) {
        setMatchError('جاري التحقق عبر السحابة...');
        try {
          const fbUser = await verifyStudentLogin(trimmedSerial, trimmedCode);
          if (fbUser) found = fbUser;
        } catch (e) {
          console.error("Firebase auth error", e);
        }
      }

      if (!isSubscribed) return;

      if (found) {
        setMatchedUser(found);
        setName(found.name);
        setGrade(found.grade || quiz.grade || 'الصف العام');
        setSection(found.section || quiz.section || 'أ');
        setSchoolName(found.schoolName || quiz.schoolName || '');
        setBranch(found.branch || quiz.branch || '');
        if (found.email) setBindEmailInput(found.email);
        setMatchError(null);
      } else if (trimmedSerial.length >= 4 && trimmedCode.length >= 2) {
        setMatchedUser(null);
        setMatchError('لم نجد طالباً ينطبق عليه الرقم التسلسلي والكود.');
      } else {
        setMatchedUser(null);
        setMatchError(null);
      }
    };

    validateUser();

    return () => {
      isSubscribed = false;
    };
  }, [serialNumber, code, roster, quiz, loginMode]);`;

content = content.replace(effectTarget, effectReplace);

fs.writeFileSync('src/components/StudentPortal/StudentLoginForm.tsx', content);
