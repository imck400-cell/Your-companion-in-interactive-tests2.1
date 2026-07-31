import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const useEff = `  useEffect(() => {
    loadQuizzes();
    loadSubmissions();
    loadRosterFromFirebase();

    // Load saved teacher profile
    const savedProfileStr = localStorage.getItem('interactive_quiz_teacher_profile');
    if (savedProfileStr) {
      try {
        const prof = JSON.parse(savedProfileStr) as TeacherProfile;
        setTeacherProfile(prof);
        updateQuizMetaFromProfile(prof);
      } catch (e) {
        console.error('Failed to parse teacher profile', e);
      }
    }

    // Check if student arrived via direct link ?quizId=... or ?mode=student`;

const replaceUseEff = `  useEffect(() => {
    loadQuizzes();
    loadSubmissions();

    // Load saved teacher profile
    let currentSchool = '';
    const savedProfileStr = localStorage.getItem('interactive_quiz_teacher_profile');
    if (savedProfileStr) {
      try {
        const prof = JSON.parse(savedProfileStr) as TeacherProfile;
        setTeacherProfile(prof);
        currentSchool = prof.schoolName;
        updateQuizMetaFromProfile(prof);
      } catch (e) {
        console.error('Failed to parse teacher profile', e);
      }
    }

    loadRosterFromFirebase(currentSchool);

    // Check if student arrived via direct link ?quizId=... or ?mode=student`;

content = content.replace(useEff, replaceUseEff);

const loadRosterFunc = `  const loadRosterFromFirebase = async () => {
    const fbRoster = await fetchAllRosterUsers();
    if (fbRoster && fbRoster.length > 0) {
      setRoster(fbRoster);
      localStorage.setItem('interactive_quiz_roster', JSON.stringify(fbRoster));
    }
  };`;

const replaceLoadRosterFunc = `  const loadRosterFromFirebase = async (schoolName?: string) => {
    if (!schoolName) return; // If no school, don't load all users globally
    const fbRoster = await fetchAllRosterUsers(schoolName);
    if (fbRoster && fbRoster.length > 0) {
      setRoster(fbRoster);
      localStorage.setItem('interactive_quiz_roster', JSON.stringify(fbRoster));
    }
  };`;

content = content.replace(loadRosterFunc, replaceLoadRosterFunc);

// Also update teacher login so it fetches the roster when they log in
const handleLoginSuccess = `  const handleLoginSuccess = (profile: TeacherProfile) => {
    setTeacherProfile(profile);
    localStorage.setItem('interactive_quiz_teacher_profile', JSON.stringify(profile));
    updateQuizMetaFromProfile(profile);
    setIsTeacherLoginModalOpen(false);
  };`;

const replaceHandleLoginSuccess = `  const handleLoginSuccess = (profile: TeacherProfile) => {
    setTeacherProfile(profile);
    localStorage.setItem('interactive_quiz_teacher_profile', JSON.stringify(profile));
    updateQuizMetaFromProfile(profile);
    setIsTeacherLoginModalOpen(false);
    loadRosterFromFirebase(profile.schoolName);
  };`;

content = content.replace(handleLoginSuccess, replaceHandleLoginSuccess);

fs.writeFileSync('src/App.tsx', content);
