import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId || 'ai-studio-dcea4153-5006-4a43-83bf-7eb50fb9c54a';
export const db = getFirestore(app, dbId);
export const auth = getAuth(app);
