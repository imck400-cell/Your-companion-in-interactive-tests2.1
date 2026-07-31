import fs from 'fs';
let content = fs.readFileSync('src/services/firebase.ts', 'utf8');

const fetchRoster = `export async function fetchAllRosterUsers(): Promise<RosterUser[]> {
  const users: RosterUser[] = [];
  if (navigator.onLine) {
    try {
      const col = collection(db, 'roster_users');
      const snap = await getDocs(col);
      snap.forEach((doc) => {
        users.push(doc.data() as RosterUser);
      });
    } catch (err) {
      console.warn('Could not fetch roster from Firestore:', err);
    }
  }
  return users;
}`;

const replaceFetchRoster = `export async function fetchAllRosterUsers(schoolName?: string): Promise<RosterUser[]> {
  const users: RosterUser[] = [];
  if (navigator.onLine) {
    try {
      const col = collection(db, 'roster_users');
      let q = query(col);
      if (schoolName) {
        q = query(col, where('schoolName', '==', schoolName));
      }
      const snap = await getDocs(q);
      snap.forEach((doc) => {
        users.push(doc.data() as RosterUser);
      });
    } catch (err) {
      console.warn('Could not fetch roster from Firestore:', err);
    }
  }
  return users;
}

export async function verifyStudentLogin(serialNumber: string, code: string): Promise<RosterUser | null> {
  if (navigator.onLine) {
    try {
      const col = collection(db, 'roster_users');
      const q = query(col, where('serialNumber', '==', serialNumber), where('code', '==', code));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as RosterUser;
      }
    } catch (err) {
      console.warn('Failed to verify login via Firestore:', err);
    }
  }
  return null;
}
`;

content = content.replace(fetchRoster, replaceFetchRoster);
fs.writeFileSync('src/services/firebase.ts', content);
