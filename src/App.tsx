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

  useEffect(() => {
    // Lock browser history to prevent back button from exiting
    const lockHistory = () => {
      window.history.pushState(null, '', window.location.href);
    };
    
    lockHistory();
    window.addEventListener('popstate', lockHistory);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthUser(currentUser);
      setLoading(false);
    });

    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      // 10 minutes
      idleTimer = setTimeout(() => {
        setIsAdminView(false);
        setShowPasswordPrompt(false);
        setPasswordInput('');
        setPasswordError('');
        localStorage.removeItem('isAdminLoggedIn');
        window.dispatchEvent(new Event('appIdleReset'));
        setShowIdleOverlay(true);
      }, 10 * 60 * 1000); 
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', lockHistory);
      clearTimeout(idleTimer);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
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
          className="fixed inset-0 bg-[#2D3436] z-[9999] flex items-center justify-center cursor-pointer animate-in fade-in duration-500"
          onClick={() => setShowIdleOverlay(false)}
        >
          <div className="text-center px-4 animate-bounce">
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter text-white drop-shadow-2xl">
              MEHTA SALES CORP
            </h1>
            <p className="text-[#A0AEC0] mt-4 font-bold tracking-widest uppercase animate-pulse">
              Tap anywhere to continue
            </p>
          </div>
        </div>
      )}
    </>
  );
}

