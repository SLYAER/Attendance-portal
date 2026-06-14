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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFCF0] flex items-center justify-center font-sans tracking-widest font-black text-[#A0AEC0] text-xl uppercase">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const isAdmin = authUser?.email === 'loveranger900@gmail.com' || window.location.hostname === 'localhost';

  const handleLogout = () => {
    auth.signOut();
  };

  const handleOpenAdmin = () => {
    setShowPasswordPrompt(true);
    setPasswordError('');
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
    </>
  );
}

