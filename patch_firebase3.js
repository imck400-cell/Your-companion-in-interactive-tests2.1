import fs from 'fs';
let content = fs.readFileSync('src/services/firebase.ts', 'utf8');

const importTarget = `import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';`;

const importReplace = `import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';`;
content = content.replace(importTarget, importReplace);

const addDeleteFunc = `
export async function deleteRosterUserFromFirebase(userId: string): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const docRef = doc(db, 'roster_users', userId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete roster user from Firebase', err);
  }
}
`;

content = content.replace(`export async function fetchAllRosterUsers(`, addDeleteFunc + `\nexport async function fetchAllRosterUsers(`);
fs.writeFileSync('src/services/firebase.ts', content);
