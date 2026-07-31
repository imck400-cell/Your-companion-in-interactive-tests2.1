import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldRoster = `  const loadRosterFromFirebase = async (schoolName?: string) => {
    if (!schoolName) return; // If no school, don't load all users globally
    const fbRoster = await fetchAllRosterUsers(schoolName);
    if (fbRoster && fbRoster.length > 0) {
      setRoster(fbRoster);
      localStorage.setItem('interactive_quiz_roster', JSON.stringify(fbRoster));
    }
  };`;

const newRoster = `  const loadRosterFromFirebase = async (schoolName?: string) => {
    if (!schoolName) return; // If no school, don't load all users globally
    const fbRoster = await fetchAllRosterUsers(schoolName);
    if (fbRoster && fbRoster.length > 0) {
      setRoster(fbRoster);
      localStorage.setItem('interactive_quiz_roster', JSON.stringify(fbRoster));
    } else {
      // If Firebase is empty but we have local roster, sync it up to Firebase
      const local = localStorage.getItem('interactive_quiz_roster');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && parsed.length > 0) {
            syncRosterToFirebase(parsed);
          }
        } catch(e) {}
      }
    }
  };`;

content = content.replace(oldRoster, newRoster);
fs.writeFileSync('src/App.tsx', content);
