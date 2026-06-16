import React, { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, orderBy, limit, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { AttendanceRecord, OperationType } from '../types';
import { handleFirestoreError } from '../lib/errorUtils';
import { LogOut, Clock, CalendarDays, CheckCircle2, ShieldAlert, User } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import CameraModal from './CameraModal';

interface DashboardProps {
  isAdmin: boolean;
  onOpenAdmin: () => void;
  localUser: any;
  onLogoutLocal: () => void;
}

export default function Dashboard({ isAdmin, onOpenAdmin, localUser, onLogoutLocal }: DashboardProps) {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shopLocation, setShopLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [cameraMode, setCameraMode] = useState<'in' | 'out' | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmClockOut, setConfirmClockOut] = useState(false);

  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);

  const activeUserId = localUser?.uid || auth.currentUser?.uid;
  
  const salaryData = React.useMemo(() => {
    if (!userData?.monthlySalary) return null;
    
    const now = new Date();
    const startDateStr = userData.joinDate || userData.createdAt;
    const joinDateObj = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleDay = joinDateObj.getDate();
    
    let cycleStartObj = new Date(now.getFullYear(), now.getMonth(), cycleDay);
    if (now.getDate() < cycleDay) {
      cycleStartObj = new Date(now.getFullYear(), now.getMonth() - 1, cycleDay);
    }
    
    const cycleEndObj = new Date(cycleStartObj.getFullYear(), cycleStartObj.getMonth() + 1, cycleDay);
    const daysInCycle = Math.round((cycleEndObj.getTime() - cycleStartObj.getTime()) / (1000 * 60 * 60 * 24));
    
    const attendedDates = new Set();
    let absents = 0;
    
    allRecords.forEach(r => {
      const rDate = new Date(r.date);
      // We count all absents in the cycle (even if in future of cycle)
      if (rDate >= cycleStartObj && rDate < cycleEndObj) {
        if (r.status === 'absent') {
          absents += 1;
        } else if (r.status === 'half-day') {
          absents += 0.5;
          attendedDates.add(r.date);
        } else {
          attendedDates.add(r.date);
        }
      }
    });

    const elapsedMs = now.getTime() - cycleStartObj.getTime();
    let elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    if (elapsedDays < 0) elapsedDays = 0;
    
    const perDay = userData.monthlySalary / daysInCycle;
    const deductions = absents * perDay;
    const advance = userData.advanceTaken || 0;
    const remainingSalary = userData.monthlySalary - advance - deductions;

    return {
      monthlySalary: userData.monthlySalary,
      perDay: Math.round(perDay),
      daysInCycle,
      elapsed: elapsedDays,
      attended: attendedDates.size,
      absent: absents,
      advanceTaken: advance,
      remainingSalary: Math.round(remainingSalary),
      deductions: Math.round(deductions),
      cycleStart: format(cycleStartObj, 'MMM d'),
      cycleEnd: format(cycleEndObj, 'MMM d')
    };
  }, [userData, allRecords, activeUserId]);

  const cycleRecords = React.useMemo(() => {
    if (!userData) return [];

    const now = new Date();
    const startDateStr = userData.joinDate || userData.createdAt;
    const joinDateObj = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleDay = joinDateObj.getDate();
    
    let cycleStartObj = new Date(now.getFullYear(), now.getMonth(), cycleDay);
    if (now.getDate() < cycleDay) {
      cycleStartObj = new Date(now.getFullYear(), now.getMonth() - 1, cycleDay);
    }
    
    const cycleEndObj = new Date(cycleStartObj.getFullYear(), cycleStartObj.getMonth() + 1, cycleDay);

    return allRecords.filter(r => {
        const rDate = new Date(r.date);
        return rDate >= cycleStartObj && rDate < cycleEndObj;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [userData, allRecords]);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Request notification permission and schedule reminders
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const isClockedIn = !!todayRecord;
    const isClockedOut = isClockedIn && !!todayRecord.clockOut;

    const checkAndNotify = () => {
      if (!isClockedIn || isClockedOut) return;

      const now = new Date();
      const hour = now.getHours();
      const mins = now.getMinutes();

      // Notify between 8:45 PM and 8:59 PM
      if (hour === 20 && mins >= 45) {
        const todayStr = format(now, 'yyyy-MM-dd');
        if (localStorage.getItem('attendance_notified_last') !== todayStr) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Clock Out Reminder ⏰', {
              body: "It's almost 9:00 PM! Don't forget to clock out before you leave.",
            });
            localStorage.setItem('attendance_notified_last', todayStr);
          }
        }
      }
    };

    const timer = setInterval(checkAndNotify, 60000); // Check every minute
    checkAndNotify();

    return () => clearInterval(timer);
  }, [todayRecord]);

  // Real-time Firestore sync
  useEffect(() => {
    if (!activeUserId) return;

    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', activeUserId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });
      
      setAllRecords(records);
      setRecentRecords(records.slice(0, 7));
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayRec = records.find(r => r.date === today);
      setTodayRecord(todayRec || null);
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeUserId]);

  // Fetch shop config and user profile
  useEffect(() => {
    let unsubscribeUser: () => void;
    
    const fetchData = async () => {
      try {
        const docSnap = await getDocFromServer(doc(db, 'system', 'config'));
        if (docSnap.exists() && docSnap.data().shopLocation) {
          setShopLocation(docSnap.data().shopLocation);
        }
      } catch (err) {
        console.error("Failed to load shop config", err);
      }
    };
    fetchData();

    if (activeUserId) {
      unsubscribeUser = onSnapshot(doc(db, 'users', activeUserId), (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      }, (err) => {
        console.error("Failed to load user profile", err);
      });
    }
    
    return () => {
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [activeUserId]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const verifyLocation = (actionType: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setLocationError('');
      if (!shopLocation) {
        setLocationError("Shop locations is not set by admin. Please contact your manager.");
        resolve(false);
        return;
      }
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser.");
        resolve(false);
        return;
      }

      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setIsVerifyingLocation(false);
        const dist = calculateDistance(
          pos.coords.latitude, pos.coords.longitude,
          shopLocation.lat, shopLocation.lng
        );
        
        // Allow up to 100 meters radius
        if (dist <= 100) {
          resolve(true);
        } else {
          setLocationError(`You are too far from the shop (${Math.round(dist)} meters away). Please go to the shop to mark attendance.`);
          
          if (activeUserId) {
            try {
              await setDoc(doc(collection(db, 'failed_attempts')), {
                userId: activeUserId,
                employeeName: userData?.name || 'Employee',
                action: actionType,
                distanceMeters: Math.round(dist),
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              console.error("Failed to log attempt", e);
            }
          }
          
          resolve(false);
        }
      }, (err) => {
        setIsVerifyingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("You must allow location permissions to mark attendance.");
        } else {
          setLocationError("Failed to get your location. " + err.message);
        }
        resolve(false);
      }, { enableHighAccuracy: true });
    });
  };

  const processClockIn = async (photoBase64: string) => {
    setCameraMode(null);
    if (!activeUserId) return;

    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const isoStr = now.toISOString();

    // Check if already clocked in today to prevent duplicates
    try {
      const q = query(collection(db, 'attendance'), where('userId', '==', activeUserId), where('date', '==', dateStr));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setSuccessMessage('You are already clocked in for today!');
        setTimeout(() => setSuccessMessage(''), 3000);
        return;
      }
    } catch (e) {
      console.warn("Could not check duplicate clock-in", e);
    }
    
    // Generate an ID to construct a ref safely
    const newDocRef = doc(collection(db, 'attendance'));
    
    const record: AttendanceRecord = {
      userId: activeUserId,
      employeeName: userData?.name || 'Employee',
      date: dateStr,
      clockIn: isoStr,
      status: now.getHours() >= 13 ? 'half-day' : 'present',
    };
    if (photoBase64) {
      record.clockInPhoto = photoBase64;
    }


    try {
      setDoc(newDocRef, record).catch(error => {
        console.error('Offline setDoc error (deferred)', error);
      });
      setSuccessMessage('Clocked in successfully! (Saved locally, syncing in background)');
      setTimeout(() => {
        try { window.close(); } catch (e) {}
        if (localUser) {
          onLogoutLocal();
        } else {
          auth.signOut();
        }
      }, 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
    }
  };

  const processClockOut = async (photoBase64: string | undefined, skipLocation = false) => {
    setCameraMode(null);
    if (!todayRecord || !todayRecord.id) return;

    const now = new Date();
    const isoStr = now.toISOString();

    let finalStatus = todayRecord.status || 'present';
    if (now.getHours() < 14) {
      finalStatus = 'half-day';
    }

    const updateData: any = { clockOut: isoStr, status: finalStatus };
    if (photoBase64) {
      updateData.clockOutPhoto = photoBase64;
    }

    try {
      updateDoc(doc(db, 'attendance', todayRecord.id), updateData).catch(error => {
        console.error('Offline updateDoc error (deferred)', error);
      });
      if (!skipLocation) {
        setSuccessMessage('Clocked out successfully! (Saved locally, syncing in background)');
        setTimeout(() => {
          try { window.close(); } catch (e) {}
          if (localUser) {
            onLogoutLocal();
          } else {
            auth.signOut();
          }
        }, 2500);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `attendance/${todayRecord.id}`);
    }
  };

  const handleCapture = (photo: string) => {
    if (cameraMode === 'in') {
      processClockIn(photo);
    } else if (cameraMode === 'out') {
      processClockOut(photo);
    }
  };

  const isClockedIn = !!todayRecord;
  const isClockedOut = isClockedIn && !!todayRecord.clockOut;

  const handleSignOut = async () => {
    if (localUser) {
      onLogoutLocal();
    } else {
      auth.signOut();
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FFFCF0] text-[#A0AEC0] font-black tracking-widest text-xl uppercase">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FFFCF0] text-[#2D3436] font-sans flex flex-col overflow-x-hidden">
      <header className="h-20 sm:h-24 px-6 md:px-12 flex items-center justify-between bg-white border-b-4 border-[#F9D423]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FFFCF0] text-[#FF6B6B] rounded-[14px] flex items-center justify-center font-black text-sm border-2 border-[#FFEAA7] shadow-sm overflow-hidden flex-shrink-0">
            {userData?.photoBase64 ? (
              <img src={userData.photoBase64} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-[#A0AEC0]" />
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-[#2D3436] hidden sm:block">
            ATTENDANCE <span className="text-[#FF6B6B]">PORTAL</span>
          </h1>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-[#2D3436] sm:hidden">
            PORTAL
          </h1>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[#A0AEC0] font-bold text-xs sm:text-sm">{userData?.name || auth.currentUser?.email || activeUserId}</span>
          {userData?.phoneNumber && <span className="text-[#A0AEC0] font-bold text-[10px] sm:text-xs">{userData.phoneNumber}</span>}
          <div className="flex items-center gap-4 mt-1">
            {isAdmin && (
              <button onClick={onOpenAdmin} className="flex items-center gap-1 text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors">
                <ShieldAlert className="w-4 h-4" />
                ADMIN PANEL
              </button>
            )}
            <button onClick={handleSignOut} className="flex items-center gap-1 text-sm font-bold text-[#FF6B6B] hover:text-[#EE5253] transition-colors">
              <LogOut className="w-4 h-4" />
              EXIT
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 p-6 md:p-10">
        
        {/* Left Side: Action Zone */}
        <div className="md:col-span-7 flex flex-col gap-8 h-full">
          <div className="bg-white rounded-[40px] p-8 md:p-10 border-b-8 border-r-8 border-[#4ECDC4] flex flex-col h-full shadow-lg min-h-[400px]">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[#A0AEC0] mb-2">
                {format(currentTime, 'EEEE, MMM d, yyyy')}
              </p>
              <h2 className="text-4xl md:text-5xl font-black leading-tight mb-2 text-[#2D3436]">
                {format(currentTime, 'h:mm:ss a')}
              </h2>
              <p className="text-lg font-medium text-[#718096] mb-8">Ready for your shift? Tap below to record your attendance.</p>
              
              {locationError && (
                <div className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 font-bold text-sm">
                  {locationError}
                </div>
              )}
            </div>

            <div className="flex-grow"></div>

            <div className="flex justify-center w-full relative">
              {isVerifyingLocation && (
                <div className="absolute -top-10 font-bold text-sm text-[#A0AEC0] flex items-center gap-2 animate-pulse">
                  📍 Verifying your location...
                </div>
              )}
              {!isClockedIn ? (
                <button
                  onClick={() => processClockIn('')}
                  className="w-full py-6 sm:py-8 bg-[#FF6B6B] hover:bg-[#FF5252] text-white rounded-[32px] text-2xl sm:text-3xl font-black shadow-[0_8px_0_0_#EE5253] active:translate-y-1 active:shadow-none transition-all"
                >
                  CLOCK IN NOW
                </button>
              ) : !isClockedOut ? (
                <button
                  onClick={() => setConfirmClockOut(true)}
                  className="w-full py-6 sm:py-8 bg-[#F9D423] hover:bg-[#F1C40F] text-[#8B6E00] rounded-[32px] text-2xl sm:text-3xl font-black shadow-[0_8px_0_0_#D4AC0D] active:translate-y-1 active:shadow-none transition-all"
                >
                  CLOCK OUT
                </button>
              ) : (
                <div className="flex items-center justify-center gap-3 text-[#2D3436] font-black text-xl py-6 sm:py-8 bg-[#4ECDC4] border-4 border-[#26C6DA] rounded-[32px] w-full text-white">
                  <CheckCircle2 className="w-8 h-8" />
                  DONE FOR TODAY
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Status/Logs */}
        <div className="md:col-span-5 flex flex-col gap-6">
          {salaryData && (
            <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#4ECDC4] shadow-lg">
              <h3 className="text-xl font-black uppercase tracking-wider text-[#2D3436] mb-6 flex items-center gap-2">
                💰 Salary Status
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-[#F0FFF4] p-4 rounded-2xl border-2 border-[#4ECDC4]/20">
                  <span className="font-bold text-[#A0AEC0]">Remaining Salary</span>
                  <span className="text-3xl font-black text-[#4ECDC4]">₹{salaryData.remainingSalary.toLocaleString()}</span>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  <div className="bg-gray-50 p-3 rounded-2xl border-2 border-gray-100 flex flex-col justify-center items-center text-center">
                    <span className="block text-[9px] font-black uppercase text-[#A0AEC0]">Monthly Base</span>
                    <span className="block text-[15px] font-black text-[#2D3436]">₹{salaryData.monthlySalary.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-2xl border-2 border-gray-100 flex flex-col justify-center items-center text-center">
                    <span className="block text-[9px] font-black uppercase text-[#A0AEC0]">Advance</span>
                    <span className="block text-[15px] font-black text-[#FFB020]">₹{salaryData.advanceTaken.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-2xl border-2 border-gray-100 flex flex-col justify-center items-center text-center col-span-2 lg:col-span-1">
                    <span className="block text-[9px] font-black uppercase text-[#A0AEC0]">Deductions</span>
                    <span className="block text-[15px] font-black text-[#FF6B6B]">₹{salaryData.deductions.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-4 border-t-2 border-gray-100">
                  <div className="text-center">
                    <span className="block text-2xl font-black text-[#2D3436]">{salaryData.daysInCycle}</span>
                    <span className="text-[10px] font-black uppercase text-[#A0AEC0]">Cycle Days ({salaryData.cycleStart} - {salaryData.cycleEnd})</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-2xl font-black text-[#4ECDC4]">{salaryData.attended}</span>
                    <span className="text-[10px] font-black uppercase text-[#A0AEC0]">Present</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-2xl font-black text-[#FF6B6B]">{salaryData.absent}</span>
                    <span className="text-[10px] font-black uppercase text-[#A0AEC0]">Days Absent</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#FFD93D] flex-grow shadow-lg hidden sm:block">
            <div className="flex items-center gap-2 mb-6">
              <CalendarDays className="w-6 h-6 text-[#F9D423]" />
              <h3 className="text-xl font-black uppercase tracking-wider text-[#2D3436]">History</h3>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {cycleRecords.length === 0 ? (
                <div className="text-center text-[#A0AEC0] font-medium py-4">
                  No previous attendance records found.
                </div>
              ) : (
                cycleRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between border-b-2 border-[#FFFCF0] pb-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-bold text-sm text-[#2D3436]">{record.date ? format(new Date(record.date), 'MMM d, yyyy') : record.clockIn ? format(new Date(record.clockIn), 'MMM d, yyyy') : '—'}</p>
                      <p className="text-xs font-bold text-[#A0AEC0] uppercase">{record.employeeName}</p>
                    </div>
                    {record.status === 'absent' ? (
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[#FF6B6B] uppercase tracking-wider">Absent</span>
                      </div>
                    ) : record.status === 'half-day' ? (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-[#FFB020] uppercase tracking-wider">Half Day</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 mt-1">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-[#A0AEC0] uppercase tracking-wider">In</span>
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-[#FFB020] rounded-full"></span>
                              <span className="font-bold text-sm text-[#2D3436]">{record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}</span>
                            </div>
                          </div>
                          {record.clockOut && (
                            <div className="flex flex-col items-end pl-2 sm:pl-4 border-l-2 border-[#FFFCF0]">
                              <span className="text-[10px] font-black text-[#A0AEC0] uppercase tracking-wider">Out</span>
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-[#FF6B6B] rounded-full"></span>
                                <span className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockOut), 'h:mm a')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-[#A0AEC0] uppercase tracking-wider">In</span>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-[#4ECDC4] rounded-full"></span>
                            <span className="font-bold text-sm text-[#2D3436]">{record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}</span>
                          </div>
                        </div>
                        {record.clockOut && (
                          <div className="flex flex-col items-end pl-2 sm:pl-4 border-l-2 border-[#FFFCF0]">
                            <span className="text-[10px] font-black text-[#A0AEC0] uppercase tracking-wider">Out</span>
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-[#FF6B6B] rounded-full"></span>
                              <span className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockOut), 'h:mm a')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#FFD93D] flex-grow shadow-lg sm:hidden">
             <div className="flex items-center gap-2 mb-6">
              <CalendarDays className="w-6 h-6 text-[#F9D423]" />
              <h3 className="text-xl font-black uppercase tracking-wider text-[#2D3436]">History</h3>
            </div>
             <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {cycleRecords.length === 0 ? (
                <div className="text-center text-[#A0AEC0] font-medium py-4">
                  No previous attendance records found.
                </div>
              ) : (
                cycleRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between border-b-2 border-[#FFFCF0] pb-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-bold text-sm text-[#2D3436]">{record.date ? format(new Date(record.date), 'MMM d, yyyy') : record.clockIn ? format(new Date(record.clockIn), 'MMM d, yyyy') : '—'}</p>
                    </div>
                    {record.status === 'absent' ? (
                      <div className="flex items-center gap-1">
                        <span className="font-black text-sm text-[#FF6B6B] uppercase tracking-wider">Absent</span>
                      </div>
                    ) : record.status === 'half-day' ? (
                      <div className="flex flex-col items-end gap-1">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm text-[#FFB020] uppercase tracking-wider">Half Day</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-[#FFB020] rounded-full"></span>
                            <span className="font-bold text-sm text-[#2D3436]">{record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}</span>
                         </div>
                         {record.clockOut && (
                           <div className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-[#FF6B6B] rounded-full"></span>
                              <span className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockOut), 'h:mm a')}</span>
                           </div>
                         )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                         <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-[#4ECDC4] rounded-full"></span>
                            <span className="font-bold text-sm text-[#2D3436]">{record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}</span>
                         </div>
                         {record.clockOut && (
                           <div className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-[#FF6B6B] rounded-full"></span>
                              <span className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockOut), 'h:mm a')}</span>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {cameraMode && (
        <CameraModal 
          title={`Take Photo for ${cameraMode === 'in' ? 'Clock In' : 'Clock Out'}`}
          onCapture={handleCapture}
          onClose={() => setCameraMode(null)}
        />
      )}

      {confirmClockOut && (
        <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black text-[#2D3436] mb-2">Are you sure?</h3>
            <p className="text-[#A0AEC0] font-bold mb-8">You are about to clock out for the day. You cannot undo this action.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmClockOut(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-[#A0AEC0] rounded-xl font-black transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={() => {
                  setConfirmClockOut(false);
                  processClockOut('');
                }}
                className="flex-1 py-3 bg-[#F9D423] hover:bg-[#F1C40F] text-[#8B6E00] rounded-xl font-black transition-colors"
              >
                CLOCK OUT
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed inset-0 bg-[#FFFCF0] z-[100] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-24 h-24 bg-[#4ECDC4] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-[#4ECDC4]/30 animate-bounce">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-[#2D3436] mb-4">
            {successMessage}
          </h2>
          <p className="text-[#A0AEC0] font-bold tracking-widest uppercase">Returning to home screen...</p>
        </div>
      )}
    </div>
  );
}
