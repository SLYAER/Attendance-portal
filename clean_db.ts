import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import fs from 'fs';

const fbConfigPath = './firebase-applet-config.json';
let config = {};
if (fs.existsSync(fbConfigPath)) {
  config = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
}

const app = initializeApp(config);
const dbId = (config as any).firestoreDatabaseId || 'ai-studio-dcea4153-5006-4a43-83bf-7eb50fb9c54a';
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, dbId);

async function run() {
  const atRef = collection(db, 'attendance');
  const snaps = await getDocs(atRef);
  
  const map = new Map();
  const toDelete = [];

  snaps.forEach(d => {
     const data = d.data();
     const key = data.userId + '_' + data.date;
     if (!map.has(key)) {
        map.set(key, d); 
     } else {
        const existing = map.get(key);
        if (!existing.data().clockOut && data.clockOut) {
           toDelete.push(existing.id);
           map.set(key, d);
        } else {
           toDelete.push(d.id);
        }
     }
  });

  console.log(`Found ${toDelete.length} duplicates to delete.`);
  for (const id of toDelete) {
     console.log('Deleting', id);
     await deleteDoc(doc(db, 'attendance', id));
  }
  process.exit(0);
}
run();
