import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { format } from 'date-fns';
import fs from 'fs';

const fbConfigPath = './firebase-applet-config.json';
let config = {};
if (fs.existsSync(fbConfigPath)) {
  const cfg = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
  config = cfg.firebase;
}

const app = initializeApp(config);
const dbId = (config as any).firestoreDatabaseId || 'ai-studio-dcea4153-5006-4a43-83bf-7eb50fb9c54a';
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, dbId);

async function run() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  console.log("Today string:", todayStr);
  const codeDoc = await getDoc(doc(db, 'daily_codes', todayStr));
  if (codeDoc.exists()) {
    console.log("Daily codes:", codeDoc.data());
  } else {
    console.log("No daily codes found for today");
  }

  console.log('--- Users ---');
  const uSnap = await getDocs(collection(db, 'users'));
  uSnap.forEach(d => console.log(d.id, d.data().name, d.data().password));
  
  process.exit(0);
}
run();
