import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const loadRosterFromFirebase = async (schoolName?: string) => {
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

const replace = `  const loadRosterFromFirebase = async (schoolName?: string) => {
    if (!schoolName) return; // If no school, don't load all users globally
    const fbRoster = await fetchAllRosterUsers(schoolName);
    
    let localRoster = [];
    try {
      const local = localStorage.getItem('interactive_quiz_roster');
      if (local) localRoster = JSON.parse(local);
    } catch(e) {}

    if (fbRoster && fbRoster.length > 0) {
      // Merge logic: If local has more items or items not in Firebase, we should sync them up.
      // A simple approach: combine both and sync up the difference if needed.
      const mergedMap = new Map();
      fbRoster.forEach(u => mergedMap.set(u.id, u));
      let needsSync = false;
      
      localRoster.forEach(u => {
        if (!mergedMap.has(u.id)) {
          mergedMap.set(u.id, u);
          needsSync = true;
        }
      });
      
      const merged = Array.from(mergedMap.values());
      setRoster(merged);
      localStorage.setItem('interactive_quiz_roster', JSON.stringify(merged));
      
      if (needsSync) {
        syncRosterToFirebase(merged);
      }
    } else {
      // If Firebase is empty but we have local roster, sync it up to Firebase
      if (localRoster && localRoster.length > 0) {
        syncRosterToFirebase(localRoster);
        setRoster(localRoster);
      }
    }
  };`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
