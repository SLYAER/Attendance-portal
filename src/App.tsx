/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Kiosk from './components/Kiosk';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';

const ADMIN_NUMBERS = ['+919592838651', '+919888696542', '9592838651', '9888696542'];

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(() => {
    return localStorage.getItem('isAdminLoggedIn') === 'true';
  });
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [showIdleOverlay, setShowIdleOverlay] = useState(false);
  const [showClockOutAlarm, setShowClockOutAlarm] = useState(false);
  const [showBatterySaver, setShowBatterySaver] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleCloseAlarm = () => {
    setShowClockOutAlarm(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    // Lock browser history to prevent back button from exiting
    const lockHistory = () => {
      window.history.pushState(null, '', window.location.href);
    };
    
    lockHistory();
    window.addEventListener('popstate', lockHistory);

    let batteryManager: any = null;
    const updateBatteryStatus = () => {
      if (batteryManager) {
        if (!batteryManager.charging && batteryManager.level <= 0.20) {
          setShowBatterySaver(true);
        } else {
          setShowBatterySaver(false);
        }
      }
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        batteryManager = battery;
        updateBatteryStatus();
        batteryManager.addEventListener('levelchange', updateBatteryStatus);
        batteryManager.addEventListener('chargingchange', updateBatteryStatus);
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthUser(currentUser);
      setLoading(false);
    });

    const triggerIdleState = () => {
      setIsAdminView(false);
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setPasswordError('');
      localStorage.removeItem('isAdminLoggedIn');
      window.dispatchEvent(new Event('appIdleReset'));
      setShowIdleOverlay(true);
    };

    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      // 10 minutes
      idleTimer = setTimeout(triggerIdleState, 10 * 60 * 1000); 
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();

    let tapCount = 0;
    let tapTimer: ReturnType<typeof setTimeout>;
    const handleTripleClick = () => {
      tapCount++;
      clearTimeout(tapTimer);
      if (tapCount >= 3) {
        tapCount = 0;
        triggerIdleState();
      } else {
        tapTimer = setTimeout(() => {
          tapCount = 0;
        }, 500); // 500ms window for 3 taps
      }
    };
    window.addEventListener('click', handleTripleClick);

    let lastAlarmDay = -1;
    let alarmTimer: ReturnType<typeof setTimeout>;
    const checkTime = () => {
      const now = new Date();
      if (now.getHours() === 20 && now.getMinutes() === 30) {
        if (lastAlarmDay !== now.getDate()) {
          lastAlarmDay = now.getDate();
          setShowClockOutAlarm(true);
          
          if (!audioRef.current) {
            audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1003/1003-preview.mp3');
            audioRef.current.loop = true;
          }
          audioRef.current.play().catch(e => console.error("Audio playback error:", e));

          alarmTimer = setTimeout(() => {
            handleCloseAlarm();
          }, 20000);
        }
      }
    };
    const clockOutInterval = setInterval(checkTime, 1000);

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', lockHistory);
      clearTimeout(idleTimer);
      clearTimeout(tapTimer);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      window.removeEventListener('click', handleTripleClick);
      clearInterval(clockOutInterval);
      clearTimeout(alarmTimer);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBatteryStatus);
        batteryManager.removeEventListener('chargingchange', updateBatteryStatus);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFCF0] flex items-center justify-center font-sans tracking-widest font-black text-[#A0AEC0] text-xl uppercase">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const isAdmin = authUser?.email === 'ascendservices.corp@gmail.com' || authUser?.email === 'loveranger900@gmail.com' || window.location.hostname === 'localhost';

  const handleLogout = () => {
    auth.signOut();
  };

  const handleOpenAdmin = () => {
    if (isAdmin) {
      setIsAdminView(true);
      localStorage.setItem('isAdminLoggedIn', 'true');
    } else {
      setShowPasswordPrompt(true);
      setPasswordError('');
    }
  };

  const handleDeveloperLogin = async () => {
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert('Developer login failed');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'parth2909') {
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setIsAdminView(true);
      localStorage.setItem('isAdminLoggedIn', 'true');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  if (isAdminView) {
    return <AdminPanel onBack={() => {
      setIsAdminView(false);
      localStorage.removeItem('isAdminLoggedIn');
    }} />;
  }

  return (
    <>
      <Kiosk 
        isAdmin={isAdmin} 
        onOpenAdmin={handleOpenAdmin} 
      />
      
      {!authUser && (
        <button 
          onClick={handleDeveloperLogin}
          className="fixed bottom-4 right-4 text-[10px] font-bold text-gray-400 hover:text-gray-600 bg-white/50 px-3 py-2 rounded-xl backdrop-blur-sm z-40 transition-colors"
        >
          Dev Login
        </button>
      )}

      {authUser && isAdmin && (
        <div className="fixed bottom-4 right-4 text-[10px] font-bold text-[#4ECDC4] bg-white shadow-sm px-3 py-2 rounded-xl z-40 flex items-center gap-2">
          {authUser.email}
          <button onClick={handleLogout} className="text-gray-400 hover:text-[#FF6B6B]">Logout</button>
        </div>
      )}

      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handlePasswordSubmit}
            className="bg-white rounded-3xl p-8 max-w-sm w-full border-4 border-[#2D3436] shadow-[8px_8px_0_0_#2D3436]"
          >
            <h2 className="text-2xl font-black mb-4">Admin Access</h2>
            <div className="mb-6">
              <label className="block text-sm font-bold text-[#A0AEC0] mb-2">ENTER PASSWORD</label>
              <input 
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#FFFCF0] border-2 border-[#FFEAA7] rounded-xl px-4 py-3 font-bold text-[#2D3436] focus:border-[#F9D423] focus:outline-none"
                autoFocus
              />
              {passwordError && (
                <p className="text-[#FF6B6B] text-sm font-bold mt-2">{passwordError}</p>
              )}
            </div>
            <div className="flex gap-4">
              <button 
                type="button" 
                onClick={() => setShowPasswordPrompt(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 py-3 bg-[#F9D423] text-[#8B6E00] rounded-xl font-bold"
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      )}

      {showIdleOverlay && (
        <div 
          className="fixed inset-0 bg-black z-[9999] flex items-center justify-center cursor-pointer animate-in fade-in duration-500"
          onClick={() => setShowIdleOverlay(false)}
        >
          <div className="text-center px-4 animate-bounce">
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter text-[#A0AEC0]">
              MEHTA SALES CORP
            </h1>
            <p className="text-[#A0AEC0]/50 mt-4 font-bold tracking-widest uppercase animate-pulse">
              Tap anywhere to continue
            </p>
          </div>
        </div>
      )}

      {showClockOutAlarm && (
        <div 
          className="fixed inset-0 bg-red-600/90 z-[10000] flex items-center justify-center cursor-pointer animate-in fade-in duration-300"
          onClick={handleCloseAlarm}
        >
          <div className="text-center px-4 animate-bounce bg-white p-12 rounded-3xl shadow-2xl">
            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-[#FF6B6B]">
              CLOCK OUT TIME!
            </h1>
            <p className="text-[#2D3436] mt-4 font-bold tracking-widest uppercase text-xl">
              Tap to dismiss
            </p>
          </div>
        </div>
      )}

      {showBatterySaver && (
        <div 
          className="fixed inset-0 bg-black z-[10001] flex items-center justify-center"
        >
          <div className="text-center px-4" onClick={() => setShowBatterySaver(false)}>
            <div className="text-[#A0AEC0]/30 font-mono text-sm tracking-[0.5em] uppercase border border-[#A0AEC0]/20 py-2 px-6 rounded-full inline-block">
              POWER SAVING MODE
            </div>
          </div>
        </div>
      )}
    </>
  );
}

