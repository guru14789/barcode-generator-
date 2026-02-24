
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Download, Printer, Copy, History, Package,
  AlertCircle, CheckCircle2, LayoutGrid, FileText,
  X, AlignCenter, Layers, Info, Loader2, LogIn, LogOut, User as UserIcon
} from 'lucide-react';
import { BarcodeEntry } from './types';
import { storageService } from './services/storageService';
import BarcodeDisplay from './components/BarcodeDisplay';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from './services/firebase';

interface QueueItem extends BarcodeEntry {
  printId: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<BarcodeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<BarcodeEntry | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [printQueue, setPrintQueue] = useState<(QueueItem | null)[]>(Array(30).fill(null));
  const [activeTab, setActiveTab] = useState<'generator' | 'sheet'>('generator');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await storageService.syncUser(currentUser);
      }
      // Re-fetch history when user changes
      setIsLoading(true);
      storageService.getHistory(currentUser?.email || undefined).then(loadedHistory => {
        setHistory(loadedHistory);
        if (loadedHistory.length > 0) {
          setCurrentEntry(loadedHistory[0]);
        } else {
          setCurrentEntry(null);
        }
        setIsLoading(false);
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const savedQueue = localStorage.getItem('barcodegen_print_queue');
      if (savedQueue) {
        try {
          const parsed = JSON.parse(savedQueue);
          if (Array.isArray(parsed)) {
            const fixed = Array(30).fill(null);
            parsed.forEach((item, idx) => {
              if (idx < 30) fixed[idx] = item;
            });
            setPrintQueue(fixed);
          }
        } catch (e) {
          console.error("Failed to parse print queue", e);
        }
      }
    };

    initApp();
  }, []);

  useEffect(() => {
    localStorage.setItem('barcodegen_print_queue', JSON.stringify(printQueue));
  }, [printQueue]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLogin = async () => {
    setIsAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      showStatus('success', 'Logged in successfully');
    } catch (error) {
      console.error("Login error:", error);
      showStatus('error', 'Failed to login with Google');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      await signOut(auth);
      showStatus('success', 'Logged out');
    } catch (error) {
      showStatus('error', 'Failed to logout');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const generateUniqueCode = useCallback(async () => {
    if (isGenerating) return null;
    setIsGenerating(true);

    let code = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;
    const existingIds = new Set(history.map(h => String(h.id)));

    while (!isUnique && attempts < maxAttempts) {
      code = Math.floor(100000000 + Math.random() * 900000000).toString();
      if (!existingIds.has(code)) isUnique = true;
      attempts++;
    }

    if (!isUnique) {
      showStatus('error', 'Critical error: Unique ID generation failed.');
      setIsGenerating(false);
      return null;
    }

    const newEntry: BarcodeEntry = {
      id: code,
      createdAt: Date.now(),
      label: labelInput.trim() || undefined,
      format: 'CODE128',
      userId: user?.email || 'anonymous'
    };

    try {
      await storageService.saveEntry(newEntry);
      setCurrentEntry(newEntry);
      setHistory(prev => [newEntry, ...prev]);
      setLabelInput('');
      showStatus('success', `Generated ${code}`);
    } catch (e) {
      showStatus('error', 'Failed to save to cloud.');
    } finally {
      setIsGenerating(false);
    }
    return newEntry;
  }, [history, labelInput, isGenerating, user]);

  const addToPrintQueue = (entry: BarcodeEntry | null, slotIndex?: number) => {
    if (!entry) return;

    setPrintQueue(prev => {
      const newQueue = [...prev];
      let targetIndex = slotIndex;

      if (targetIndex === undefined) {
        targetIndex = newQueue.findIndex(item => item === null);
      }

      if (targetIndex === -1 || targetIndex >= 30) {
        showStatus('error', 'Sheet is full (Max 30 per A4 page).');
        return prev;
      }

      const newItem: QueueItem = {
        ...entry,
        printId: Math.random().toString(36).substr(2, 9) + Date.now().toString()
      };

      newQueue[targetIndex] = newItem;
      showStatus('success', `Added to Slot ${targetIndex + 1}`);
      return newQueue;
    });
  };

  const removeFromQueue = (slotIndex: number) => {
    setPrintQueue(prev => {
      const newQueue = [...prev];
      newQueue[slotIndex] = null;
      return newQueue;
    });
    showStatus('success', 'Slot cleared.');
  };

  const clearQueue = () => {
    setPrintQueue(Array(30).fill(null));
    showStatus('success', 'Sheet cleared.');
  };

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    showStatus('success', 'ID copied.');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this barcode from cloud and history?')) return;

    setIsDeleting(true);
    try {
      await storageService.deleteEntry(id);

      const updatedHistory = history.filter(e => String(e.id) !== String(id));
      setHistory(updatedHistory);

      if (currentEntry && String(currentEntry.id) === String(id)) {
        setCurrentEntry(updatedHistory.length > 0 ? updatedHistory[0] : null);
      }

      setPrintQueue(prev => prev.filter(item => String(item.id) !== String(id)));
      showStatus('success', 'Barcode deleted.');
    } catch (e) {
      showStatus('error', 'Failed to delete from cloud.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = () => {
    if (activeTab === 'sheet' && printQueue.length === 0) {
      showStatus('error', 'Sheet is empty. Add barcodes first.');
      return;
    }
    if (activeTab === 'generator' && !currentEntry) {
      showStatus('error', 'No barcode selected to print.');
      return;
    }

    // Ensure window has focus before printing, especially in iframes
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const downloadBarcode = () => {
    const svg = document.querySelector('.current-barcode-svg svg') as SVGSVGElement | null;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `barcode-${currentEntry?.label || currentEntry?.id}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <>
      <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-slate-100 no-print">
        {/* Sidebar: History */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <History className="w-5 h-5 text-indigo-600" />
                Cloud History
              </h2>
              <button onClick={() => setShowHistory(false)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* User Profile Section */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/30">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-11 h-11 rounded-full border-2 border-white shadow-md" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                        <UserIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{user.displayName || 'User'}</p>
                      <p className="text-[10px] text-slate-500 truncate font-medium">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={isAuthLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-1.5 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    {isAuthLoading ? <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /> : <LogIn className="w-4 h-4 text-indigo-600" />}
                  </div>
                  {isAuthLoading ? 'Connecting...' : 'Sign in with Google'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-medium uppercase tracking-widest">Syncing cloud...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 opacity-50 flex flex-col items-center gap-3">
                  <Package className="w-12 h-12" />
                  <p className="text-sm">No saved barcodes</p>
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setCurrentEntry(entry);
                      setActiveTab('generator');
                      if (window.innerWidth < 1024) setShowHistory(false);
                    }}
                    className={`group relative p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-lg ${currentEntry?.id === entry.id ? 'bg-indigo-50 border-indigo-200 shadow-md ring-1 ring-indigo-100' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-3">
                        <h4 className="font-extrabold text-slate-900 truncate leading-tight tracking-tight">
                          {entry.label || 'Unnamed Item'}
                        </h4>
                        <p className="mono text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 font-bold bg-slate-100 w-fit px-2 py-0.5 rounded-md">
                          <AlignCenter className="w-3 h-3 text-indigo-500" />
                          {entry.id}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); addToPrintQueue(entry); }}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all shadow-sm border border-emerald-100"
                          title="Add to First Empty Slot"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all shadow-sm border border-red-100"
                          title="Delete forever"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-slate-50/50">
          <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex p-1 bg-slate-100 rounded-lg shadow-inner">
                <button
                  onClick={() => setActiveTab('generator')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'generator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Layers className="w-4 h-4" />
                  Generator
                </button>
                <button
                  onClick={() => setActiveTab('sheet')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'sheet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Print Sheet ({printQueue.filter(i => i !== null).length}/30)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 shadow-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest">Cloud Sync Active</span>
              </div>
              <button onClick={() => setShowHistory(true)} className="lg:hidden p-2 text-slate-600 bg-white border border-slate-200 rounded-lg">
                <History className="w-5 h-5" />
              </button>
              {activeTab === 'sheet' && printQueue.some(i => i !== null) && (
                <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 animate-in fade-in slide-in-from-right-4">
                  <Printer className="w-4 h-4" />
                  <span className="hidden md:inline">Print Sheet</span>
                  <span className="md:hidden">Print</span>
                </button>
              )}
            </div>
          </header>

          {statusMessage && (
            <div className={`fixed top-24 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ${statusMessage.type === 'success' ? 'bg-slate-900 text-white border-l-4 border-emerald-500' : 'bg-red-600 text-white'}`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-white" />}
              <span className="font-bold text-sm tracking-tight">{statusMessage.text}</span>
            </div>
          )}

          <div className="flex-1 p-6 lg:p-12">
            {activeTab === 'generator' ? (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Package className="w-6 h-6 text-indigo-600" />
                    New Label
                  </h3>
                  <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder="Enter Name..."
                      className="flex-1 h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg font-medium placeholder:text-slate-400"
                      onKeyDown={(e) => e.key === 'Enter' && generateUniqueCode()}
                    />
                    <button
                      onClick={generateUniqueCode}
                      disabled={isGenerating || isLoading || !labelInput.trim()}
                      className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                  </div>

                  {currentEntry ? (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selected Label</span>
                          <span className="text-xl font-bold text-slate-900">{currentEntry.label || 'Unnamed Asset'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Barcode ID</span>
                          <p className="mono font-bold text-indigo-600">{currentEntry.id}</p>
                        </div>
                      </div>
                      <div className="current-barcode-svg p-10 bg-slate-50 rounded-3xl border border-slate-100 flex justify-center mb-8">
                        <BarcodeDisplay value={currentEntry.id} width={2.5} height={120} className="w-full !shadow-none !border-none !p-0" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <button onClick={() => handleCopy(currentEntry.id)} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-all gap-1.5 group shadow-sm">
                          <Copy className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">ID</span>
                        </button>
                        <button onClick={downloadBarcode} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-all gap-1.5 group shadow-sm">
                          <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Save</span>
                        </button>
                        <button onClick={() => addToPrintQueue(currentEntry)} className="flex flex-col items-center justify-center p-3 bg-indigo-600 border border-indigo-600 rounded-2xl hover:bg-indigo-700 transition-all gap-1.5 group shadow-lg text-white">
                          <LayoutGrid className="w-4 h-4 text-white/70 group-hover:text-white" />
                          <span className="text-[10px] font-bold uppercase">To Sheet</span>
                        </button>
                        <button onClick={handlePrint} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-all gap-1.5 group shadow-sm">
                          <Printer className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Print</span>
                        </button>
                        <button
                          onClick={() => handleDelete(currentEntry.id)}
                          disabled={isDeleting}
                          className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-2xl hover:bg-red-50 hover:border-red-200 transition-all gap-1.5 group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? <Loader2 className="w-4 h-4 text-red-500 animate-spin" /> : <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500" />}
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{isDeleting ? 'Deleting' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                        <Info className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-500">Ready to sync</p>
                      <p className="text-xs text-center px-6">Create a new barcode or browse cloud history</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-12 animate-in fade-in duration-700">
                <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">A4 Print Canvas</h2>
                      <p className="text-slate-400 font-medium text-sm">Organize up to 30 barcodes for bulk printing</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={clearQueue} className="flex-1 md:flex-none px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" /> Reset Canvas
                    </button>
                    <button onClick={handlePrint} className="flex-1 md:flex-none px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-xl text-lg flex items-center justify-center gap-2 scale-105 active:scale-100">
                      <Printer className="w-5 h-5" /> Print Sheet
                    </button>
                  </div>
                </div>

                <div className="relative mb-20 overflow-x-auto w-full flex justify-center py-10">
                  <div className="a4-preview grid grid-cols-3 grid-rows-10 border-[1mm] border-slate-300 shrink-0">
                    {printQueue.map((item, idx) => {
                      return (
                        <div
                          key={item?.printId || `slot-${idx}`}
                          onClick={() => !item && currentEntry && addToPrintQueue(currentEntry, idx)}
                          className={`relative border-[0.2mm] border-slate-100 flex flex-col items-center justify-center p-2 bg-white overflow-hidden min-h-[29.7mm] transition-all ${!item && currentEntry ? 'hover:bg-indigo-50 cursor-pointer group/slot' : ''}`}
                        >
                          {item ? (
                            <div className="w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                              <button
                                onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }}
                                className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur shadow-sm text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all z-10"
                                title="Remove from slot"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <p className="text-[7px] uppercase font-bold text-slate-500 mb-0.5 max-w-full truncate px-1">{item.label || `Item ${idx + 1}`}</p>
                              <div className="flex justify-center w-full scale-90">
                                <BarcodeDisplay value={item.id} width={1.0} height={40} displayValue={true} className="!shadow-none !border-none !p-0 !bg-transparent" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 opacity-10 group cursor-default">
                              <div className="w-10 h-10 border-2 border-dashed border-slate-400 rounded-xl flex items-center justify-center group-hover/slot:scale-110 group-hover/slot:border-indigo-400 group-hover/slot:text-indigo-500 transition-all">
                                <Plus className="w-5 h-5" />
                              </div>
                              <p className="text-[10px] font-bold uppercase tracking-tighter">Slot {idx + 1}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Actual Print Sheet - Controlled by .print-area class */}
      <div className="print-area">
        <div className="a4-page">
          {activeTab === 'generator' && currentEntry ? (
            <div className="flex flex-col items-center justify-center h-full w-full text-center p-20">
              <h1 className="text-4xl font-bold mb-10 text-slate-800">{currentEntry.label || 'Barcode Tag'}</h1>
              <BarcodeDisplay value={currentEntry.id} width={3} height={140} className="!shadow-none !border-none !p-0 !bg-transparent" />
              <p className="mt-8 text-2xl mono tracking-[0.5em] font-bold">{currentEntry.id}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 grid-rows-10 w-full h-full border-[0.1mm] border-gray-100">
              {Array.from({ length: 30 }).map((_, idx) => {
                const item = printQueue[idx];
                return (
                  <div key={item?.printId || `print-slot-${idx}`} className="flex flex-col items-center justify-center p-2 border-[0.1mm] border-gray-100 bg-white min-h-[28.7mm]">
                    {item ? (
                      <>
                        <p className="text-[7pt] uppercase font-bold text-gray-500 mb-1 tracking-widest max-w-full truncate font-sans">{item.label || `Item ${idx + 1}`}</p>
                        <BarcodeDisplay value={item.id} width={1.2} height={50} className="!shadow-none !border-none !p-0 !bg-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full bg-transparent"></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default App;
