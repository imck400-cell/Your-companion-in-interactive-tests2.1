import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  "import { fetchAllQuizzes, fetchQuizById, saveQuiz, fetchAllSubmissions } from './services/firebase';",
  "import { fetchAllQuizzes, fetchQuizById, saveQuiz, fetchAllSubmissions, fetchAllRosterUsers, syncRosterToFirebase } from './services/firebase';"
);

const handleUpdateRoster = `  const handleUpdateRoster = (newRoster: RosterUser[]) => {
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
  };`;
const handleUpdateRosterReplace = `  const handleUpdateRoster = (newRoster: RosterUser[]) => {
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
    syncRosterToFirebase(newRoster);
  };`;

content = content.replace(handleUpdateRoster, handleUpdateRosterReplace);

const handleUpdateSingleRosterUser = `  const handleUpdateSingleRosterUser = (updatedUser: RosterUser) => {
    const newRoster = roster.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
  };`;
const handleUpdateSingleRosterUserReplace = `  const handleUpdateSingleRosterUser = (updatedUser: RosterUser) => {
    const newRoster = roster.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
    syncRosterToFirebase(newRoster);
  };`;

content = content.replace(handleUpdateSingleRosterUser, handleUpdateSingleRosterUserReplace);

const useEff = `  useEffect(() => {
    loadQuizzes();
    loadSubmissions();

    // Load saved teacher profile`;

const useEffReplace = `  useEffect(() => {
    loadQuizzes();
    loadSubmissions();
    loadRosterFromFirebase();

    // Load saved teacher profile`;

content = content.replace(useEff, useEffReplace);

const loadRosterFunc = `
  const loadRosterFromFirebase = async () => {
    const fbRoster = await fetchAllRosterUsers();
    if (fbRoster && fbRoster.length > 0) {
      setRoster(fbRoster);
      localStorage.setItem('interactive_quiz_roster', JSON.stringify(fbRoster));
    }
  };
`;

content = content.replace("  const loadSubmissions = async () => {", loadRosterFunc + "\n  const loadSubmissions = async () => {");

fs.writeFileSync('src/App.tsx', content);
