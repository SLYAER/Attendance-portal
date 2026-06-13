import React, { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, orderBy, limit, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { AttendanceRecord, OperationType } from '../types';
import { handleFirestoreError } from '../lib/errorUtils';
import { LogOut, Clock, CalendarDays, CheckCircle2, ShieldAlert, User } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';

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

  const activeUserId = localUser?.uid || auth.currentUser?.uid;
  
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

  // Connection test + Real-time Firestore sync
  useEffect(() => {
    if (!activeUserId) return;

    // Test connection first
    getDocFromServer(doc(db, 'attendance', 'connection-test')).catch(error => {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    });

    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', activeUserId),
      orderBy('date', 'desc'),
      limit(7)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });
      
      setRecentRecords(records);
      
      const today = format(currentTime, 'yyyy-MM-dd');
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
    const fetchData = async () => {
      try {
        const docSnap = await getDocFromServer(doc(db, 'system', 'config'));
        if (docSnap.exists() && docSnap.data().shopLocation) {
          setShopLocation(docSnap.data().shopLocation);
        }
      } catch (err) {
        console.error("Failed to load shop config", err);
      }

      if (localUser) {
        setUserData(localUser);
      } else if (activeUserId) {
        try {
          const userSnap = await getDocFromServer(doc(db, 'users', activeUserId));
          if (userSnap.exists()) {
            setUserData(userSnap.data());
          }
        } catch (err) {
          console.error("Failed to load user profile", err);
        }
      }
    };
    fetchData();
  }, [activeUserId, localUser]);

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

  const verifyLocation = (): Promise<boolean> => {
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
      navigator.geolocation.getCurrentPosition((pos) => {
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

  const handleClockIn = async () => {
    if (!activeUserId) return;
    const isAtShop = await verifyLocation();
    if (!isAtShop) return;

    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const isoStr = now.toISOString();
    
    // Generate an ID to construct a ref safely
    const newDocRef = doc(collection(db, 'attendance'));
    
    const record: AttendanceRecord = {
      userId: activeUserId,
      employeeName: userData?.name || 'Employee',
      date: dateStr,
      clockIn: isoStr
    };

    try {
      await setDoc(newDocRef, record);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
    }
  };

  const handleClockOut = async () => {
    if (!todayRecord || !todayRecord.id) return;
    const isAtShop = await verifyLocation();
    if (!isAtShop) return;

    const now = new Date();
    const isoStr = now.toISOString();

    try {
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        clockOut: isoStr
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `attendance/${todayRecord.id}`);
    }
  };

  const handleSignOut = () => {
    if (localUser) {
      onLogoutLocal();
    } else {
      auth.signOut();
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading your data...</div>;
  }

  const isClockedIn = !!todayRecord;
  const isClockedOut = isClockedIn && !!todayRecord.clockOut;

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
              SIGN OUT
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
                  onClick={handleClockIn}
                  className="w-full py-6 sm:py-8 bg-[#FF6B6B] hover:bg-[#FF5252] text-white rounded-[32px] text-2xl sm:text-3xl font-black shadow-[0_8px_0_0_#EE5253] active:translate-y-1 active:shadow-none transition-all"
                >
                  CLOCK IN NOW
                </button>
              ) : !isClockedOut ? (
                <button
                  onClick={handleClockOut}
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
          <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#FFD93D] flex-grow shadow-lg hidden sm:block">
            <div className="flex items-center gap-2 mb-6">
              <CalendarDays className="w-6 h-6 text-[#F9D423]" />
              <h3 className="text-xl font-black uppercase tracking-wider text-[#2D3436]">History</h3>
            </div>

            <div className="space-y-4">
              {recentRecords.length === 0 ? (
                <div className="text-center text-[#A0AEC0] font-medium py-4">
                  No previous attendance records found.
                </div>
              ) : (
                recentRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between border-b-2 border-[#FFFCF0] pb-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockIn), 'MMM d, yyyy')}</p>
                      <p className="text-xs font-bold text-[#A0AEC0] uppercase">{record.employeeName}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-[#A0AEC0] uppercase tracking-wider">In</span>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#4ECDC4] rounded-full"></span>
                          <span className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockIn), 'h:mm a')}</span>
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
                ))
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#FFD93D] flex-grow shadow-lg sm:hidden">
             <div className="flex items-center gap-2 mb-6">
              <CalendarDays className="w-6 h-6 text-[#F9D423]" />
              <h3 className="text-xl font-black uppercase tracking-wider text-[#2D3436]">History</h3>
            </div>
             <div className="space-y-4">
              {recentRecords.length === 0 ? (
                <div className="text-center text-[#A0AEC0] font-medium py-4">
                  No previous attendance records found.
                </div>
              ) : (
                recentRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between border-b-2 border-[#FFFCF0] pb-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockIn), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#4ECDC4] rounded-full"></span>
                          <span className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockIn), 'h:mm a')}</span>
                       </div>
                       {record.clockOut && (
                         <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-[#FF6B6B] rounded-full"></span>
                            <span className="font-bold text-sm text-[#2D3436]">{format(new Date(record.clockOut), 'h:mm a')}</span>
                         </div>
                       )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
