/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [localUser, setLocalUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('shop_attendance_profile');
    if (storedUser) {
      try {
        setLocalUser(JSON.parse(storedUser));
      } catch (e) {
        console.log("Error parsing local user", e);
      }
    }

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

  const isAdmin = authUser?.email === 'loveranger900@gmail.com';

  const handleLogin = (profile: any) => {
    localStorage.setItem('shop_attendance_profile', JSON.stringify(profile));
    setLocalUser(profile);
  };

  const handleLogout = () => {
    localStorage.removeItem('shop_attendance_profile');
    setLocalUser(null);
    auth.signOut();
  };

  if (isAdmin && isAdminView) {
    return <AdminPanel onBack={() => setIsAdminView(false)} />;
  }

  // Admin takes precedence for dashboard if they don't have a local profile
  if (!localUser && !isAdmin) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Dashboard 
      isAdmin={isAdmin} 
      onOpenAdmin={() => setIsAdminView(true)} 
      localUser={localUser}
      onLogoutLocal={handleLogout}
    />
  );
}

