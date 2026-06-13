import React, { useState } from 'react';
import { LogIn, Phone, ShieldAlert, User, Image as ImageIcon } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { motion } from 'motion/react';

export default function Login({ onLogin, defaultPhone }: { onLogin?: (profile: any) => void, defaultPhone?: string | null }) {
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone ? defaultPhone.replace('+91', '') : '');
  const [name, setName] = useState('');
  const [pictureBase64, setPictureBase64] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 150;
          const MAX_HEIGHT = 150;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setPictureBase64(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const fullPhoneNumber = `+91${phoneNumber}`;
      const userId = `user_${phoneNumber}`;

      const userData = {
        uid: userId,
        name: name,
        phoneNumber: fullPhoneNumber,
        photoBase64: pictureBase64,
        role: 'employee',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', userId), userData, { merge: true });

      if (onLogin) {
        onLogin(userData);
      }

    } catch (err: any) {
      console.error('Registration failed', err);
      setError('Registration failed. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
      setError('Google Sign-In failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFCF0] font-sans flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[40px] shadow-lg border-b-8 border-r-8 border-[#4ECDC4] p-8 sm:p-10 text-center"
      >
        <div className="w-20 h-20 bg-[#FF6B6B] text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm overflow-hidden">
          {pictureBase64 ? (
            <img src={pictureBase64} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10" />
          )}
        </div>
        <h1 className="text-4xl font-black text-[#2D3436] mb-3 tracking-tight">ATTENDANCE<br/><span className="text-[#4ECDC4]">PORTAL</span></h1>
        
        {error && <div className="mb-4 text-sm font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-200">{error}</div>}

        <form onSubmit={handleRegisterProfile} className="mb-8 text-left">
          <p className="text-sm font-bold text-[#A0AEC0] mb-4 text-center">Create your profile to start.</p>
          
          <div className="mb-4">
            <label className="block text-xs font-black text-[#2D3436] mb-2 pl-2">FULL NAME</label>
            <input 
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#F0FFF4] border-4 border-[#4ECDC4] rounded-2xl p-4 text-xl font-bold text-[#2D3436] outline-none focus:border-[#26C6DA] transition-colors"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-black text-[#2D3436] mb-2 pl-2">PHONE NUMBER</label>
            <div className="flex">
              <span className="flex items-center justify-center bg-[#E0F7FA] border-4 border-r-0 border-[#4ECDC4] rounded-l-2xl px-4 text-xl font-bold text-[#2D3436]">
                +91
              </span>
              <input 
                type="tel"
                placeholder="9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
                readOnly={!!defaultPhone}
                className={`w-full border-4 border-[#4ECDC4] rounded-r-2xl p-4 text-xl font-bold text-[#2D3436] outline-none transition-colors ${defaultPhone ? 'bg-gray-100 cursor-not-allowed' : 'bg-[#F0FFF4] focus:border-[#26C6DA]'}`}
              />
            </div>
            {defaultPhone && (
              <p className="text-xs text-[#FF6B6B] mt-2 font-bold">This device is locked to this number.</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-black text-[#2D3436] mb-2 pl-2">PROFILE PICTURE (OPTIONAL)</label>
            <label className="flex items-center justify-center gap-2 w-full bg-white border-4 border-dashed border-[#A0AEC0] hover:border-[#4ECDC4] rounded-2xl p-4 text-[#A0AEC0] hover:text-[#4ECDC4] cursor-pointer transition-colors font-bold">
              <ImageIcon className="w-5 h-5" />
              {pictureBase64 ? 'CHANGE PICTURE' : 'UPLOAD PICTURE'}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange} 
                className="hidden" 
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || phoneNumber.length < 10 || !name.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#F9D423] text-[#8B6E00] rounded-[32px] py-4 px-8 hover:bg-[#F1C40F] transition-all font-black text-xl shadow-[0_6px_0_0_#D4AC0D] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'STARTING...' : 'ENTER'}
          </button>
        </form>
      </motion.div>

      {/* Removed Google Admin Login since admins use phone numbers */}
    </div>
  );
}
