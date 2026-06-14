import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';

interface Expense {
  id: string;
  amount: number;
  description: string;
  employeeName: string;
  category: string;
  date: string;
  createdAt: string;
}

export default function DailyExpenses({ onClose }: { onClose: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<{id: string, name: string}[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Fetch employees
    const fetchEmployees = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const emps: {id: string, name: string}[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.role !== 'admin') {
            emps.push({ id: doc.id, name: data.name });
          }
        });
        setEmployees(emps);
      } catch (e) {
        console.error("Failed to fetch employees", e);
      }
    };
    fetchEmployees();

    const today = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'expenses'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exps = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Expense))
        .filter(exp => exp.date === today); // purely client side filter for simplicity, avoiding index creation requirement
      setExpenses(exps);
    });
    
    return () => unsubscribe();
  }, []);

  const total = expenses.reduce((sum, current) => sum + current.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!employeeName) {
      setErrorMsg('Please select an employee.');
      return;
    }
    if (!category) {
      setErrorMsg('Please select a category.');
      return;
    }
    if (!amount) {
      setErrorMsg('Please fill out all required fields.');
      return;
    }
    
    setLoading(true);
    try {
      const now = new Date();
      await addDoc(collection(db, 'expenses'), {
        amount: parseFloat(amount),
        description: description || '',
        employeeName,
        category,
        date: format(now, 'yyyy-MM-dd'),
        createdAt: now.toISOString()
      });
      setAmount('');
      setDescription('');
      setCategory('');
      setEmployeeName('');
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Failed to add expense: ' + (e.message || 'Unknown error'));
    }
    setLoading(false);
  };

  return (
    <div id="daily-expenses-modal" className="fixed inset-0 z-[11000] bg-black p-4 md:p-8 flex items-center justify-center animate-in fade-in zoom-in duration-500 pb-20 overflow-y-auto">
      <div className="bg-[#FFFCF0] text-[#2D3436] w-full max-w-2xl rounded-3xl shadow-2xl p-6 md:p-10 relative mt-32">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-2xl font-black text-[#A0AEC0] hover:text-[#FF6B6B]"
        >
          X
        </button>
        
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2 uppercase">Daily Expenses</h1>
        <p className="text-[#A0AEC0] font-bold tracking-widest uppercase mb-8">
          {format(new Date(), 'MMM dd, yyyy')}
        </p>

        <div className="bg-[#2D3436] text-white p-6 rounded-2xl mb-8 flex justify-between items-center shadow-lg">
          <div className="text-[#A0AEC0] font-bold tracking-widest uppercase">Total Spent</div>
          <div className="text-4xl md:text-5xl font-black text-[#F9D423]">₹{total.toFixed(2)}</div>
        </div>

        <form onSubmit={handleSubmit} className="mb-10 space-y-4 bg-white p-6 rounded-2xl border-2 border-gray-100">
          <h2 className="text-xl font-bold tracking-tight mb-4">Add New Expense</h2>
          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold border border-red-200">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#A0AEC0] uppercase tracking-widest mb-1">Employee Name</label>
            <select
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-[#4ECDC4] outline-none appearance-none"
              required
            >
              <option value="" disabled>Select Employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.name}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#A0AEC0] uppercase tracking-widest mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-[#4ECDC4] outline-none appearance-none"
              required
            >
              <option value="" disabled>Select Category</option>
              <option value="Food">Food / Meals</option>
              <option value="Travel">Travel / Transport</option>
              <option value="Materials">Materials / Supplies</option>
              <option value="Shop">Shop Expenses</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#A0AEC0] uppercase tracking-widest mb-1">Amount (₹)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-[#4ECDC4] outline-none"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#A0AEC0] uppercase tracking-widest mb-1">Description</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-[#4ECDC4] outline-none"
              placeholder="What was it for? (Optional)"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#4ECDC4] hover:bg-[#45B7AF] text-white font-black uppercase tracking-widest py-4 rounded-xl mt-4 transition-colors disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Expense'}
          </button>
        </form>

        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Today's Transactions</h2>
          {expenses.length === 0 ? (
            <div className="text-center text-gray-400 py-4 font-bold border-2 border-dashed border-gray-200 rounded-xl">No expenses recorded today</div>
          ) : (
            <div className="space-y-3">
              {expenses.map((exp) => (
                <div key={exp.id} className="bg-white p-4 rounded-xl border-2 border-gray-100 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="font-bold text-lg">{exp.description}</span>
                       {exp.category && (
                         <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full uppercase tracking-wider font-bold">
                           {exp.category}
                         </span>
                       )}
                    </div>
                    <div className="text-[#A0AEC0] text-sm font-bold uppercase tracking-wider">{exp.employeeName}</div>
                  </div>
                  <div className="font-black text-xl text-[#FF6B6B]">-₹{exp.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
