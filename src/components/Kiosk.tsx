import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { ShieldAlert, User as UserIcon, LogIn } from 'lucide-react';
import Dashboard from './Dashboard';

interface KioskProps {
  onOpenAdmin: () => void;
  isAdmin: boolean;
}

export default function Kiosk({ onOpenAdmin, isAdmin }: KioskProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setPinError('Enter at least 4 characters');
      return;
    }

    setIsVerifying(true);
    setPinError('');

    try {
      if (!selectedUser.password) {
        // Create new password for user
        await updateDoc(doc(db, 'users', selectedUser.id), { password: pin });
        setLoggedInUser({ ...selectedUser, password: pin });
        setSelectedUser(null);
        setPin('');
      } else {
        // Verify existing password
        if (selectedUser.password === pin) {
          setLoggedInUser(selectedUser);
          setSelectedUser(null);
          setPin('');
        } else {
          setPinError('Incorrect password.');
        }
      }
    } catch (err) {
      console.error(err);
      setPinError('Error verifying password.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (loggedInUser) {
    return (
      <Dashboard 
        isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin}
        localUser={loggedInUser}
        onLogoutLocal={() => setLoggedInUser(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFCF0] flex items-center justify-center font-sans tracking-widest font-black text-[#A0AEC0] text-xl uppercase">
        <div className="animate-pulse">Loading Employees...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFCF0] text-[#2D3436] font-sans flex flex-col relative overflow-hidden">
      <header className="h-20 sm:h-24 px-6 md:px-12 flex items-center justify-between bg-white border-b-4 border-[#F9D423] shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-[#2D3436]">
            SELECT <span className="text-[#4ECDC4]">PROFILE</span>
          </h1>
        </div>
        <button 
          onClick={onOpenAdmin} 
          className="text-[#A0AEC0] hover:text-[#2D3436] transition-colors p-2 rounded-full"
        >
          <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </header>
      
      <main className="flex-grow p-6 md:p-12 max-w-7xl mx-auto w-full overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className="bg-white hover:bg-[#F0FFF4] border-4 border-transparent hover:border-[#4ECDC4] p-6 rounded-[32px] flex flex-col items-center gap-4 active:scale-95 transition-all shadow-sm"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[20px] bg-[#FFFCF0] border-4 border-[#FFEAA7] flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                {user.photoBase64 ? (
                  <img src={user.photoBase64} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-10 h-10 text-[#A0AEC0]" />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-lg text-[#2D3436]">{user.name}</p>
                <p className="font-bold text-xs text-[#A0AEC0]">{user.phoneNumber}</p>
              </div>
            </button>
          ))}
          {users.length === 0 && (
             <div className="col-span-full py-20 text-center font-bold text-lg text-[#A0AEC0]">
               No employees found. Admin can add them in the panel.
             </div>
          )}
        </div>
      </main>

      {/* PIN Modal */}
      {selectedUser && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all">
          <form 
            onSubmit={handlePinSubmit}
            className="bg-white rounded-[40px] p-8 md:p-10 w-full max-w-sm border-b-8 border-r-8 border-[#4ECDC4] shadow-2xl relative"
          >
            <button 
              type="button" 
              onClick={() => { setSelectedUser(null); setPin(''); setPinError(''); }}
              className="absolute top-6 right-6 w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-200 font-bold"
            >
              ×
            </button>
            
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 rounded-[20px] bg-[#FFFCF0] border-4 border-[#FFEAA7] flex items-center justify-center overflow-hidden mb-4 shadow-sm">
                {selectedUser.photoBase64 ? (
                  <img src={selectedUser.photoBase64} alt={selectedUser.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-10 h-10 text-[#A0AEC0]" />
                )}
              </div>
              <h2 className="text-2xl font-black text-[#2D3436]">{selectedUser.name}</h2>
              <p className="text-xs font-bold text-[#A0AEC0] uppercase tracking-wider mt-1">
                {selectedUser.password ? "Enter your password" : "Create your password"}
              </p>
            </div>

            <div className="mb-8">
              <input 
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-4xl sm:text-5xl font-black tracking-[1em] text-[#2D3436] bg-[#FFFCF0] border-4 border-[#FFEAA7] rounded-3xl py-6 outline-none focus:border-[#F9D423] transition-colors placeholder:text-gray-300 pl-[1em]"
                autoFocus
              />
              {pinError && <p className="text-center text-[#FF6B6B] font-bold text-sm mt-3">{pinError}</p>}
            </div>

            <button
              type="submit"
              disabled={isVerifying || pin.length < 4}
              className="w-full py-5 bg-[#4ECDC4] hover:bg-[#26C6DA] text-white font-black text-xl rounded-2xl shadow-[0_6px_0_0_#26A69A] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isVerifying ? 'VERIFYING...' : (
                <>
                  <LogIn className="w-6 h-6" />
                  {selectedUser.password ? "VERIFY" : "CREATE PASSWORD"}
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
