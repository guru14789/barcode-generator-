
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Trash2, Download, Printer, Copy, History, Package, 
  RotateCcw, AlertCircle, CheckCircle2, LayoutGrid, FileText, 
  X, AlignCenter, Layers, Save, Info
} from 'lucide-react';
import { BarcodeEntry } from './types';
import { storageService } from './services/storageService';
import BarcodeDisplay from './components/BarcodeDisplay';

interface QueueItem extends BarcodeEntry {
  printId: string;
}

const App: React.FC = () => {
  const [history, setHistory] = useState<BarcodeEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<BarcodeEntry | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Print Queue State (Items intended for the A4 Sheet - 20 slots)
  const [printQueue, setPrintQueue] = useState<QueueItem[]>([]);
  const [activeTab, setActiveTab] = useState<'generator' | 'sheet'>('generator');

  useEffect(() => {
    const loadedHistory = storageService.getHistory();
    setHistory(loadedHistory);
    if (loadedHistory.length > 0) {
      setCurrentEntry(loadedHistory[0]);
    }
    
    // Load print queue from local storage if exists
    const savedQueue = localStorage.getItem('barcodegen_print_queue');
    if (savedQueue) {
      try {
        setPrintQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error("Failed to parse print queue", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('barcodegen_print_queue', JSON.stringify(printQueue));
  }, [printQueue]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const generateUniqueCode = useCallback(() => {
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
      return null;
    }

    const newEntry: BarcodeEntry = {
      id: code,
      createdAt: Date.now(),
      label: labelInput.trim() || undefined,
      format: 'CODE128'
    };

    setCurrentEntry(newEntry);
    storageService.saveEntry(newEntry);
    setHistory(prev => [newEntry, ...prev]);
    setLabelInput('');
    showStatus('success', `Generated ${code}`);
    return newEntry;
  }, [history, labelInput]);

  const addToPrintQueue = (entry: BarcodeEntry | null) => {
    if (!entry) return;
    if (printQueue.length >= 20) {
      showStatus('error', 'Sheet is full (Max 20 per A4 page).');
      return;
    }
    // Note: Allowing same barcode to be added multiple times for "20 copies of same" requirement
    const newItem: QueueItem = { 
      ...entry, 
      printId: Math.random().toString(36).substr(2, 9) + Date.now().toString() 
    };
    setPrintQueue(prev => [...prev, newItem]);
    showStatus('success', 'Added to A4 Sheet.');
  };

  const removeFromQueue = (printId: string) => {
    setPrintQueue(prev => prev.filter(item => item.printId !== printId));
  };

  const clearQueue = () => {
    if (confirm('Clear all slots from the print sheet?')) {
      setPrintQueue([]);
      showStatus('success', 'Sheet cleared.');
    }
  };

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    showStatus('success', 'ID copied.');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Permanently delete this barcode from history and the print sheet?')) return;
    
    // 1. Delete from Storage Service
    const updated = storageService.deleteEntry(id);
    
    // 2. Update History State
    setHistory(updated);
    
    // 3. Update Current Selection if needed
    if (currentEntry && String(currentEntry.id) === String(id)) {
      setCurrentEntry(updated.length > 0 ? updated[0] : null);
    }
    
    // 4. Remove all instances from the Print Queue
    setPrintQueue(prev => prev.filter(item => String(item.id) !== String(id)));
    
    showStatus('success', 'Barcode deleted.');
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
    window.print();
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
        {/* Sidebar: History - Organized by Name */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <History className="w-5 h-5 text-indigo-600" />
                History
              </h2>
              <button onClick={() => setShowHistory(false)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
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
                    className={`group relative p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${currentEntry?.id === entry.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="font-bold text-slate-900 truncate leading-tight">
                          {entry.label || 'Unnamed Item'}
                        </h4>
                        <p className="mono text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                          <AlignCenter className="w-3 h-3" />
                          {entry.id}
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                         <button 
                           onClick={(e) => { e.stopPropagation(); addToPrintQueue(entry); }} 
                           className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors" 
                           title="Add to Print Sheet"
                         >
                           <Plus className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }} 
                           className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors" 
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
                  Individual
                </button>
                <button 
                  onClick={() => setActiveTab('sheet')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'sheet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  A4 Print Sheet ({printQueue.length}/20)
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => setShowHistory(true)} className="lg:hidden p-2 text-slate-600 bg-white border border-slate-200 rounded-lg">
                <History className="w-5 h-5" />
              </button>
              {activeTab === 'sheet' && (
                <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95">
                  <Printer className="w-4 h-4" />
                  <span>Print All</span>
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

          <div className="flex-1 p-4 lg:p-8">
            {activeTab === 'generator' ? (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Package className="w-6 h-6 text-indigo-600" />
                    New Barcode Label
                  </h3>
                  <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <input 
                      type="text" 
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder="Enter Name (e.g. Asset 01, Product X...)"
                      className="flex-1 h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg font-medium placeholder:text-slate-400"
                      onKeyDown={(e) => e.key === 'Enter' && generateUniqueCode()}
                    />
                    <button onClick={generateUniqueCode} className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0">
                      <Plus className="w-5 h-5" />
                      Generate
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
                        <button onClick={() => handleDelete(currentEntry.id)} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-2xl hover:bg-red-50 hover:border-red-200 transition-all gap-1.5 group shadow-sm">
                          <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Delete</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                        <Info className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-500">No barcode selected</p>
                      <p className="text-xs text-center px-6">Create a new barcode or select one from history to get started</p>
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
                        <p className="text-slate-400 font-medium text-sm">Organize up to 20 barcodes for bulk printing</p>
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
                  <div className="a4-preview grid grid-cols-4 grid-rows-5 border-[1mm] border-slate-300 shrink-0">
                      {Array.from({ length: 20 }).map((_, idx) => {
                        const item = printQueue[idx];
                        return (
                          <div key={item?.printId || `slot-${idx}`} className="relative border-[0.2mm] border-slate-100 flex flex-col items-center justify-center p-4 bg-white overflow-hidden min-h-[59.4mm]">
                              {item ? (
                                <div className="w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                                  <button 
                                    onClick={() => removeFromQueue(item.printId)}
                                    className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur shadow-sm text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all z-10"
                                    title="Remove from slot"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                  <p className="text-[8px] uppercase font-bold text-slate-500 mb-1 max-w-full truncate px-1">{item.label || `Item ${idx + 1}`}</p>
                                  <div className="flex justify-center w-full">
                                      <BarcodeDisplay value={item.id} width={1.2} height={60} displayValue={true} className="!shadow-none !border-none !p-0 !bg-transparent" />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2 opacity-10 group cursor-default">
                                  <div className="w-10 h-10 border-2 border-dashed border-slate-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all">
                                    <Plus className="w-5 h-5" />
                                  </div>
                                  <p className="text-[10px] font-bold uppercase tracking-tighter">Empty Slot</p>
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
            <div className="grid grid-cols-4 grid-rows-5 w-full h-full border-[0.1mm] border-gray-100">
              {Array.from({ length: 20 }).map((_, idx) => {
                const item = printQueue[idx];
                return (
                  <div key={item?.printId || `print-slot-${idx}`} className="flex flex-col items-center justify-center p-4 border-[0.1mm] border-gray-100 bg-white min-h-[57.4mm]">
                    {item ? (
                      <>
                        <p className="text-[8pt] uppercase font-bold text-gray-500 mb-2 tracking-widest max-w-full truncate font-sans">{item.label || `Item ${idx + 1}`}</p>
                        <BarcodeDisplay value={item.id} width={1.4} height={70} className="!shadow-none !border-none !p-0 !bg-transparent" />
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
