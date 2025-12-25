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

// FIXED: Import without .ts extension
import { extractInvoiceData } from './geminiService';
import { Invoice, User, InvoiceItem } from './types';

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

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex space-x-4 mb-6">
              <button 
                className={`px-6 py-3 rounded-2xl font-bold text-sm uppercase ${historyTab === 'outstanding' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}
                onClick={() => setHistoryTab('outstanding')}
              >
                Outstanding
              </button>
              <button 
                className={`px-6 py-3 rounded-2xl font-bold text-sm uppercase ${historyTab === 'settled' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}
                onClick={() => setHistoryTab('settled')}
              >
                Settled
              </button>
              <button 
                className={`px-6 py-3 rounded-2xl font-bold text-sm uppercase ${historyTab === 'hold' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}
                onClick={() => setHistoryTab('hold')}
              >
                On Hold
              </button>
            </div>
            
            <div className="bg-white rounded-3xl p-6 border border-slate-200">
              <div className="space-y-4">
                {enrichedInvoices
                  .filter(inv => {
                    if (historyTab === 'outstanding') return !inv.isPaid && !inv.isHold;
                    if (historyTab === 'settled') return inv.isPaid;
                    if (historyTab === 'hold') return inv.isHold;
                    return true;
                  })
                  .map(inv => (
                    <div key={inv.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <AuditBadge status={inv.status} />
                          <span className="font-black text-sm uppercase">{inv.supplierName}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">#{inv.invoiceNumber} • {inv.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black">${inv.totalAmount.toFixed(2)}</p>
                        <div className="flex space-x-2 mt-2">
                          <button 
                            className="text-xs font-bold text-blue-600 uppercase"
                            onClick={() => setSelectedInvoiceId(inv.id)}
                          >
                            Review
                          </button>
                          <button 
                            className="text-xs font-bold text-rose-600 uppercase"
                            onClick={() => deleteInvoice(inv.id)}
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200">
            <h3 className="font-black text-slate-900 uppercase mb-6">Master Price Registry</h3>
            <div className="space-y-4">
              {Object.entries(priceBaselines).map(([supplier, items]) => (
                <div key={supplier} className="mb-8">
                  <h4 className="font-black text-lg text-slate-900 mb-4">{supplier}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(items).map(([item, price]) => (
                      <div key={item} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="font-bold text-sm uppercase truncate">{item}</p>
                        <p className="text-2xl font-black text-slate-900 mt-2">${price.toFixed(2)}</p>
                        <div className="flex space-x-2 mt-3">
                          <input
                            type="number"
                            step="0.01"
                            className="flex-1 p-2 text-sm border border-slate-200 rounded-lg"
                            placeholder="Update price"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                const newPrice = parseFloat(input.value);
                                if (!isNaN(newPrice) && newPrice > 0) {
                                  handleUpdateBaseline(supplier, item, newPrice);
                                  input.value = '';
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200">
            <h3 className="font-black text-slate-900 uppercase mb-6">Vendor Intelligence</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from(new Set(enrichedInvoices.map(inv => inv.supplierName))).map(supplier => {
                const supplierInvoices = enrichedInvoices.filter(inv => inv.supplierName === supplier);
                const totalSpent = supplierInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
                const varianceCount = supplierInvoices.filter(inv => inv.status === 'price_increase' || inv.status === 'mixed').length;
                
                return (
                  <div key={supplier} className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4">
                      <Package size={24} />
                    </div>
                    <h4 className="font-black text-lg uppercase">{supplier}</h4>
                    <p className="text-slate-400 text-sm mt-1">{supplierInvoices.length} transactions</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Total Spend</span>
                        <span className="font-bold">${totalSpent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Variances</span>
                        <span className={`font-bold ${varianceCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{varianceCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
    price_increase: { bg: 'bg-rose-50 text-rose-700', text: 'Hike Warning' },
    price_decrease: { bg: 'bg-blue-50 text-blue-700', text: 'Price Drop' },
    mixed: { bg: 'bg-amber-50 text-amber-700', text: 'Mixed' }
  }[status as 'matched' | 'price_increase' | 'price_decrease' | 'mixed'] || { bg: 'bg-slate-50 text-slate-700', text: 'Audit' };
  return <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${config.bg}`}>{config.text}</span>;
};

const InvoiceDetailModal = ({ invoice, onClose, onDelete, onUpdateBaseline }: any) => {
  if (!invoice) return null;
  
  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Audit Review</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={24}/></button>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Vendor</p>
              <p className="text-xl font-black">{invoice.supplierName}</p>
            </div>
            <AuditBadge status={invoice.status} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Invoice #</p>
              <p className="text-lg font-bold">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Date</p>
              <p className="text-lg font-bold">{invoice.date}</p>
            </div>
          </div>
          
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Items</p>
            <div className="space-y-3">
              {invoice.items.map((item: InvoiceItem, index: number) => (
                <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-sm uppercase">{item.name}</p>
                      <p className="text-xs text-slate-400">Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">${item.total.toFixed(2)}</p>
                      {item.previousUnitPrice && item.priceChange && item.priceChange !== 0 && (
                        <p className={`text-[10px] font-bold ${item.priceChange > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {item.priceChange > 0 ? '+' : ''}${Math.abs(item.priceChange).toFixed(2)} ({item.percentChange?.toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {item.previousUnitPrice && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Previous rate:</span>
                        <span className="font-bold">${item.previousUnitPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex space-x-2 mt-2">
                        <input
                          type="number"
                          step="0.01"
                          className="flex-1 p-2 text-sm border border-slate-200 rounded-lg"
                          placeholder="Update master rate"
                          defaultValue={item.previousUnitPrice}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              const newPrice = parseFloat(input.value);
                              if (!isNaN(newPrice) && newPrice > 0) {
                                onUpdateBaseline(invoice.supplierName, item.name, newPrice);
                              }
                            }
                          }}
                        />
                        <button 
                          className="px-3 py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded-lg"
                          onClick={() => onUpdateBaseline(invoice.supplierName, item.name, item.unitPrice)}
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-2xl">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase">Total Amount</p>
                <p className="text-2xl font-black text-blue-900">${invoice.totalAmount.toFixed(2)}</p>
              </div>
              {invoice.gstAmount && (
                <div className="text-right">
                  <p className="text-[10px] font-black text-blue-600 uppercase">GST</p>
                  <p className="text-lg font-bold text-blue-900">${invoice.gstAmount.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex space-x-3 pt-6 border-t border-slate-200">
            <button 
              className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold uppercase rounded-2xl"
              onClick={() => {
                addToast('Invoice marked as settled', 'success');
                onClose();
              }}
            >
              Mark as Settled
            </button>
            <button 
              className="px-6 py-3 bg-rose-600 text-white font-bold uppercase rounded-2xl"
              onClick={() => onDelete(invoice.id)}
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UploadView = ({ handleFileUpload, loading, progress }: any) => (
  <div className="max-w-xl mx-auto py-20 text-center">
    <div className="relative">
      <label className={`cursor-pointer block border-4 border-dashed ${loading ? 'border-blue-500' : 'border-slate-200'} rounded-[3rem] p-20 hover:border-blue-500 transition-all ${loading ? 'opacity-50' : ''}`}>
        <Upload size={48} className={`mx-auto ${loading ? 'text-blue-500 animate-pulse' : 'text-slate-300'} mb-4`} />
        <p className="text-slate-400 font-bold uppercase text-xs">
          {loading ? progress : 'Drop Invoices or Click to Browse'}
        </p>
        <input 
          type="file" 
          className="hidden" 
          onChange={handleFileUpload} 
          accept="application/pdf" 
          multiple 
          disabled={loading}
        />
      </label>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
    <p className="text-slate-400 text-sm mt-6 max-w-md mx-auto">
      Upload PDF invoices for automatic auditing. The system will extract data, compare against master rates, and flag price variances.
    </p>
  </div>
);

// Helper function for toast (since we can't use addToast from parent scope in modal)
const addToast = (message: string, type: Toast['type'] = 'info') => {
  console.log(`Toast: ${message}`, type);
  // This is a placeholder - in a real app, you'd use a toast context or state management
};

export default App;
