import React, { useState, useEffect } from 'react';
import { Search, X, PackageSearch, Box, Filter, Activity, ArrowLeft, Clock } from 'lucide-react';
import Markdown from 'react-markdown';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProductCatalogFlowProps {
  onClose: () => void;
}

const INITIAL_BRANDS = [
  'Haier', 'Onida', 'LG', 'Daikin', 'Mitsubishi', 
  'Lloyd', 'Godrej', 'Hitachi', 'Amstrad', 'Panasonic'
];

const PRODUCT_TYPES = [
  'Air Conditioner (AC)', 'Refrigerator', 'Washing Machine', 'Microwave Owen',
  'Television', 'Laptop', 'Smartphone', 'Headphones', 'Camera'
];

const DYNAMIC_FILTERS: Record<string, { label: string, options: string[] }[]> = {
  'Air Conditioner (AC)': [
    { label: 'Cooling Capacity', options: ['1 Ton', '1.5 Ton', '2 Ton', '2.5+ Ton'] },
    { label: 'Energy Stars', options: ['3 Stars', '4 Stars', '5 Stars'] },
    { label: 'Type', options: ['Split AC', 'Window AC', 'Inverter'] }
  ],
  'Refrigerator': [
    { label: 'Capacity', options: ['Below 200L', '200L - 300L', '300L - 400L', '400L+'] },
    { label: 'Door Type', options: ['Single Door', 'Double Door', 'Side by Side'] }
  ],
  'Washing Machine': [
    { label: 'Weight', options: ['6 KG', '7 KG', '8 KG', '9+ KG'] },
    { label: 'Type', options: ['Front Load', 'Top Load', 'Fully Automatic', 'Semi Automatic'] }
  ],
  'Television': [
    { label: 'Screen Size', options: ['32 Inch', '43 Inch', '55 Inch', '65+ Inch'] },
    { label: 'Resolution', options: ['HD Ready', 'Full HD', '4K UHD', '8K'] },
    { label: 'Panel Type', options: ['LED', 'OLED', 'QLED'] }
  ],
  'Laptop': [
    { label: 'Processor', options: ['Core i3', 'Core i5', 'Core i7', 'Core i9', 'AMD Ryzen'] },
    { label: 'RAM', options: ['8 GB', '16 GB', '32+ GB'] },
    { label: 'Weight', options: ['Under 1.5 KG', '1.5 - 2 KG', 'Over 2 KG'] }
  ],
  'Smartphone': [
    { label: 'Storage', options: ['64 GB', '128 GB', '256 GB', '512+ GB'] },
    { label: 'RAM', options: ['4 GB', '6 GB', '8 GB', '12+ GB'] }
  ],
  'Microwave Owen': [
    { label: 'Type', options: ['Solo', 'Grill', 'Convection'] },
    { label: 'Capacity', options: ['Below 20L', '20L - 25L', '25L+'] }
  ],
  'Camera': [
    { label: 'Type', options: ['DSLR', 'Mirrorless', 'Point & Shoot'] },
    { label: 'Weight', options: ['Under 500g', '500g - 1kg', 'Heavy'] }
  ],
  'Headphones': [
    { label: 'Type', options: ['Over-Ear', 'On-Ear', 'In-Ear', 'TWS'] },
    { label: 'Weight', options: ['Ultra Light', 'Standard', 'Heavy'] }
  ]
};

const DEFAULT_FILTERS = [
  { label: 'Price Range', options: ['Budget', 'Mid-Range', 'Premium'] },
  { label: 'Size', options: ['Small', 'Medium', 'Large'] }
];

interface SearchResultProduct {
  model: string;
  overview: string;
  imageUrl: string;
  specs: string[];
  details: string;
}

interface SearchResult {
  products: SearchResultProduct[];
}

interface CatalogHistoryItem {
  id: string; // unique hash
  brand: string;
  productType: string;
  sortBy: string;
  filterStr: string;
  result: SearchResult | null;
  timestamp: number;
}

type Step = 'BRAND' | 'TYPE' | 'CATALOG';

export default function ProductCatalogFlow({ onClose }: ProductCatalogFlowProps) {
  const [step, setStep] = useState<Step>('BRAND');
  
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  
  // Filters for Step 3
  const [sortBy, setSortBy] = useState<string>('');
  const [dynamicFilterValues, setDynamicFilterValues] = useState<Record<string, string>>({});

  const [history, setHistory] = useState<CatalogHistoryItem[]>([]);
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // Custom Brands State
  const [brands, setBrands] = useState<string[]>(INITIAL_BRANDS);
  
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const docRef = doc(db, 'config', 'catalogBrands');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().brands) {
          const dbBrands = docSnap.data().brands;
          // Auto migrate if the old default 'Sony' is still the first item
          if (dbBrands.length > 0 && dbBrands[0] === 'Sony' && !dbBrands.includes('Haier')) {
            setBrands(INITIAL_BRANDS);
          } else {
            setBrands(dbBrands);
          }
        }
      } catch (err) {
        console.error('Failed to fetch brands from firestore:', err);
      }
    };

    fetchBrands();
    const interval = setInterval(fetchBrands, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const h = localStorage.getItem('catalogHistory');
    if (h) {
      try { setHistory(JSON.parse(h)); } catch(e){}
    }
  }, []);

  const saveHistory = (newItem: CatalogHistoryItem) => {
    let currentHist = [...history];
    currentHist = currentHist.filter(x => !(x.brand === newItem.brand && x.productType === newItem.productType));
    const updated = [newItem, ...currentHist].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('catalogHistory', JSON.stringify(updated));
  };

  const handleBrandSelect = (b: string) => {
    setSelectedBrand(b);
    setStep('TYPE');
  };

  const handleTypeSelect = (t: string) => {
    setSelectedType(t);
    setStep('CATALOG');
    setDynamicFilterValues({});
    setSortBy('');
    setShowFilters(true);
    fetchCatalog(b => b, t, '', {}); // init search with defaults
  };

  const fetchCatalog = async (brandArg: string | ((b: string) => string), typeArg: string, sortArg: string, filtersArg: Record<string, string>) => {
    const actualBrand = typeof brandArg === 'string' ? brandArg : selectedBrand;
    setLoading(true);
    setError(null);
    setResult(null);

    const filterParts = Object.entries(filtersArg)
      .filter(([_, v]) => v !== '')
      .map(([k, v]) => `${k}: ${v}`);
    const finalFilterStr = filterParts.join(', ');

    const filterId = `${actualBrand}-${typeArg}-${sortArg}-${finalFilterStr}`;

    const existing = history.find(h => h.id === filterId);
    if (existing) {
       setResult(existing.result);
       saveHistory({...existing, timestamp: Date.now()});
       setLoading(false);
       return;
    }

    try {
      const response = await fetch('/api/search-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brand: actualBrand, 
          productType: typeArg,
          sortBy: sortArg,
          filter: finalFilterStr
        })
      });

      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch(e) {
        throw new Error('Server returned invalid json. Try again.');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to search product');
      }

      setResult(data.result);
      saveHistory({
        id: filterId,
        brand: actualBrand,
        productType: typeArg,
        sortBy: sortArg,
        filterStr: finalFilterStr,
        result: data.result,
        timestamp: Date.now()
      });
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError("Network connection issue. Please make sure you are connected to the internet and try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setShowFilters(false);
    fetchCatalog(selectedBrand, selectedType, sortBy, dynamicFilterValues);
  };

  const loadHistoryItem = (item: CatalogHistoryItem) => {
    setSelectedBrand(item.brand);
    setSelectedType(item.productType);
    setSortBy(item.sortBy);
    
    // Parse filterStr back to dynamicFilterValues
    const newDynamicValues: Record<string, string> = {};
    if (item.filterStr) {
      item.filterStr.split(', ').forEach(part => {
         const [k, v] = part.split(': ');
         if (k && v) newDynamicValues[k] = v;
      });
    }
    setDynamicFilterValues(newDynamicValues);
    
    setResult(item.result);
    setStep('CATALOG');
    setShowFilters(false);
    setExpandedModel(null);
    setLoading(false);
    setError(null);
    saveHistory({...item, timestamp: Date.now()});
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('catalogHistory');
  };

  const activeFiltersDef = DYNAMIC_FILTERS[selectedType] || DEFAULT_FILTERS;

  return (
    <div className="fixed inset-0 z-[10000] bg-[#FFFCF0] flex flex-col animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="h-20 shrink-0 bg-white border-b-4 border-[#2D3436] flex items-center justify-between px-6 lg:px-12 shadow-sm relative z-30">
        <div className="flex items-center gap-4">
           {step !== 'BRAND' && (
             <button 
                onClick={() => {
                   if (step === 'CATALOG') setStep('TYPE');
                   else if (step === 'TYPE') setStep('BRAND');
                }}
                className="w-10 h-10 bg-gray-100 hover:bg-[#F9D423] hover:text-[#8B6E00] rounded-[12px] flex items-center justify-center text-[#2D3436] transition-colors"
             >
                <ArrowLeft className="w-5 h-5"/>
             </button>
           )}
           <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#2D3436] uppercase tracking-tighter flex items-center gap-3">
             <Search className="w-6 h-6 sm:w-8 sm:h-8 text-[#4ECDC4] shrink-0" /> 
             <span className="truncate max-w-[200px] sm:max-w-none">
               {step === 'BRAND' ? 'Explore Brands' : step === 'TYPE' ? `${selectedBrand} - Category` : `${selectedBrand} ${selectedType}`}
             </span>
           </h1>
        </div>
        <div className="flex items-center gap-3">
           {step === 'CATALOG' && !showFilters && (
             <button 
               onClick={() => setShowFilters(true)}
               className="w-10 h-10 sm:w-12 sm:h-12 bg-white border-2 border-gray-200 hover:border-[#4ECDC4] hover:bg-[#E6F8F6] hover:text-[#4ECDC4] rounded-[16px] flex items-center justify-center text-[#2D3436] transition-all font-bold shrink-0"
             >
               <Filter className="w-5 h-5 sm:w-6 sm:h-6" />
             </button>
           )}
           <button 
             onClick={onClose}
             className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 hover:bg-[#FF6B6B] hover:text-white rounded-[16px] flex items-center justify-center text-[#2D3436] transition-colors font-bold shrink-0"
           >
             <X className="w-6 h-6 sm:w-7 sm:h-7" />
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Universal History Sidebar */}
        <div className="w-72 lg:w-80 shrink-0 bg-white border-r-4 border-gray-200 flex flex-col h-full z-20 hidden md:flex shadow-xl shadow-gray-200/50">
          <div className="p-6 bg-gray-50 border-b-2 border-gray-100 shrink-0 flex items-center justify-between">
             <h2 className="font-black text-[#2D3436] uppercase tracking-widest flex items-center gap-2">
               <Clock className="w-5 h-5 text-[#FF6B6B]"/> Recent Logs
             </h2>
             {history.length > 0 && (
               <button onClick={clearHistory} className="text-xs font-bold text-gray-400 hover:text-[#FF6B6B] uppercase tracking-wider transition-colors">
                 Clear
               </button>
             )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
             {history.length ? history.map(item => {
               const isActive = step === 'CATALOG' && selectedBrand === item.brand && selectedType === item.productType && result === item.result;
               return (
                 <button 
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${
                       isActive 
                         ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 shadow-sm' 
                         : 'border-gray-100 hover:border-[#2D3436] bg-white'
                    }`}
                 >
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 transition-colors ${isActive ? 'text-[#4ECDC4]' : 'text-[#A0AEC0] group-hover:text-gray-500'}`}>
                      {item.brand} • {item.productType}
                    </div>
                    {item.filterStr ? (
                       <div className="font-bold text-[#2D3436] text-sm leading-tight text-wrap">{item.filterStr}</div>
                    ) : (
                       <div className="font-bold text-[#2D3436] text-sm">Default Scan</div>
                    )}
                    {item.sortBy && (
                       <div className="text-xs font-semibold text-gray-400 mt-2 border-t border-gray-200/50 pt-1">Sort: {item.sortBy}</div>
                    )}
                 </button>
               )
             }) : (
               <div className="text-center text-sm font-bold text-gray-400 mt-10 p-6 border-4 border-dashed border-gray-100 rounded-[24px]">
                 Recent catalogs will appear here.
               </div>
             )}
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 flex flex-col bg-[#FFFCF0] relative overflow-y-auto">
          {step === 'BRAND' && (
             <div className="max-w-6xl mx-auto p-6 md:p-12 animate-in slide-in-from-bottom-4 duration-500 w-full">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {brands.length ? brands.map(b => (
                    <div key={b} className="relative group">
                       <button
                          onClick={() => handleBrandSelect(b)}
                          className="w-full aspect-square bg-white border-4 border-gray-100 hover:border-[#4ECDC4] rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all hover:-translate-y-2 hover:shadow-[0_8px_0_0_#4ECDC4]"
                       >
                          <div className="w-16 h-16 bg-white overflow-hidden rounded-full flex items-center justify-center transition-colors shadow-sm border border-gray-100 p-2">
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
                          <span className="font-black text-lg md:text-xl text-[#2D3436] uppercase tracking-wider px-4 text-center line-clamp-2">{b}</span>
                       </button>
                    </div>
                  )) : (
                     <div className="col-span-full py-12 text-center flex flex-col items-center">
                        <PackageSearch className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-xl font-black text-gray-400">NO BRANDS REGISTERED</h3>
                     </div>
                  )}
                </div>
             </div>
          )}

          {step === 'TYPE' && (
             <div className="max-w-6xl mx-auto p-6 md:p-12 animate-in slide-in-from-right-8 duration-500 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {PRODUCT_TYPES.map(t => (
                    <button
                       key={t}
                       onClick={() => handleTypeSelect(t)}
                       className="bg-white border-4 border-gray-100 hover:border-[#F9D423] p-8 rounded-[32px] flex flex-col items-center justify-center gap-4 group transition-all hover:-translate-y-2 hover:shadow-[0_8px_0_0_#F9D423]"
                    >
                       <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-[#FFF9E6] transition-colors">
                          <Activity className="w-10 h-10 text-gray-400 group-hover:text-[#D4B200]" />
                       </div>
                       <span className="font-black text-xl text-[#2D3436] uppercase tracking-wider text-center">{t}</span>
                    </button>
                  ))}
                </div>
             </div>
          )}

          {step === 'CATALOG' && (
             <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
               {/* Filter Bar */}
               {showFilters && (
                 <div className="shrink-0 bg-white border-b-4 border-gray-200 p-6 shadow-sm z-10 w-full animate-in fade-in slide-in-from-top-2 duration-300">
                    <form onSubmit={handleApplyFilters} className="max-w-6xl mx-auto flex flex-col xl:flex-row gap-4 items-end">
                       <div className="flex-1 w-full flex flex-wrap gap-4">
                         <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-black text-[#A0AEC0] uppercase tracking-widest mb-2">
                               Sort By
                            </label>
                            <div className="relative">
                              <select 
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-4 border-gray-100 font-bold text-[#2D3436] outline-none focus:border-[#4ECDC4] appearance-none cursor-pointer bg-white"
                              >
                                 <option value="">Default Relevance</option>
                                 <option value="Weight (Lowest to Highest)">Weight (Lightest First)</option>
                                 <option value="Weight (Highest to Lowest)">Weight (Heaviest First)</option>
                                 <option value="Cooling Capacity (Highest to Lowest)">Capacity (Highest First)</option>
                                 <option value="Energy Stars (Highest to Lowest)">Energy Stars (Highest First)</option>
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <span className="text-gray-400 text-xs text-bold">▼</span>
                              </div>
                            </div>
                         </div>
                         {activeFiltersDef.map(f => (
                           <div key={f.label} className="flex-1 min-w-[200px]">
                              <label className="block text-xs font-black text-[#A0AEC0] uppercase tracking-widest mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
                                 {f.label}
                              </label>
                              <div className="relative">
                                <select 
                                  value={dynamicFilterValues[f.label] || ''}
                                  onChange={(e) => setDynamicFilterValues(prev => ({ ...prev, [f.label]: e.target.value }))}
                                  className="w-full px-4 py-3 rounded-xl border-4 border-gray-100 font-bold text-[#2D3436] outline-none focus:border-[#4ECDC4] appearance-none cursor-pointer bg-white"
                                >
                                   <option value="">Any</option>
                                   {f.options.map(opt => (
                                     <option key={opt} value={opt}>{opt}</option>
                                   ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <span className="text-gray-400 text-xs text-bold">▼</span>
                                </div>
                              </div>
                           </div>
                         ))}
                       </div>
                       <button 
                         type="submit"
                         disabled={loading}
                         className="w-full xl:w-48 shrink-0 py-3 bg-[#2D3436] disabled:bg-gray-200 text-white rounded-xl font-black tracking-widest uppercase shadow-[0_4px_0_0_#000] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
                       >
                         {loading ? 'APPLYING...' : <><Filter className="w-5 h-5"/> APPLY</>}
                       </button>
                    </form>
                 </div>
               )}

               {/* Results */}
               <div className="flex-1 overflow-y-auto p-6 md:p-12 relative">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6 min-h-[300px]">
                      <div className="relative">
                        <Box className="w-24 h-24 animate-bounce text-[#F9D423]" />
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-3 bg-black/10 rounded-[50%] blur-sm animate-pulse"></div>
                      </div>
                      <p className="font-black text-xl uppercase tracking-widest text-[#2D3436] animate-pulse">
                        Generating Catalog...
                      </p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center text-[#FF6B6B] space-y-4 text-center mt-20">
                      <div className="w-24 h-24 bg-[#FF6B6B]/10 rounded-[40px] flex items-center justify-center transform rotate-12">
                        <X className="w-12 h-12" />
                      </div>
                      <p className="font-black text-3xl uppercase tracking-tight text-[#2D3436] mt-6">Failed</p>
                      <p className="font-bold text-gray-500 uppercase max-w-md">{error}</p>
                    </div>
                  ) : result && result.products ? (
                    <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-12 w-full">
                       {result.products.map((product, idx) => {
                          const isExpanded = expandedModel === product.model;
                          return (
                            <div 
                              key={idx}
                              onClick={() => setExpandedModel(isExpanded ? null : product.model)}
                              className={`bg-white rounded-[40px] shadow-2xl shadow-gray-200 border-b-8 border-r-8 border-[#4ECDC4] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col ${!isExpanded ? 'hover:-translate-y-2' : ''}`}
                            >
                               <div className={`p-8 flex ${isExpanded ? 'flex-col md:flex-row' : 'flex-col sm:flex-row'} gap-6 md:gap-8 items-start h-full`}>
                                  {product.imageUrl && (
                                    <div className={`shrink-0 bg-gray-50 rounded-[32px] overflow-hidden border-4 border-gray-100 flex items-center justify-center ${isExpanded ? 'w-full md:w-80 h-80' : 'w-full sm:w-48 h-48'}`}>
                                       <img src={product.imageUrl} alt={product.model} className="w-full h-full object-contain mix-blend-multiply" onError={(e) => e.currentTarget.style.display = 'none'} />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 flex flex-col justify-center w-full">
                                     <div className="self-start px-4 py-2 bg-[#E6F8F6] text-[#4ECDC4] rounded-xl font-black text-sm uppercase tracking-widest mb-4">
                                       {product.model}
                                     </div>
                                     <h2 className="text-2xl font-black text-[#2D3436] uppercase tracking-tight leading-none mb-4">{product.model}</h2>
                                     <p className="text-gray-500 font-bold mb-6 line-clamp-3">{product.overview}</p>
                                     <div className="space-y-3 mb-6">
                                       {product.specs.slice(0, isExpanded ? undefined : 4).map((spec, i) => (
                                          <div key={i} className="flex items-start gap-2 text-sm font-semibold text-[#2D3436]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#F9D423] mt-1.5 shrink-0" />
                                            {spec}
                                          </div>
                                       ))}
                                     </div>
                                     {isExpanded && product.details && (
                                       <div className="mt-4 pt-6 border-t-2 border-gray-100 text-gray-500 font-bold leading-relaxed whitespace-pre-wrap">
                                         {product.details}
                                       </div>
                                     )}
                                     {!isExpanded && (
                                        <div className="text-xs font-black text-[#4ECDC4] uppercase tracking-widest flex items-center gap-2 mt-auto pt-4">
                                          Tap for Details <ArrowLeft className="w-4 h-4 rotate-180" />
                                        </div>
                                     )}
                                  </div>
                               </div>
                            </div>
                          )
                       })}
                    </div>
                  ) : null}
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
