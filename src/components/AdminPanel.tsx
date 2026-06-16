import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, deleteField, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AttendanceRecord } from '../types';
import { ArrowLeft, Save, X, Trash2, Edit3, Users, ChevronRight, KeyRound, Camera, CheckCircle2, Mail, DollarSign, LayoutDashboard, Settings, Menu, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AdminPanelProps {
  onBack: () => void;
}

const SUGGESTED_BRANDS = [
  'Sony', 'Samsung', 'LG', 'Panasonic', 'Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Microsoft', 'Bose', 'Canon', 'Nikon',
  'Haier', 'Whirlpool', 'Bosch', 'Siemens', 'Electrolux', 'Dyson', 'Philips', 'Toshiba', 'Hitachi', 'Sharp', 'Vizio', 'Hisense', 'TCL',
  'OnePlus', 'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'Motorola', 'Nokia', 'JBL', 'Sennheiser', 'Logitech', 'Razer', 'Corsair', 'Nintendo'
];

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'team' | 'hours' | 'expenses' | 'settings' | 'brands'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'half-day'>('present');
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [addRecordDate, setAddRecordDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [addRecordStatus, setAddRecordStatus] = useState<'present' | 'absent' | 'half-day'>('present');
  const [addRecordClockIn, setAddRecordClockIn] = useState('09:00');
  const [addRecordClockOut, setAddRecordClockOut] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shopLocation, setShopLocation] = useState<{lat: number, lng: number} | null>(null);
  const [settingLocation, setSettingLocation] = useState(false);
  
  const [dailyCodes, setDailyCodes] = useState<Record<string, string>>({});
  const [generatingCodes, setGeneratingCodes] = useState(false);
  
  const [dailyViewDate, setDailyViewDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpSalary, setNewEmpSalary] = useState('');
  const [newEmpJoinDate, setNewEmpJoinDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  
  const [editEmpId, setEditEmpId] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpSalary, setEditEmpSalary] = useState('');
  const [editEmpJoinDate, setEditEmpJoinDate] = useState('');
  const [isEditingEmp, setIsEditingEmp] = useState(false);
  
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editAdvanceInput, setEditAdvanceInput] = useState('');
  const [isEditingAdvance, setIsEditingAdvance] = useState(false);

  const [brands, setBrands] = useState<string[]>([]);
  const [newBrandName, setNewBrandName] = useState('');

  // Sync brands with server
  useEffect(() => {
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => {
        if (data.brands) {
          setBrands(data.brands);
        }
      })
      .catch(err => console.error(err));
  }, []);

  const saveBrandsToServer = async (newBrands: string[]) => {
    setBrands(newBrands);
    try {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brands: newBrands })
      });
    } catch(e) {
      console.error(e);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchUsers();
    fetchRecords();
    fetchShopLocation();
    fetchFailedAttempts();
    fetchDailyCodes();
    fetchExpenses();
  }, []);

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrandName.trim();
    if (!trimmed || brands.includes(trimmed)) return;
    const updated = [...brands, trimmed];
    saveBrandsToServer(updated);
    setNewBrandName('');
    showToast("Brand initialized!");
  };
  
  const handleRemoveBrand = (brandToRemove: string) => {
    const updated = brands.filter(b => b !== brandToRemove);
    saveBrandsToServer(updated);
    showToast("Brand terminated.");
  };

  const fetchExpenses = async () => {
    try {
      const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setExpenses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setAllUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDailyCodes = async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const codesDoc = await getDoc(doc(db, 'daily_codes', todayStr));
      if (codesDoc.exists()) {
        setDailyCodes(codesDoc.data());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateCodes = async () => {
    setGeneratingCodes(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const newCodes: Record<string, string> = { ...dailyCodes };
      let changes = 0;
      
      snapshot.forEach(userDoc => {
        // Generate 4 digit code only if not existing
        if (!newCodes[userDoc.id]) {
          const code = Math.floor(1000 + Math.random() * 9000).toString();
          newCodes[userDoc.id] = code;
          changes++;
        }
      });

      if (changes === 0) {
        showToast("All users already have codes for today!");
        setGeneratingCodes(false);
        return;
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await setDoc(doc(db, 'daily_codes', todayStr), newCodes);
      setDailyCodes(newCodes);
      showToast(`Generated codes for ${changes} users!`);
    } catch (e) {
      console.error(e);
      showToast("Failed to generate codes", "error");
    } finally {
      setGeneratingCodes(false);
    }
  };

  const fetchFailedAttempts = async () => {
    try {
      const q = query(collection(db, 'failed_attempts'), orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setFailedAttempts(data);
    } catch (e) {
      console.error(e);
    }
  };

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
      showToast("Geolocation is not supported by your browser", "error");
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
        showToast("Shop location saved successfully!");
      } catch (err) {
        console.error(err);
        showToast("Failed to save shop location", "error");
      } finally {
        setSettingLocation(false);
      }
    }, (error) => {
      showToast("Error getting location: " + error.message, "error");
      setSettingLocation(false);
    }, { enableHighAccuracy: true });
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(500));
      const snapshot = await getDocs(q);
      const data: AttendanceRecord[] = [];
      const seenKey = new Set<string>();
      
      for (const docSnap of snapshot.docs) {
        const rec = docSnap.data() as AttendanceRecord;
        const key = `${rec.userId}_${rec.date}`;
        if (!seenKey.has(key)) {
          seenKey.add(key);
          data.push({ id: docSnap.id, ...rec });
        } else {
           // Duplicate found! Delete it since we are admin here.
           // Prefer keeping the one we already pushed (which is newer since ordered desc)
           try {
             await deleteDoc(doc(db, 'attendance', docSnap.id));
             console.log("Deleted duplicate attendance record:", docSnap.id);
           } catch (e) {
             console.error("Could not delete duplicate", e);
           }
        }
      }
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch records', error);
      showToast('Failed to load records. Make sure you are an admin.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const groupedEmployees = useMemo(() => {
    const map = new Map<string, any>();
    
    // First, initialize all users from `allUsers` array so they always show up
    allUsers.forEach(user => {
      map.set(user.id, { 
        name: user.name || 'Unknown', 
        records: [],
        ...user // include other properties like joinDate, monthlySalary, advanceTaken, phoneNumber
      });
    });

    records.forEach(r => {
      if (!map.has(r.userId)) {
        map.set(r.userId, { name: r.employeeName || 'Unknown Employee', records: [] });
      }
      map.get(r.userId)!.records.push(r);
    });
    
    const list = Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [records, allUsers]);

  const selectedEmployeeData = useMemo(() => {
    return groupedEmployees.find(e => e.id === selectedUserId);
  }, [groupedEmployees, selectedUserId]);

  const calculateSalaryData = (emp: any) => {
    if (!emp?.monthlySalary) return null;
    
    const now = new Date();
    const startDateStr = emp.joinDate || emp.createdAt;
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
    let fullAbsents = 0;
    let halfDays = 0;
    
    emp.records.forEach((r: any) => {
      const rDate = new Date(r.date);
      if (rDate >= cycleStartObj && rDate < cycleEndObj) {
        if (r.status === 'absent') {
          absents += 1;
          fullAbsents += 1;
        } else if (r.status === 'half-day') {
          absents += 0.5;
          halfDays += 1;
          attendedDates.add(r.date);
        } else {
          attendedDates.add(r.date);
        }
      }
    });

    const elapsedMs = now.getTime() - cycleStartObj.getTime();
    let elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    if (elapsedDays < 0) elapsedDays = 0;
    
    const perDay = emp.monthlySalary / daysInCycle;
    const deductions = absents * perDay;
    const advance = emp.advanceTaken || 0;
    const remainingSalary = emp.monthlySalary - advance - deductions;

    return {
      monthlySalary: emp.monthlySalary,
      perDay: Math.round(perDay),
      daysInCycle,
      elapsed: elapsedDays,
      attended: attendedDates.size,
      absent: absents,
      fullAbsents,
      halfDays,
      advanceTaken: advance,
      remainingSalary: Math.round(remainingSalary),
      deductions: Math.round(deductions),
      cycleStart: format(cycleStartObj, 'MMM d'),
      cycleEnd: format(cycleEndObj, 'MMM d')
    };
  };

  const selectedEmployeeSalary = useMemo(() => {
    return calculateSalaryData(selectedEmployeeData);
  }, [selectedEmployeeData]);

  const activeStaff = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return records.filter(r => r.date === today && !r.clockOut && r.status !== 'absent');
  }, [records]);

  const recordsForSelectedDate = useMemo(() => {
    return records.filter(r => r.date === dailyViewDate);
  }, [records, dailyViewDate]);

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
    setEditStatus((record.status as 'present' | 'absent' | 'half-day') || 'present');
    // Format dates for datetime-local input
    setEditClockIn(record.clockIn ? formatForInput(record.clockIn) : '');
    setEditClockOut(record.clockOut ? formatForInput(record.clockOut) : '');
  };

  const formatForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      // Construct format "YYYY-MM-DDThh:mm"
      const tzOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch (e) {
      return '';
    }
  };

  const ADMIN_EMAIL = 'ascendservices.corp@gmail.com';

  const handleSendAbsentNotification = async (employee: any, payload: any) => {
    const isHalfDay = payload.status === 'half-day';

    try {
      const subject = isHalfDay ? `Notice: Half Day Marked - ${employee.name}` : `Notice: Absence Marked - ${employee.name}`;
      const body = `Hello ${employee.name},\n\n`
        + `This is to inform you that you have been marked as ${isHalfDay ? 'HALF DAY' : 'ABSENT'} for ${format(new Date(payload.date), 'MMM d, yyyy')}.\n`
        + `Please note that applicable fines or deductions will be applied to your monthly salary.\n\n`
        + `Best,\nManagement`;

      const to = employee.email ? [employee.email, ADMIN_EMAIL] : [ADMIN_EMAIL];

      await addDoc(collection(db, 'mail'), {
        to,
        message: {
          subject,
          text: body,
        }
      });
      showToast('Notification queued to send!');
    } catch (e: any) {
      console.error(e);
      showToast('Failed to queue email: ' + e.message, 'error');
    }
  };

  const handleSendMonthlyReport = async (employee: any, salaryData: any) => {
    try {
      const subject = `Monthly Salary Report: ${employee.name}`;
      const body = `Hello ${employee.name},\n\n`
        + `Here is your salary report for the current cycle:\n`
        + `-------------------------------------------------\n`
        + `Total Salary Configured: ₹${employee.monthlySalary?.toLocaleString() || 0}\n`
        + `Presents: ${salaryData.attended} days\n`
        + `Half Days: ${salaryData.halfDays || 0} days\n`
        + `Absents: ${salaryData.fullAbsents} days\n\n`
        + `Deductions (Absents & Half days): ₹${salaryData.deductions.toLocaleString()}\n`
        + `Advances Taken: ₹${salaryData.advanceTaken.toLocaleString()}\n`
        + `-------------------------------------------------\n`
        + `NET SALARY PAYABLE: ₹${salaryData.remainingSalary.toLocaleString()}\n\n`
        + `Best,\nManagement`;

      const to = employee.email ? [employee.email, ADMIN_EMAIL] : [ADMIN_EMAIL];

      await addDoc(collection(db, 'mail'), {
        to,
        message: {
          subject,
          text: body,
        }
      });
      showToast('Monthly report queued to send!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast('Failed to queue report: ' + e.message, 'error');
    }
  };

  const handleSendMonthlyReportToAll = async () => {
    const confirmSend = window.confirm('Queue monthly salary report emails for ALL employees?');
    if (!confirmSend) return;

    try {
      showToast('Queueing reports...', 'success');
      
      let sentCount = 0;
      let errorCount = 0;

      for (const employee of groupedEmployees) {
        const salaryData = calculateSalaryData(employee);
        if (!salaryData) continue;

        const subject = `Monthly Salary Report: ${employee.name}`;
        const body = `Hello ${employee.name},\n\n`
          + `Here is your salary report for the current cycle:\n`
          + `-------------------------------------------------\n`
          + `Total Salary Configured: ₹${employee.monthlySalary?.toLocaleString() || 0}\n`
          + `Presents: ${salaryData.attended} days\n`
          + `Half Days: ${salaryData.halfDays || 0} days\n`
          + `Absents: ${salaryData.fullAbsents} days\n\n`
          + `Deductions (Absents & Half days): ₹${salaryData.deductions.toLocaleString()}\n`
          + `Advances Taken: ₹${salaryData.advanceTaken.toLocaleString()}\n`
          + `-------------------------------------------------\n`
          + `NET SALARY PAYABLE: ₹${salaryData.remainingSalary.toLocaleString()}\n\n`
          + `Best,\nManagement`;

        const to = employee.email ? [employee.email, ADMIN_EMAIL] : [ADMIN_EMAIL];

        try {
          await addDoc(collection(db, 'mail'), {
            to,
            message: {
              subject,
              text: body,
            }
          });
          sentCount++;
        } catch (e: any) {
          console.error(`Failed to queue for ${employee.name}`, e);
          errorCount++;
        }
      }

      showToast(`Finished: Queued ${sentCount} emails, ${errorCount} errors.`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast('Failed to queue reports: ' + e.message, 'error');
    }
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedEmployeeData) return;
    setIsSaving(true);
    try {
      const payload: any = {
        userId: selectedUserId,
        employeeName: selectedEmployeeData.name,
        date: addRecordDate,
        status: addRecordStatus,
      };
      
      if (addRecordStatus === 'present' || addRecordStatus === 'half-day') {
        const clockInDate = new Date(`${addRecordDate}T${addRecordClockIn}`);
        payload.clockIn = clockInDate.toISOString();
        if (addRecordClockOut) {
          const clockOutDate = new Date(`${addRecordDate}T${addRecordClockOut}`);
          payload.clockOut = clockOutDate.toISOString();
        }
      }
      
      await addDoc(collection(db, 'attendance'), payload);
      setIsAddingRecord(false);
      setAddRecordDate(format(new Date(), 'yyyy-MM-dd'));
      setAddRecordStatus('present');
      setAddRecordClockIn('09:00');
      setAddRecordClockOut('');
      fetchRecords();
      showToast('Record added successfully!');

      if (addRecordStatus === 'absent' || addRecordStatus === 'half-day') {
        handleSendAbsentNotification(selectedEmployeeData, payload);
      }
    } catch (error) {
      console.error('Failed to add record', error);
      showToast('Failed to add record.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editingRecord || !editingRecord.id) return;
    
    if ((editStatus === 'present' || editStatus === 'half-day') && !editClockIn) {
      showToast('Please specify a valid Clock In time', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = { status: editStatus };
      if (editStatus === 'present' || editStatus === 'half-day') {
        const updatedClockIn = new Date(editClockIn).toISOString();
        const updatedClockOut = editClockOut ? new Date(editClockOut).toISOString() : undefined;
        payload.clockIn = updatedClockIn;
        if (updatedClockOut) {
          payload.clockOut = updatedClockOut;
        } else {
          payload.clockOut = deleteField();
        }
      } else {
        payload.clockIn = deleteField();
        payload.clockOut = deleteField();
      }

      await updateDoc(doc(db, 'attendance', editingRecord.id), payload);
      setEditingRecord(null);
      fetchRecords();
      showToast('Record updated successfully!');
      
      if (editStatus === 'absent' || editStatus === 'half-day') {
        handleSendAbsentNotification(selectedEmployeeData, { ...editingRecord, ...payload });
      }
    } catch (error) {
      console.error('Failed to update', error);
      showToast('Failed to update record.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || newEmpPhone.length < 10) return;
    setIsAddingEmp(true);
    try {
      const fullPhoneNumber = `+91${newEmpPhone}`;
      const userId = `user_${newEmpPhone}`;

      const userData = {
        uid: userId,
        name: newEmpName,
        phoneNumber: fullPhoneNumber,
        email: newEmpEmail,
        monthlySalary: Number(newEmpSalary) || 0,
        joinDate: newEmpJoinDate,
        advanceTaken: 0,
        photoBase64: '',
        role: 'employee',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', userId), userData, { merge: true });
      
      // Auto-assign a code if daily codes exist
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const codesDoc = await getDoc(doc(db, 'daily_codes', todayStr));
      if (codesDoc.exists()) {
        const existingCodes = codesDoc.data();
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        existingCodes[userId] = code;
        await setDoc(doc(db, 'daily_codes', todayStr), existingCodes);
        setDailyCodes(existingCodes);
      }
      
      setShowAddEmployee(false);
      setNewEmpName('');
      setNewEmpPhone('');
      setNewEmpEmail('');
      setNewEmpSalary('');
      setNewEmpJoinDate(format(new Date(), 'yyyy-MM-dd'));
      showToast("Employee added successfully!");
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error(err);
      showToast("Failed to add employee", "error");
    } finally {
      setIsAddingEmp(false);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmpId || !editEmpName || editEmpPhone.length < 10) return;
    setIsEditingEmp(true);
    try {
      const fullPhoneNumber = editEmpPhone.startsWith('+91') 
          ? editEmpPhone 
          : `+91${editEmpPhone}`;

      await updateDoc(doc(db, 'users', editEmpId), {
        name: editEmpName,
        phoneNumber: fullPhoneNumber,
        email: editEmpEmail,
        monthlySalary: Number(editEmpSalary) || 0,
        joinDate: editEmpJoinDate,
      });
      
      setEditEmpId(null);
      showToast("Employee profile updated!");
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast("Failed to update employee", "error");
    } finally {
      setIsEditingEmp(false);
    }
  };

  const openEditModal = (emp: any) => {
    setEditEmpId(emp.id);
    setEditEmpName(emp.name || '');
    setEditEmpPhone(emp.phoneNumber ? emp.phoneNumber.replace('+91', '') : '');
    setEditEmpEmail(emp.email || '');
    setEditEmpSalary(emp.monthlySalary?.toString() || '');
    setEditEmpJoinDate(emp.joinDate || format(new Date(), 'yyyy-MM-dd'));
  };

  const handleUpdateAdvance = async (userId: string, advance: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), { advanceTaken: advance });
      fetchUsers();
      showToast("Advance updated!");
    } catch (err) {
      console.error(err);
      showToast("Failed to update advance", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'attendance', id));
      setConfirmDelete(null);
      fetchRecords();
      showToast('Record deleted successfully!');
    } catch (error) {
      console.error('Failed to delete', error);
      showToast('Failed to delete record.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFCF0] text-[#2D3436] font-sans flex overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r-4 border-[#F9D423] transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col shadow-xl lg:shadow-none`}>
        <div className="h-24 px-6 flex items-center justify-between border-b-2 border-gray-100 shrink-0">
          <h1 className="text-2xl font-black tracking-tight text-[#2D3436]">
            ADMIN <span className="text-[#FF6B6B]">PANEL</span>
          </h1>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <button onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-[#F9D423] text-[#8B6E00]' : 'hover:bg-gray-100 text-[#A0AEC0]'}`}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button onClick={() => { setActiveTab('team'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'team' ? 'bg-[#4ECDC4] text-white' : 'hover:bg-gray-100 text-[#A0AEC0]'}`}>
            <Users className="w-5 h-5" /> Team Members
          </button>
          <button onClick={() => { setActiveTab('hours'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'hours' ? 'bg-[#F9D423] text-[#8B6E00]' : 'hover:bg-gray-100 text-[#A0AEC0]'}`}>
            <Clock className="w-5 h-5" /> Working Hours
          </button>
          <button onClick={() => { setActiveTab('expenses'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'expenses' ? 'bg-[#FF6B6B] text-white' : 'hover:bg-gray-100 text-[#A0AEC0]'}`}>
            <DollarSign className="w-5 h-5" /> Expenses Log
          </button>
          <button onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'settings' ? 'bg-[#2D3436] text-white' : 'hover:bg-gray-100 text-[#A0AEC0]'}`}>
            <Settings className="w-5 h-5" /> Settings
          </button>
          <button onClick={() => { setActiveTab('brands'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'brands' ? 'bg-[#4ECDC4] text-white' : 'hover:bg-gray-100 text-[#A0AEC0]'}`}>
            <LayoutDashboard className="w-5 h-5" /> Brands
          </button>
        </div>
        <div className="p-4 border-t-2 border-gray-100">
          <button onClick={onBack} className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" /> Exit Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 sm:h-24 px-6 md:px-12 flex items-center justify-between bg-white/50 backdrop-blur-md lg:hidden border-b-2 border-gray-100 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="w-10 h-10 bg-white shadow-sm hover:bg-gray-50 rounded-2xl flex items-center justify-center transition-colors">
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#2D3436] uppercase">{activeTab}</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-6 md:p-10">
          <div className="max-w-6xl mx-auto space-y-8 pb-32 lg:pt-6">
            
            {activeTab === 'brands' && (
              <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#4ECDC4] shadow-lg animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] flex items-center gap-3">
                    <LayoutDashboard className="w-6 h-6 text-[#4ECDC4]"/> Register Brands
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if(window.confirm('Are you sure you want to restore the default brands?')) {
                          saveBrandsToServer(SUGGESTED_BRANDS.slice(0, 14));
                          showToast("Brands reset to defaults!");
                        }
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                    >
                      Reset Defaults
                    </button>
                    <button 
                      onClick={() => {
                        if(window.confirm('Are you sure you want to remove all registered brands?')) {
                          saveBrandsToServer([]);
                          showToast("All brands cleared!");
                        }
                      }}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl font-bold transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" /> Clear All Brands
                    </button>
                  </div>
                </div>
                
                <form onSubmit={handleAddBrand} className="flex flex-col sm:flex-row gap-4 mb-10 w-full">
                  <div className="flex-1 relative">
                    <input 
                      value={newBrandName} 
                      onChange={e => setNewBrandName(e.target.value)} 
                      placeholder="E.g., Samsung, LG, Sony..." 
                      className="w-full px-6 py-4 rounded-xl border-4 border-gray-100 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] text-lg" 
                    />
                    {newBrandName && SUGGESTED_BRANDS.filter(b => b.toLowerCase().startsWith(newBrandName.toLowerCase()) && !brands.map(x => x.toLowerCase()).includes(b.toLowerCase())).length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden z-20">
                        {SUGGESTED_BRANDS.filter(b => b.toLowerCase().startsWith(newBrandName.toLowerCase()) && !brands.map(x => x.toLowerCase()).includes(b.toLowerCase())).map(b => (
                          <div 
                            key={b} 
                            onClick={() => {
                              const updated = [...brands, b];
                              setBrands(updated);
                              localStorage.setItem('catalogBrands', JSON.stringify(updated));
                              setNewBrandName('');
                              showToast("Brand initialized!");
                            }} 
                            className="px-6 py-3 cursor-pointer hover:bg-[#E6F8F6] text-[#2D3436] font-bold transition-colors border-b border-gray-50 last:border-0"
                          >
                            {b}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" className="px-8 py-4 bg-[#4ECDC4] hover:bg-[#3dbdb4] text-white rounded-xl font-black uppercase tracking-widest transition-colors shadow-[0_4px_0_0_#2b9f97] active:translate-y-[4px] active:shadow-none h-fit self-start sm:self-center">
                    Add Brand
                  </button>
                </form>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {brands.map(b => (
                    <div key={b} className="relative group bg-gray-50 border-4 border-gray-100 rounded-3xl p-6 flex flex-col justify-center items-center gap-4 transition-all hover:border-[#4ECDC4]">
                      <div className="w-16 h-16 bg-white overflow-hidden rounded-full flex items-center justify-center shadow-sm border border-gray-100 p-2">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${b.toLowerCase().replace(/\s+/g, '')}.com&sz=128`} 
                          alt={b} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain" 
                          onError={(e) => { 
                            e.currentTarget.style.display='none'; 
                            e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-gray-400"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>';
                          }} 
                        />
                      </div>
                      <span className="font-black text-center text-[#2D3436] tracking-wider uppercase">{b}</span>
                      <button 
                        onClick={() => handleRemoveBrand(b)}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-[#FF6B6B] hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-opacity shadow-md z-10"
                      >
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
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
            )}

            {activeTab === 'expenses' && (
              <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#4ECDC4] shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] flex items-center gap-3">
              <DollarSign className="text-[#4ECDC4]" /> Recent Expenses
            </h2>
          </div>
          {expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Date added</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Entered By</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Expense Date</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Category</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Description</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0] text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td className="py-3 text-sm font-bold text-[#A0AEC0]">{format(new Date(exp.createdAt), 'MMM d, p')}</td>
                      <td className="py-3 text-sm font-bold text-[#2D3436]">{exp.employeeName}</td>
                      <td className="py-3 text-sm font-bold text-[#2D3436]">{exp.date}</td>
                      <td className="py-3 text-sm font-bold text-[#A0AEC0]">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-[10px] uppercase tracking-wider">{exp.category || 'N/A'}</span>
                      </td>
                      <td className="py-3 text-sm font-medium text-[#2D3436]">{exp.description}</td>
                      <td className="py-3 text-lg font-black text-[#FF6B6B] text-right">-₹{exp.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
             <div className="flex justify-center items-center h-20 text-[#A0AEC0] font-bold">
               No recent expenses.
             </div>
          )}
        </div>
            )}

            {activeTab === 'hours' && (
              <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#F9D423] shadow-lg">
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
                        <Bar dataKey="hours" fill="#F9D423" radius={[6, 6, 0, 0]} name="Total Hours" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-full text-[#A0AEC0] font-bold">
                      No completed shifts this month yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <>
                {/* Failed Attempts Log */}
        {failedAttempts.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#2D3436] shadow-lg">
            <h2 className="text-2xl font-black uppercase tracking-wider text-[#FF6B6B] mb-6 flex items-center gap-3">
              ⚠️ Distant Attempts Log
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Time</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Employee</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Action</th>
                    <th className="py-3 font-bold text-xs uppercase text-[#A0AEC0]">Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  {failedAttempts.map(att => (
                    <tr key={att.id}>
                      <td className="py-3 text-sm font-bold text-[#2D3436]">{format(new Date(att.timestamp), 'PP p')}</td>
                      <td className="py-3 text-sm font-bold text-[#2D3436]">{att.employeeName}</td>
                      <td className="py-3 text-sm font-bold text-[#2D3436]">{att.action}</td>
                      <td className="py-3 text-sm font-bold text-[#FF6B6B]">{att.distanceMeters} m away</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

                {/* Daily View & Active Clock-ins */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Active Clocked In Staff */}
                  <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#4ECDC4] shadow-lg">
            <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] mb-6 flex items-center gap-3">
              🟢 Currently Clocked In
            </h2>
            <div className="space-y-4">
              {activeStaff.length > 0 ? activeStaff.map(staff => (
                <div key={staff.id} className="flex justify-between items-center p-4 rounded-2xl bg-[#F0FFF4] border-2 border-[#4ECDC4]/20">
                  <span className="font-bold text-[#2D3436]">{staff.employeeName}</span>
                  <span className="text-sm font-black text-[#4ECDC4]">Since {format(new Date(staff.clockIn), 'h:mm a')}</span>
                </div>
              )) : (
                <div className="text-center text-[#A0AEC0] font-bold py-6">No active clock-ins.</div>
              )}
            </div>
          </div>

          {/* Daily Attendance via Calendar */}
          <div className="bg-white rounded-[40px] p-8 border-b-8 border-r-8 border-[#F9D423] shadow-lg flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] flex items-center gap-3">
                📅 Daily Records
              </h2>
              <input
                type="date"
                value={dailyViewDate}
                onChange={e => setDailyViewDate(e.target.value)}
                className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-[#2D3436] outline-none focus:border-[#F9D423]"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-3">
              {recordsForSelectedDate.length > 0 ? recordsForSelectedDate.map(record => (
                <div key={record.id} className="p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#2D3436] text-lg">{record.employeeName}</span>
                    <span className="text-xs font-black text-[#A0AEC0]">{format(new Date(record.date), 'MMM d, yyyy')}</span>
                  </div>
                  {record.status === 'absent' ? (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-black text-[#FF6B6B] uppercase">Absent</span>
                    </div>
                  ) : record.status === 'half-day' ? (
                    <div className="flex justify-between items-center mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-[#FFB020] uppercase">Half Day</span>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-[#FFB020] rounded-full"></span>
                          <span className="text-sm font-bold text-[#2D3436]">{record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}</span>
                        </div>
                      </div>
                      {record.clockOut && (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-black text-[#A0AEC0] uppercase">Out</span>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#FF6B6B] rounded-full"></span>
                            <span className="text-sm font-bold text-[#2D3436]">{format(new Date(record.clockOut), 'h:mm a')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#A0AEC0] uppercase">In:</span>
                        <span className="text-sm font-black text-[#4ECDC4]">{record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}</span>
                      </div>
                      {record.clockOut ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#A0AEC0] uppercase">Out:</span>
                          <span className="text-sm font-black text-[#FF6B6B]">{format(new Date(record.clockOut), 'h:mm a')}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-[#F9D423]">Active</span>
                      )}
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center text-[#A0AEC0] font-bold py-6">No attendance records for this date.</div>
              )}
            </div>
          </div>
                </div>
              </>
            )}

            {activeTab === 'team' && (
              <div className="bg-white rounded-[40px] p-8 md:p-10 border-b-8 border-r-8 border-[#2D3436] shadow-lg min-h-[500px]">
          {loading ? (
            <div className="text-center text-[#A0AEC0] font-bold py-10 animate-pulse">Loading...</div>
          ) : !selectedUserId ? (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-black uppercase tracking-wider text-[#2D3436] flex items-center gap-3">
                  <Users className="w-8 h-8 text-[#4ECDC4]" />
                  Team Members
                </h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start sm:self-auto">
                  <button
                    onClick={handleSendMonthlyReportToAll}
                    className="bg-[#FFEAA7] hover:bg-[#F9D423] text-[#2D3436] font-black px-6 py-3 rounded-2xl shadow-md transition-colors flex items-center gap-2 text-sm sm:text-base border-2 border-[#2D3436]/10"
                  >
                    <Mail className="w-5 h-5" />
                    Send All Reports
                  </button>
                  <button
                    onClick={handleGenerateCodes}
                    disabled={generatingCodes}
                    className="bg-[#2D3436] hover:bg-[#1A202C] text-white font-black px-6 py-3 rounded-2xl shadow-md transition-colors disabled:opacity-50 flex items-center gap-2 text-sm sm:text-base"
                  >
                    <KeyRound className="w-5 h-5" />
                    {generatingCodes ? "Generating..." : "Generate Missing Codes"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <button
                  onClick={() => setShowAddEmployee(true)}
                  className="bg-white border-4 border-dashed border-[#A0AEC0] hover:border-[#4ECDC4] hover:bg-[#F0FFF4] p-6 rounded-[32px] flex flex-col items-center justify-center gap-2 group transition-all min-h-[160px]"
                >
                  <div className="w-12 h-12 rounded-full bg-[#E2E8F0] group-hover:bg-[#4ECDC4] text-[#A0AEC0] group-hover:text-white flex items-center justify-center transition-colors">
                    <span className="text-2xl font-black">+</span>
                  </div>
                  <span className="font-bold text-[#A0AEC0] group-hover:text-[#4ECDC4]">Add Employee</span>
                </button>
                {groupedEmployees.map(emp => (
                  <div 
                    key={emp.id} 
                    onClick={() => setSelectedUserId(emp.id)}
                    className="group cursor-pointer bg-[#FFFCF0] border-4 border-transparent hover:border-[#F9D423] p-6 rounded-3xl transition-all flex items-center justify-between relative"
                  >
                    <div>
                      <h3 className="text-xl font-black text-[#2D3436]">{emp.name}</h3>
                      <p className="text-sm font-bold text-[#A0AEC0] mt-1">{emp.records.length} records</p>
                      
                      {dailyCodes[emp.id] && (
                        <div className="mt-4 bg-white px-3 py-2 rounded-xl inline-block border-2 border-gray-100">
                          <p className="text-[10px] font-black uppercase text-gray-400">TODAY'S PIN</p>
                          <p className="text-xl font-mono tracking-widest font-bold text-[#FF6B6B]">{dailyCodes[emp.id]}</p>
                        </div>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#A0AEC0] group-hover:text-[#F9D423] group-hover:bg-white shadow-sm transition-colors absolute right-6 top-6">
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
                <div className="flex-1 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-4 mb-1">
                      <h2 className="text-3xl font-black uppercase tracking-wider text-[#2D3436]">{selectedEmployeeData?.name}</h2>
                      <button 
                        onClick={() => selectedEmployeeData && openEditModal(selectedEmployeeData)}
                        className="text-[#A0AEC0] hover:text-[#4ECDC4] transition-colors"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-[#A0AEC0]">
                      Join Date: <span className="text-[#2D3436]">{selectedEmployeeData?.joinDate ? format(new Date(selectedEmployeeData.joinDate), 'PP') : 'N/A'}</span>
                      {' • '}Monthly Salary: <span className="text-[#2D3436]">₹{selectedEmployeeData?.monthlySalary?.toLocaleString() || 0}</span>
                    </p>
                  </div>
                  
                  {selectedEmployeeSalary && (
                    <div className="bg-[#4ECDC4]/10 rounded-2xl p-4 border-2 border-[#4ECDC4]/20 flex items-center gap-4 flex-wrap">
                      <div>
                        <span className="block text-[10px] font-black uppercase text-[#A0AEC0]">Remaining Salary</span>
                        <span className="text-xl font-black text-[#4ECDC4]">₹{selectedEmployeeSalary.remainingSalary.toLocaleString()}</span>
                      </div>
                      <div className="border-l-2 border-gray-200 pl-4">
                        <span className="block text-[10px] font-black uppercase text-[#A0AEC0]">Deductions ({selectedEmployeeSalary.absent} Days Absent)</span>
                        <span className="text-xl font-black text-[#FF6B6B]">₹{selectedEmployeeSalary.deductions.toLocaleString()}</span>
                      </div>
                      <div className="border-l-2 border-gray-200 pl-4">
                        <span className="block text-[10px] font-black uppercase text-[#A0AEC0]">Advance</span>
                        <span className="text-xl font-black text-[#FFB020]">₹{selectedEmployeeSalary.advanceTaken.toLocaleString()}</span>
                      </div>
                      <div className="ml-auto">
                        <button
                          onClick={() => handleSendMonthlyReport(selectedEmployeeData, selectedEmployeeSalary)}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-[#2D3436] font-black rounded-lg border-2 border-[#4ECDC4]/20 hover:bg-[#F0FFF4] transition-colors text-xs uppercase"
                        >
                          <Mail className="w-4 h-4" />
                          Email Report
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-[#FFFCF0] rounded-2xl p-4 border-2 border-[#FFEAA7] flex items-center gap-4">
                    <div>
                      <span className="block text-[10px] font-black uppercase text-[#A0AEC0]">Advance Taken</span>
                      {isEditingAdvance ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input 
                            type="number" 
                            className="bg-white border-2 border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#4ECDC4] w-24 text-sm font-bold text-[#2D3436]"
                            value={editAdvanceInput}
                            onChange={e => setEditAdvanceInput(e.target.value)}
                            placeholder="Amount"
                          />
                          <button 
                            onClick={async () => {
                              const amount = Number(editAdvanceInput);
                              if (!isNaN(amount) && selectedUserId) {
                                await handleUpdateAdvance(selectedUserId, amount);
                                setIsEditingAdvance(false);
                              }
                            }}
                            className="text-[#4ECDC4] bg-white p-1 rounded-md shadow-sm border border-gray-200"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setIsEditingAdvance(false)}
                            className="text-[#FF6B6B] bg-white p-1 rounded-md shadow-sm border border-gray-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-lg font-black text-[#2D3436]">
                            ₹{selectedEmployeeData?.advanceTaken?.toLocaleString() || 0}
                          </span>
                          <button 
                            onClick={() => {
                              setEditAdvanceInput(selectedEmployeeData?.advanceTaken?.toString() || '0');
                              setIsEditingAdvance(true);
                            }}
                            className="text-[#A0AEC0] hover:text-[#4ECDC4] transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-4 mt-8">
                <h3 className="text-xl font-black text-[#2D3436]">Records</h3>
                <button
                  onClick={() => setIsAddingRecord(true)}
                  className="bg-[#4ECDC4] hover:bg-[#26C6DA] text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm text-sm"
                >
                  + Add Past Record
                </button>
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
                        <td className="py-4 font-bold text-sm text-[#2D3436] pr-4">{record.date ? format(new Date(record.date), 'MMM d, yyyy') : record.clockIn ? format(new Date(record.clockIn), 'MMM d, yyyy') : '—'}</td>
                        {record.status === 'absent' ? (
                          <td colSpan={2} className="py-4 font-bold text-sm text-[#FF6B6B] pr-4 text-center uppercase">
                            Absent
                          </td>
                        ) : record.status === 'half-day' ? (
                          <>
                            <td className="py-4 font-bold text-sm text-[#2D3436] pr-4">
                              <span className="text-[10px] font-black text-[#FFB020] uppercase block mb-1">Half Day</span>
                              {record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}
                            </td>
                            <td className="py-4 font-bold text-sm text-[#2D3436] pr-4">{record.clockOut ? format(new Date(record.clockOut), 'h:mm a') : '—'}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-4 font-bold text-sm text-[#4ECDC4] pr-4">
                              <div className="flex items-center gap-2">
                                {record.clockIn ? format(new Date(record.clockIn), 'h:mm a') : '—'}
                                {record.clockInPhoto && (
                                  <button onClick={() => setPreviewPhoto(record.clockInPhoto!)} className="text-[#A0AEC0] hover:text-[#4ECDC4]">
                                    <Camera className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-4 font-bold text-sm text-[#FF6B6B] pr-4">
                              <div className="flex items-center gap-2">
                                {record.clockOut ? format(new Date(record.clockOut), 'h:mm a') : '—'}
                                {record.clockOutPhoto && (
                                  <button onClick={() => setPreviewPhoto(record.clockOutPhoto!)} className="text-[#A0AEC0] hover:text-[#FF6B6B]">
                                    <Camera className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                        <td className="py-4 flex justify-end gap-2 min-w-[100px]">
                          <button onClick={() => startEditing(record)} className="p-2 text-gray-500 hover:text-blue-500 bg-white hover:bg-blue-50 rounded-xl transition-colors shadow-sm">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => record.id && handleDelete(record.id)} className={`p-2 hover:text-red-500 bg-white hover:bg-red-50 rounded-xl transition-colors shadow-sm relative ${confirmDelete === record.id ? 'text-red-500 bg-red-50' : 'text-gray-500'}`}>
                            <Trash2 className="w-4 h-4" />
                            {confirmDelete === record.id && (
                              <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded whitespace-nowrap">Tap again to confirm</span>
                            )}
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
        )}
          </div>
        </main>
      </div>

      {/* Add Past Record Modal */}
      {isAddingRecord && selectedEmployeeData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-[#2D3436]">Add Past Record</h3>
              <button onClick={() => setIsAddingRecord(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddRecord} className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Employee</label>
                <input type="text" disabled value={selectedEmployeeData.name} className="w-full bg-gray-50 rounded-xl p-3 border border-gray-200 text-gray-500 font-medium" />
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Date</label>
                <input 
                  type="date" 
                  value={addRecordDate} 
                  required
                  onChange={e => setAddRecordDate(e.target.value)}
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Status</label>
                <select 
                  value={addRecordStatus}
                  onChange={e => setAddRecordStatus(e.target.value as any)}
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                >
                  <option value="present">Present</option>
                  <option value="half-day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              
              {addRecordStatus !== 'absent' && (
                <>
                  <div>
                    <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Clock In Time</label>
                    <input 
                      type="time" 
                      required
                      value={addRecordClockIn} 
                      onChange={e => setAddRecordClockIn(e.target.value)}
                      className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Clock Out Time (Optional)</label>
                    <input 
                      type="time" 
                      value={addRecordClockOut} 
                      onChange={e => setAddRecordClockOut(e.target.value)}
                      className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setIsAddingRecord(false)}
                  className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSaving}
                  type="submit"
                  className="flex items-center gap-2 px-8 py-3 bg-[#F9D423] text-[#8B6E00] font-black rounded-full hover:bg-[#F1C40F] transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Status</label>
                <select 
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                >
                  <option value="present">Present</option>
                  <option value="half-day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              {editStatus !== 'absent' && (
                <>
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
                </>
              )}
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

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-[#2D3436]">Add Employee</h3>
              <button onClick={() => setShowAddEmployee(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Full Name</label>
                <input 
                  type="text" 
                  value={newEmpName}
                  onChange={e => setNewEmpName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Email Address (Optional)</label>
                <input 
                  type="email" 
                  value={newEmpEmail}
                  onChange={e => setNewEmpEmail(e.target.value)}
                  placeholder="john@gmail.com"
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Phone Number</label>
                <div className="flex">
                  <span className="flex items-center justify-center bg-[#F0FFF4] border-2 border-r-0 border-gray-200 rounded-l-xl px-4 text-sm font-bold text-[#2D3436]">
                    +91
                  </span>
                  <input 
                    type="tel" 
                    value={newEmpPhone}
                    onChange={e => setNewEmpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    required
                    maxLength={10}
                    className="w-full bg-white rounded-r-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Monthly Salary</label>
                <div className="flex">
                  <span className="flex items-center justify-center bg-[#F0FFF4] border-2 border-r-0 border-gray-200 rounded-l-xl px-4 text-sm font-bold text-[#2D3436]">
                    ₹
                  </span>
                  <input 
                    type="number" 
                    value={newEmpSalary}
                    onChange={e => setNewEmpSalary(e.target.value)}
                    placeholder="25000"
                    required
                    min="0"
                    className="w-full bg-white rounded-r-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Join Date (Start Date)</label>
                <input 
                  type="date" 
                  value={newEmpJoinDate}
                  onChange={e => setNewEmpJoinDate(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setShowAddEmployee(false)}
                  className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isAddingEmp || newEmpPhone.length < 10 || !newEmpName}
                  className="flex items-center gap-2 px-8 py-3 bg-[#4ECDC4] text-white font-black rounded-full hover:bg-[#26C6DA] transition-colors shadow-sm disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  {isAddingEmp ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editEmpId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-[#2D3436]">Edit Profile</h3>
              <button onClick={() => setEditEmpId(null)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditEmployee} className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Full Name</label>
                <input 
                  type="text" 
                  value={editEmpName}
                  onChange={e => setEditEmpName(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Email Address (Optional)</label>
                <input 
                  type="email" 
                  value={editEmpEmail}
                  onChange={e => setEditEmpEmail(e.target.value)}
                  placeholder="john@gmail.com"
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Phone Number</label>
                <div className="flex">
                  <span className="flex items-center justify-center bg-[#F0FFF4] border-2 border-r-0 border-gray-200 rounded-l-xl px-4 text-sm font-bold text-[#2D3436]">
                    +91
                  </span>
                  <input 
                    type="tel" 
                    value={editEmpPhone}
                    onChange={e => setEditEmpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    maxLength={10}
                    className="w-full bg-white rounded-r-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Monthly Salary</label>
                <div className="flex">
                  <span className="flex items-center justify-center bg-[#F0FFF4] border-2 border-r-0 border-gray-200 rounded-l-xl px-4 text-sm font-bold text-[#2D3436]">
                    ₹
                  </span>
                  <input 
                    type="number" 
                    value={editEmpSalary}
                    onChange={e => setEditEmpSalary(e.target.value)}
                    required
                    min="0"
                    className="w-full bg-white rounded-r-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#A0AEC0] mb-2 uppercase">Join Date (Start Date)</label>
                <input 
                  type="date" 
                  value={editEmpJoinDate}
                  onChange={e => setEditEmpJoinDate(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl p-3 border-2 border-gray-200 outline-none focus:border-[#4ECDC4] font-bold text-[#2D3436] transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setEditEmpId(null)}
                  className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isEditingEmp || editEmpPhone.length < 10 || !editEmpName}
                  className="flex items-center gap-2 px-8 py-3 bg-[#4ECDC4] text-white font-black rounded-full hover:bg-[#26C6DA] transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isEditingEmp ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-full max-h-full">
            <button 
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-12 right-0 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={previewPhoto} alt="Attendance Capture" className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border-4 border-white object-contain bg-black" />
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all z-[60] ${toast.type === 'error' ? 'bg-[#FF6B6B]' : 'bg-[#4ECDC4]'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
