import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const handleUpdateSingleRosterUser = (updatedUser: RosterUser) => {
    const newRoster = roster.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
    syncRosterToFirebase(newRoster);
  };`;

const replace = `  const handleUpdateSingleRosterUser = (updatedUser: RosterUser) => {
    const exists = roster.some(u => u.id === updatedUser.id);
    const newRoster = exists 
      ? roster.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      : [...roster, updatedUser];
    
    setRoster(newRoster);
    localStorage.setItem('interactive_quiz_roster', JSON.stringify(newRoster));
    // When updating a single user, it's better to just sync that one user to Firebase, 
    // but our current func syncs the whole array which is fine.
    syncRosterToFirebase(newRoster);
  };`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
