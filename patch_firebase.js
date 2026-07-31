import fs from 'fs';

let content = fs.readFileSync('src/services/firebase.ts', 'utf8');

const saveSubmissionFunc = `export async function saveSubmission(`;

const newFunctions = `
// Fetch all roster users from Firestore
export async function fetchAllRosterUsers(): Promise<RosterUser[]> {
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
}

// Sync the entire roster list to Firestore
export async function syncRosterToFirebase(roster: RosterUser[]): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const col = collection(db, 'roster_users');
    
    // In a real large-scale app, we might want to do batch writes or only update changes.
    // For simplicity, we just save each user, or we can assume it's done via a batch.
    // Since Firebase batch has a limit of 500, we can write in chunks.
    
    const chunks = [];
    let currentChunk = [];
    for (const u of roster) {
      currentChunk.push(u);
      if (currentChunk.length >= 400) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);
    
    for (const chunk of chunks) {
      const promises = chunk.map(u => {
        const docRef = doc(col, u.id);
        return setDoc(docRef, cleanForFirestore(u));
      });
      await Promise.all(promises);
    }
    
  } catch (err) {
    console.error('Failed to sync roster to Firebase', err);
  }
}
`;

if (!content.includes('fetchAllRosterUsers')) {
  // we also need to import RosterUser if it's not imported
  if (!content.includes('RosterUser')) {
     content = content.replace('QuizMetadata, Submission } from', 'QuizMetadata, Submission, RosterUser } from');
  }
  content = content.replace(saveSubmissionFunc, newFunctions + '\n' + saveSubmissionFunc);
  fs.writeFileSync('src/services/firebase.ts', content);
}
