import { collection, query, where, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { format } from 'date-fns';

let sweepRunning = false;
let sweepLastRunDate = '';

export const runGlobalAttendanceSweep = async () => {
  const now = new Date();
  const dateStr = format(now, 'yyyy-MM-dd');

  // Only run if it's 9 PM or later, and only run once per session/day
  if (now.getHours() < 21) return;
  if (sweepRunning || sweepLastRunDate === dateStr) return;

  sweepRunning = true;

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const attendanceRef = collection(db, 'attendance');

    const sweepPromises = usersSnap.docs.map(async (userDoc) => {
      const uId = userDoc.id;
      const uName = userDoc.data().name || 'Employee';

      const recsSnap = await getDocs(query(attendanceRef, where('userId', '==', uId), where('date', '==', dateStr)));
      
      if (recsSnap.empty) {
        // Did not clock in today. Mark absent.
        const newDocRef = doc(attendanceRef);
        await setDoc(newDocRef, {
          userId: uId,
          employeeName: uName,
          date: dateStr,
          status: 'absent'
        });
      } else {
        const recDoc = recsSnap.docs[0];
        const data = recDoc.data();
        // If clocked in but not clocked out
        if (data.clockIn && !data.clockOut && data.status !== 'absent') {
          const forceTime = new Date();
          forceTime.setHours(21, 0, 0, 0); // At 9:00 PM
          await updateDoc(recDoc.ref, {
             clockOut: forceTime.toISOString()
          });
        }
      }
    });

    await Promise.all(sweepPromises);
    sweepLastRunDate = dateStr;
  } catch (error) {
    console.error('Failed to run global attendance sweep:', error);
  } finally {
    sweepRunning = false;
  }
};

export const startAttendanceSweepInterval = () => {
  // Check immediately
  runGlobalAttendanceSweep();
  // Check every 5 minutes
  return setInterval(runGlobalAttendanceSweep, 5 * 60 * 1000);
};
