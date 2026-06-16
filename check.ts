import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';

const config = {
  projectId: "adroit-scanner-5mvz5",
  appId: "1:566884289043:web:1ef680092ebfdbd3140de6",
  apiKey: "AIzaSyClSiuqT8L5ixypLXMCnvmODo3vz4zWXFw",
  authDomain: "adroit-scanner-5mvz5.firebaseapp.com",
};

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  console.log("Today string:", todayStr);
  const codeDoc = await getDoc(doc(db, 'daily_codes', todayStr));
  if (codeDoc.exists()) {
    console.log("Codes:", codeDoc.data());
  } else {
    console.log("No daily codes found for today");
    // Get all docs
    const snaps = await getDocs(collection(db, 'daily_codes'));
    snaps.forEach(d => console.log(d.id, d.data()));
  }
  process.exit(0);
}
run();
