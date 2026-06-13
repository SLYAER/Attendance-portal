import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AttendanceRecord } from '../types';
import { ArrowLeft, Save, X, Trash2, Edit3, Users, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getDoc, setDoc } from 'firebase/firestore';

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shopLocation, setShopLocation] = useState<{lat: number, lng: number} | null>(null);
  const [settingLocation, setSettingLocation] = useState(false);

  useEffect(() => {
    fetchRecords();
    fetchShopLocation();
  }, []);

  const fetchShopLocation = async () => {
    try {
      const docRef = doc(db, 'system', 'config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().shopLocation) {
        setShopLocation(docSnap.data().shopLocation);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSetShopLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setSettingLocation(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const newLoc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      try {
        await setDoc(doc(db, 'system', 'config'), { shopLocation: newLoc }, { merge: true });
        setShopLocation(newLoc);
        alert("Shop location saved successfully!");
      } catch (err) {
        console.error(err);
        alert("Failed to save shop location");
      } finally {
        setSettingLocation(false);
      }
    }, (error) => {
      alert("Error getting location: " + error.message);
      setSettingLocation(false);
    }, { enableHighAccuracy: true });
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(500));
      const snapshot = await getDocs(q);
      const data: AttendanceRecord[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch records', error);
      alert('Failed to load records. Make sure you are an admin.');
    } finally {
      setLoading(false);
    }
  };

  const groupedEmployees = useMemo(() => {
    const map = new Map<string, { name: string; records: AttendanceRecord[] }>();
    records.forEach(r => {
      if (!map.has(r.userId)) {
        map.set(r.userId, { name: r.employeeName || 'Unknown Employee', records: [] });
      }
      map.get(r.userId)!.records.push(r);
    });
    const list = Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [records]);

  const selectedEmployeeData = useMemo(() => {
    return groupedEmployees.find(e => e.id === selectedUserId);
  }, [groupedEmployees, selectedUserId]);

  const chartData = useMemo(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const dataMap = new Map<string, { name: string, hours: number }>();
    
    records.forEach(record => {
      if (record.date.startsWith(currentMonth) && record.clockOut) {
        const inTime = new Date(record.clockIn).getTime();
        const outTime = new Date(record.clockOut).getTime();
        const hours = (outTime - inTime) / (1000 * 60 * 60);
        
        const empName = record.employeeName || 'Unknown Employee';
        if (!dataMap.has(empName)) {
          dataMap.set(empName, { name: empName, hours: 0 });
        }
        dataMap.get(empName)!.hours += hours;
      }
    });

    return Array.from(dataMap.values()).map(d => ({
      ...d,
      hours: Number(d.hours.toFixed(2))
    }));
  }, [records]);

  const startEditing = (record: AttendanceRecord) => {
    setEditingRecord(record);
    // Format dates for datetime-local input
    setEditClockIn(formatForInput(record.clockIn));
    setEditClockOut(record.clockOut ? formatForInput(record.clockOut) : '');
  };

  const formatForInput = (isoString: string) => {
    try {
      const date = new Date(isoString);
      // Construct format "YYYY-MM-DDThh:mm"
      const tzOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch (e) {
      return '';
    }
  };

  const handleSave = async () => {
    if (!editingRecord || !editingRecord.id) return;
    setIsSaving(true);
    try {
      // Reconstitute back to standard ISO
      const updatedClockIn = new Date(editClockIn).toISOString();
      const updatedClockOut = editClockOut ? new Date(editClockOut).toISOString() : undefined;

      const payload: any = { clockIn: updatedClockIn };
      if (updatedClockOut) {
        payload.clockOut = updatedClockOut;
      } else {
        payload.clockOut = deleteField();
      }

      await updateDoc(doc(db, 'attendance', editingRecord.id), payload);
      setEditingRecord(null);
      fetchRecords();
    } catch (error) {
      console.error('Failed to update', error);
      alert('Failed to update record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
      fetchRecords();
    } catch (error) {
      console.error('Failed to delete', error);
      alert('Failed to delete record.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFCF0] text-[#2D3436] font-sans flex flex-col">
      <header className="h-20 sm:h-24 px-6 md:px-12 flex items-center justify-between bg-white border-b-4 border-[#F9D423]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-2xl flex items-center justify-center transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-[#2D3436]">
            ADMIN <span className="text-[#FF6B6B]">PANEL</span>
          </h1>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-6 md:p-10 space-y-8">
        {/* Shop Configuration Section */}
        <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#F9D423] shadow-lg">
          <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] mb-6 flex items-center gap-3">
            📍 Shop Location
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#A0AEC0] mb-1">Current Coordinates</p>
              {shopLocation ? (
                <p className="text-[#2D3436] font-bold text-lg">
                  Lat: {shopLocation.lat.toFixed(6)}, Lng: {shopLocation.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-red-500 font-bold text-lg">Not Set Yet</p>
              )}
              <p className="text-xs text-[#A0AEC0] font-medium mt-2 max-w-lg">
                Employees will only be able to clock in/out if they are within 100 meters of this location. Ensure you are at the physical shop before updating.
              </p>
            </div>
            <button
              onClick={handleSetShopLocation}
              disabled={settingLocation}
              className="bg-[#2D3436] hover:bg-[#1A202C] text-white font-black px-6 py-4 rounded-2xl shadow-md transition-colors disabled:opacity-50 break-keep"
            >
              {settingLocation ? "Getting GPS..." : "Set Current Location as Shop"}
            </button>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#FF6B6B] shadow-lg">
          <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] mb-6 flex items-center gap-3">
            📊 Working Hours ({format(new Date(), 'MMMM yyyy')})
          </h2>
          <div className="h-72 w-full mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A0AEC0', fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A0AEC0', fontWeight: 'bold' }} />
                  <Tooltip 
                    cursor={{ fill: '#F0FFF4' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="hours" fill="#4ECDC4" radius={[6, 6, 0, 0]} name="Total Hours" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-full text-[#A0AEC0] font-bold">
                No completed shifts this month yet.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[40px] p-8 md:p-10 border-b-8 border-r-8 border-[#4ECDC4] shadow-lg min-h-[500px]">
          {loading ? (
            <div className="text-center text-[#A0AEC0] font-bold py-10 animate-pulse">Loading...</div>
          ) : !selectedUserId ? (
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] mb-8 flex items-center gap-3">
                <Users className="w-8 h-8 text-[#4ECDC4]" />
                Team Members
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedEmployees.map(emp => (
                  <div 
                    key={emp.id} 
                    onClick={() => setSelectedUserId(emp.id)}
                    className="group cursor-pointer bg-[#FFFCF0] border-4 border-transparent hover:border-[#F9D423] p-6 rounded-3xl transition-all flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-xl font-black text-[#2D3436]">{emp.name}</h3>
                      <p className="text-sm font-bold text-[#A0AEC0] mt-1">{emp.records.length} records</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#A0AEC0] group-hover:text-[#F9D423] group-hover:bg-white shadow-sm transition-colors">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </div>
                ))}
              </div>
              {groupedEmployees.length === 0 && (
                <div className="text-center text-[#A0AEC0] font-medium py-10">No team members found.</div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
                <button 
                  onClick={() => setSelectedUserId(null)}
                  className="p-3 bg-[#FFFCF0] hover:bg-[#F9D423] text-[#2D3436] rounded-2xl transition-colors self-start sm:self-auto"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-wider text-[#2D3436]">{selectedEmployeeData?.name}</h2>
                  <p className="text-sm font-bold text-[#A0AEC0]">Attendance History</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#FFFCF0]">
                      <th className="py-4 font-black uppercase text-xs tracking-wider text-[#A0AEC0]">Date</th>
                      <th className="py-4 font-black uppercase text-xs tracking-wider text-[#A0AEC0]">Clock In</th>
                      <th className="py-4 font-black uppercase text-xs tracking-wider text-[#A0AEC0]">Clock Out</th>
                      <th className="py-4 font-black uppercase text-xs tracking-wider text-[#A0AEC0] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeeData?.records.map(record => (
                      <tr key={record.id} className="border-b-2 border-[#FFFCF0] hover:bg-[#FFFCF0] transition-colors">
                        <td className="py-4 font-bold text-sm text-[#2D3436] pr-4">{format(new Date(record.clockIn), 'MMM d, yyyy')}</td>
                        <td className="py-4 font-bold text-sm text-[#4ECDC4] pr-4">{format(new Date(record.clockIn), 'h:mm a')}</td>
                        <td className="py-4 font-bold text-sm text-[#FF6B6B] pr-4">
                          {record.clockOut ? format(new Date(record.clockOut), 'h:mm a') : '—'}
                        </td>
                        <td className="py-4 flex justify-end gap-2 min-w-[100px]">
                          <button onClick={() => startEditing(record)} className="p-2 text-gray-500 hover:text-blue-500 bg-white hover:bg-blue-50 rounded-xl transition-colors shadow-sm">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => record.id && handleDelete(record.id)} className="p-2 text-gray-500 hover:text-red-500 bg-white hover:bg-red-50 rounded-xl transition-colors shadow-sm">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedEmployeeData?.records.length === 0 && (
                  <div className="text-center text-[#A0AEC0] font-medium py-10">No records found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Editing Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-[#2D3436]">Edit Record</h3>
              <button onClick={() => setEditingRecord(null)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Employee</label>
                <input type="text" disabled value={editingRecord.employeeName} className="w-full bg-gray-50 rounded-xl p-3 border border-gray-200 text-gray-500 font-medium" />
              </div>
              
              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Clock In</label>
                <input 
                  type="datetime-local" 
                  value={editClockIn} 
                  onChange={e => setEditClockIn(e.target.value)}
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Clock Out</label>
                <input 
                  type="datetime-local" 
                  value={editClockOut} 
                  onChange={e => setEditClockOut(e.target.value)}
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setEditingRecord(null)}
                className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={isSaving}
                onClick={handleSave}
                className="flex items-center gap-2 px-8 py-3 bg-[#F9D423] text-[#8B6E00] font-black rounded-full hover:bg-[#F1C40F] transition-colors shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
