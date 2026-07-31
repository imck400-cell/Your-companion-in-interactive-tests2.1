import { initializeApp } from 'firebase/app';
import { getFirestore, clearIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { readFile } from 'fs/promises';

const firebaseConfig = JSON.parse(await readFile('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

clearIndexedDbPersistence(db).then(() => {
  console.log("Cleared!");
  return enableMultiTabIndexedDbPersistence(db);
}).then(() => {
  console.log("Enabled!");
  process.exit(0);
}).catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
