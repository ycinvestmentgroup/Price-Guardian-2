import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  TrendingUp, 
  TrendingDown,
  History,
  CheckCircle2,
  Package,
  Wallet,
  FileDown,
  PlusCircle,
  Check,
  ShoppingBag,
  Trash2,
  Phone,
  Banknote,
  CalendarDays,
  X,
  Zap,
  Menu,
  ShieldCheck,
  Info,
  TriangleAlert,
  Files,
  Target
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// FIXED: Corrected path from './services/geminiService.ts' to './geminiService.ts'
import { extractInvoiceData } from './geminiService.ts';
import { Invoice, User, InvoiceItem } from './types.ts';

const DEFAULT_USER: User = {
  id: 'admin-001',
  name: 'Master Auditor',
  email: 'admin@priceguardian.ai',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  role: 'Senior Procurement Auditor',
  organization: 'Acme Supply Chain Solutions',
  lastLogin: new Date().toLocaleString(),
  is2FAEnabled: true
};

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'history' | 'suppliers' | 'items' | 'gst' | 'profile'>('dashboard');
  const [historyTab, setHistoryTab] = useState<'outstanding' | 'settled' | 'hold'>('outstanding');
  const [rawInvoices, setRawInvoices] = useState<Invoice[]>([]);
  const [priceBaselines, setPriceBaselines] = useState<Record<string, Record<string, number>>>({}); 
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [user] = useState<User>(DEFAULT_USER);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const savedInvoices = localStorage.getItem('pg_invoices');
    const savedBaselines = localStorage.getItem('pg_baselines');
    if (savedInvoices) setRawInvoices(JSON.parse(savedInvoices));
    if (savedBaselines) setPriceBaselines(JSON.parse(savedBaselines));
  }, []);

  useEffect(() => {
    localStorage.setItem('pg_invoices', JSON.stringify(rawInvoices));
    localStorage.setItem('pg_baselines', JSON.stringify(priceBaselines));
  }, [rawInvoices, priceBaselines]);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const enrichedInvoices = useMemo(() => {
    return rawInvoices.map((inv) => {
      const itemsWithVariances = inv.items.map((item) => {
        const baseline = priceBaselines[inv.supplierName]?.[item.name];
        const diff = baseline !== undefined ? item.unitPrice - baseline : 0;
        const pct = baseline ? (diff / baseline) * 100 : 0;

        return {
          ...item,
          previousUnitPrice: baseline,
          priceChange: diff,
          percentChange: pct,
        } as InvoiceItem;
      });

      let status: Invoice['status'] = 'matched';
      const hasIncrease = itemsWithVariances.some(i => (i.priceChange || 0) > 0.01);
      const hasDecrease = itemsWithVariances.some(i => (i.priceChange || 0) < -0.01);

      if (hasIncrease && hasDecrease) status = 'mixed';
      else if (hasIncrease) status = 'price_increase';
      else if (hasDecrease) status = 'price_decrease';

      return { ...inv, items: itemsWithVariances, status };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawInvoices, priceBaselines]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    const fileArray: File[] = Array.from(files);
    
    for (const file of fileArray) {
      setUploadProgress(`Auditing ${file.name}...`);
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        const data = await extractInvoiceData(base64, file.type);
        
        const newInvoice: Invoice = {
          ...data,
          id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          isPaid: false,
          isHold: false,
          status: 'matched',
          fileName: file.name
        };

        setPriceBaselines(prev => {
          const supplierBaselines = { ...(prev[data.supplierName] || {}) };
          let changed = false;
          data.items.forEach((item: { name: string; unitPrice: number }) => {
            if (supplierBaselines[item.name] === undefined) {
              supplierBaselines[item.name] = item.unitPrice;
              changed = true;
            }
          });
          return changed ? { ...prev, [data.supplierName]: supplierBaselines } : prev;
        });

        setRawInvoices(prev => [newInvoice, ...prev]);
        addToast(`Processed ${file.name}`, 'success');
      } catch (err) {
        addToast(`Failed to audit ${file.name}`, 'error');
        console.error(err);
      }
    }

    setLoading(false);
    setUploadProgress('');
    setActiveTab('history');
  };

  const handleUpdateBaseline = (supplier: string, item: string, newPrice: number) => {
    setPriceBaselines(prev => ({
      ...prev,
      [supplier]: { ...prev[supplier], [item]: newPrice }
    }));
    addToast(`Master rate updated`, 'success');
  };

  const deleteInvoice = (id: string) => {
    if (confirm("Discard this audit?")) {
      setRawInvoices(prev => prev.filter(i => i.id !== id));
      setSelectedInvoiceId(null);
    }
  };

  const stats = useMemo(() => {
    const unpaid = enrichedInvoices.filter(i => !i.isPaid && !i.isHold);
    const totalPayable = unpaid.reduce((sum, i) => sum + i.totalAmount, 0);
    const variances = enrichedInvoices.filter(i => (i.status === 'price_increase' || i.status === 'mixed') && !i.isPaid).length;
    return { totalPayable, variances, totalCount: enrichedInvoices.length };
  }, [enrichedInvoices]);

  const NavItem = ({ id, icon: Icon, label, alertCount }: any) => (
    <button 
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
      className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all ${activeTab === id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      <Icon size={20} />
      <span className="font-bold text-sm tracking-tight">{label}</span>
      {alertCount > 0 && <span className="ml-auto bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold">{alertCount}</span>}
    </button>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Toast Notifications */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] space-y-2 w-full max-w-sm px-4">
         {toasts.map(t => (
           <div key={t.id} className={`p-4 rounded-2xl shadow-2xl border flex items-center space-x-3 animate-in slide-in-from-top ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
              <Info size={18}/>
              <span className="text-xs font-bold uppercase">{t.message}</span>
           </div>
         ))}
      </div>

      {/* Navigation */}
      <nav className={`w-72 bg-slate-900 flex flex-col fixed inset-y-0 left-0 lg:sticky lg:top-0 h-screen z-[100] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"><ShieldCheck size={24} /></div>
            <span className="text-xl font-black text-white uppercase tracking-tighter">Guardian</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white"><X size={20}/></button>
        </div>

        <div className="flex-1 px-4 space-y-2">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Audit Pulse" />
          <NavItem id="upload" icon={Upload} label="Ingest PDF" />
          <NavItem id="history" icon={History} label="Audit Logs" alertCount={stats.variances} />
          <NavItem id="items" icon={ShoppingBag} label="Master Rates" />
          <NavItem id="suppliers" icon={Package} label="Vendors" />
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-6 lg:p-12 h-screen">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{activeTab}</h1>
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-white rounded-xl shadow-sm border border-slate-200"><Menu size={24} /></button>
        </header>

        {activeTab === 'dashboard' && (
           <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Audit Liability" value={`$${stats.totalPayable.toLocaleString()}`} icon={Wallet} color="blue" />
                <StatCard label="Price Variances" value={stats.variances} icon={TriangleAlert} color="amber" />
                <StatCard label="Total Documents" value={stats.totalCount} icon={Files} color="slate" />
              </div>
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <h3 className="font-black text-slate-900 uppercase mb-6">High Risk Variances</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enrichedInvoices.filter(i => i.status === 'price_increase').map(inv => (
                    <div key={inv.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer" onClick={() => setSelectedInvoiceId(inv.id)}>
                      <AuditBadge status={inv.status} />
                      <p className="font-black text-slate-900 mt-2 uppercase truncate">{inv.supplierName}</p>
                      <p className="text-sm font-bold text-slate-900 mt-4">${inv.totalAmount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
           </div>
        )}

        {activeTab === 'upload' && <UploadView handleFileUpload={handleFileUpload} loading={loading} progress={uploadProgress} />}
        
        {/* ... Additional Tab Views (History, Items, etc.) would follow the same pattern ... */}
      </main>

      {selectedInvoiceId && (
        <InvoiceDetailModal 
          invoice={enrichedInvoices.find(i => i.id === selectedInvoiceId)!} 
          onClose={() => setSelectedInvoiceId(null)} 
          onDelete={deleteInvoice}
          onUpdateBaseline={handleUpdateBaseline}
        />
      )}

      {loading && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-6">
           <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
           <p className="text-sm font-bold uppercase tracking-widest">{uploadProgress}</p>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', slate: 'bg-slate-50 text-slate-600' };
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}><Icon size={24} /></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <h3 className="text-2xl font-black text-slate-900">{value}</h3>
    </div>
  );
};

const AuditBadge = ({ status }: any) => {
  const config = {
    matched: { bg: 'bg-emerald-50 text-emerald-700', text: 'Verified' },
    price_increase: { bg: 'bg-rose-50 text-rose-700', text: 'Hike Warning' }
  }[status as 'matched' | 'price_increase'] || { bg: 'bg-slate-50 text-slate-700', text: 'Audit' };
  return <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${config.bg}`}>{config.text}</span>;
};

const InvoiceDetailModal = ({ invoice, onClose, onDelete, onUpdateBaseline }: any) => (
  <div className="fixed inset-0 z-[200] flex justify-end">
    <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
    <div className="relative w-full max-w-xl bg-white h-full shadow-2xl p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black uppercase tracking-tighter">Audit Review</h2>
        <button onClick={onClose}><X size={24}/></button>
      </div>
      <div className="space-y-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Vendor</p>
          <p className="text-xl font-black">{invoice.supplierName}</p>
        </div>
        <div className="space-y-4">
          {invoice.items.map((item: any) => (
            <div key={item.name} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
              <div>
                <p className="font-black text-sm uppercase">{item.name}</p>
                <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
              </div>
              <div className="text-right">
                <p className="font-black">${item.unitPrice.toFixed(2)}</p>
                {item.priceChange > 0 && <p className="text-[10px] font-bold text-rose-600">+${item.priceChange.toFixed(2)} Spike</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const UploadView = ({ handleFileUpload }: any) => (
  <div className="max-w-xl mx-auto py-20 text-center">
    <label className="cursor-pointer block border-4 border-dashed border-slate-200 rounded-[3rem] p-20 hover:border-blue-500 transition-all">
      <Upload size={48} className="mx-auto text-slate-300 mb-4" />
      <p className="text-slate-400 font-bold uppercase text-xs">Drop Invoices or Click to Browse</p>
      <input type="file" className="hidden" onChange={handleFileUpload} accept="application/pdf" multiple />
    </label>
  </div>
);

export default App;
