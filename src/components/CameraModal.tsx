import React, { useRef, useState, useEffect } from 'react';
import { Camera, X } from 'lucide-react';

interface CameraModalProps {
  onCapture: (photoBase64: string) => void;
  onClose: () => void;
  title: string;
}

export default function CameraModal({ onCapture, onClose, title }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Camera access denied or unavailable.");
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // reduce quality to 0.7 for smaller size
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        onCapture(base64);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-6 max-w-md w-full shadow-2xl relative flex flex-col items-center">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h3 className="text-xl font-black uppercase text-[#2D3436] mb-4">{title}</h3>
        
        {error ? (
          <div className="text-[#FF6B6B] font-bold py-10 text-center">{error}</div>
        ) : (
          <div className="relative w-full aspect-square bg-gray-100 rounded-[24px] overflow-hidden mb-6 border-4 border-[#FFEAA7]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        <button
          onClick={handleCapture}
          disabled={!!error}
          className="w-full py-5 bg-[#4ECDC4] hover:bg-[#26C6DA] text-white font-black text-xl rounded-2xl shadow-[0_6px_0_0_#26A69A] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Camera className="w-6 h-6" />
          CAPTURE PHOTO
        </button>
      </div>
    </div>
  );
}
