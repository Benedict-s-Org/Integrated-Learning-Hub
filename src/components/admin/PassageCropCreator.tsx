import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Plus, ChevronLeft, ChevronRight,
  Loader2, X, Check, Trash2, Image as ImageIcon, RefreshCw,
  Search, FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ReadingPdf {
  pageId: string;
  name: string;
  fileUrl?: string;
  day?: number | string | null;
}

interface StagedCrop {
  blob: Blob;
  previewUrl: string;
  coords: { x: number; y: number; w: number; h: number; page: number };
  pdfUrl: string;
  pdfName: string;
  category: string;
}

interface PassageCropCreatorProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export const PassageCropCreator: React.FC<PassageCropCreatorProps> = ({ 
  onComplete, 
  onCancel 
}) => {
  const { session } = useAuth();
  const [step] = useState<'select-pdf' | 'workspace'>('workspace'); // Default to workspace for day-first
  
  // PDF State
  const [pdfs, setPdfs] = useState<ReadingPdf[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<ReadingPdf | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  
  // Staging State
  const [activeDay, setActiveDay] = useState<number>(1);
  const [dayInput, setDayInput] = useState('1');
  const [stagedCrops, setStagedCrops] = useState<Record<number, StagedCrop>>({});
  const [globalCategory, setGlobalCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scaling state
  const [renderScale, setRenderScale] = useState(1.5);

  // Notion Integration State
  const [notionDbId, setNotionDbId] = useState(() => localStorage.getItem('passage_crop_notion_db_id') || '');
  const [dayPageMapping, setDayPageMapping] = useState<Record<number, number>>({});
  const [isFetchingNotion, setIsFetchingNotion] = useState(false);
  const [pdfSearch, setPdfSearch] = useState('');
  const [showPdfSelector, setShowPdfSelector] = useState(false);

  // Derived unique PDFs list
  const uniquePdfs = React.useMemo(() => {
    const map = new Map();
    pdfs.forEach(pdf => {
      if (pdf.fileUrl && !map.has(pdf.name)) {
        map.set(pdf.name, pdf);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [pdfs]);

  const filteredPdfs = uniquePdfs.filter(pdf => 
    pdf.name.toLowerCase().includes(pdfSearch.toLowerCase())
  );

  useEffect(() => {
    fetchPdfs();
  }, []);

  const fetchPdfs = async () => {
    setLoading(true);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data, error } = await supabase.functions.invoke('reading-api', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: { action: 'list-activities' }
      });
      
      if (error) throw error;
      const results = (data?.results || []).map((item: any) => ({
        ...item,
        day: item.day
      })).sort((a: any, b: any) => (Number(a.day) || 0) - (Number(b.day) || 0));
      setPdfs(results);
      
      // Auto-load first day's PDF if available
      if (results.length > 0) {
        const firstDayPdf = results.find((p: any) => Number(p.day) === 1) || results[0];
        loadPdfDoc(firstDayPdf);
      }
    } catch (err) {
      console.error('Error fetching PDFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPdfDoc = async (pdf: ReadingPdf, initialPage?: number) => {
    if (!pdf.fileUrl) return;
    if (selectedPdf?.fileUrl === pdf.fileUrl && pdfDoc) {
      if (initialPage) setPageNum(initialPage);
      return; // Already loaded
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const proxyUrl = `${supabaseUrl}/functions/v1/reading-api?action=proxy-reading-pdf&url=${encodeURIComponent(pdf.fileUrl)}`;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        }
      });
      if (!response.ok) throw new Error('Failed to fetch PDF');
      const arrayBuffer = await response.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPageNum(initialPage || 1);
      setSelectedPdf(pdf);
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Failed to load PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleDaySelect = (day: number) => {
    setActiveDay(day);
    setDayInput(day.toString());
    
    // Find PDF for this day
    const pdfForDay = pdfs.find(p => Number(p.day) === day);
    const existing = stagedCrops[day];
    const notionPage = dayPageMapping[day];
    
    if (pdfForDay) {
      loadPdfDoc(pdfForDay, existing?.coords.page || notionPage);
    } else if (existing) {
      setPageNum(existing.coords.page);
    } else if (notionPage) {
      setPageNum(notionPage);
    }

    // Auto-scroll the sidebar to keep the selected day in view
    setTimeout(() => {
      const activeBtn = sidebarRef.current?.querySelector(`[data-day="${day}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const fetchNotionMapping = async () => {
    const sanitizedId = notionDbId.trim().replace(/[^a-fA-F0-9]/g, '');
    if (!sanitizedId || sanitizedId.length !== 32) {
      alert(`Invalid Notion Database ID format. Expected 32 hex characters, got ${sanitizedId.length}. Please check for typos.`);
      return;
    }
    
    setIsFetchingNotion(true);
    localStorage.setItem('passage_crop_notion_db_id', notionDbId);
    
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: notionData, error: notionError } = await supabase.functions.invoke('notion-api', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: { 
          databaseId: sanitizedId,
          action: 'query-mcq-database'
        }
      });

      if (notionError) {
        console.error('[PassageCropCreator] Notion API Error:', notionError);
        const status = (notionError as any).status;
        if (status === 404) {
          throw new Error('Notion Database not found (404). Possible reasons: 1. Invalid Database ID. 2. Integration not shared with this database. 3. Edge Function not deployed.');
        }
        throw notionError;
      }
      const results = notionData.results || [];
      
      const mapping: Record<number, number> = {};
      results.forEach((entry: any) => {
        const props = entry.properties;
        
        // Find Title (Day)
        const dayProp = Object.values(props).find((p: any) => p.type === 'title') as any;
        const dayText = dayProp?.title?.map((t: any) => t.plain_text).join('') || '';
        const dayNum = parseInt(dayText.replace(/\D/g, ''));

        // Find Page Number
        const pageProp = props['Page'] || props['Page Number'] || Object.values(props).find((p: any) => p.type === 'number');
        const pageNum = pageProp?.type === 'number' ? pageProp.number : null;

        if (!isNaN(dayNum) && pageNum) {
          mapping[dayNum] = pageNum;
        }
      });

      setDayPageMapping(mapping);
    } catch (err) {
      console.error('Error fetching Notion mapping:', err);
      alert('Failed to fetch from Notion. Check your Database ID and permissions.');
    } finally {
      setIsFetchingNotion(false);
    }
  };

  const handleJumpToDay = () => {
    const val = parseInt(dayInput);
    if (!isNaN(val) && val >= 1 && val <= 48) {
      handleDaySelect(val);
    } else {
      setDayInput(activeDay.toString());
    }
  };

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || step !== 'workspace' || !containerRef.current) return;

    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        
        // Calculate dynamic scale to fit width
        const containerWidth = containerRef.current!.clientWidth;
        const padding = 96; // p-12 = 3rem each side = 48px * 2 = 96px
        const viewport1 = page.getViewport({ scale: 1 });
        const autoScale = Math.max(0.2, (containerWidth - padding) / viewport1.width);
        
        setRenderScale(autoScale);
        const viewport = page.getViewport({ scale: autoScale });
        
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        renderTask = page.render({ canvasContext: context, viewport, canvas });
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Render error:', err);
        }
      }
    };

    renderPage();

    // Re-render on window resize to maintain "fit width"
    const handleResize = () => {
      renderPage();
    };
    window.addEventListener('resize', handleResize);

    return () => { 
      if (renderTask) renderTask.cancel(); 
      window.removeEventListener('resize', handleResize);
    };
  }, [pdfDoc, pageNum, step]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current || loading) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    cropStartRef.current = { x, y };
    setIsCropping(true);

    if (overlayRef.current) {
      overlayRef.current.style.display = 'block';
      overlayRef.current.style.left = `${x}px`;
      overlayRef.current.style.top = `${y}px`;
      overlayRef.current.style.width = '0px';
      overlayRef.current.style.height = '0px';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isCropping || !canvasRef.current || !overlayRef.current || !cropStartRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const startX = cropStartRef.current.x;
    const startY = cropStartRef.current.y;
    
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(startX - x);
    const height = Math.abs(startY - y);
    
    overlayRef.current.style.left = `${left}px`;
    overlayRef.current.style.top = `${top}px`;
    overlayRef.current.style.width = `${width}px`;
    overlayRef.current.style.height = `${height}px`;
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (!isCropping || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsCropping(false);

    // Capture the crop immediately and stage it
    if (cropStartRef.current && selectedPdf) {
      const pxX = Math.min(cropStartRef.current.x, x);
      const pxY = Math.min(cropStartRef.current.y, y);
      const pxW = Math.abs(cropStartRef.current.x - x);
      const pxH = Math.abs(cropStartRef.current.y - y);

      if (pxW < 10 || pxH < 10) return;

      const canvas = canvasRef.current;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = pxW;
      cropCanvas.height = pxH;
      const cropCtx = cropCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(canvas, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);
        const blob = await new Promise<Blob | null>(resolve => cropCanvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          setStagedCrops(prev => ({
            ...prev,
            [activeDay]: {
              blob,
              previewUrl,
              coords: {
                x: pxX / canvas.width,
                y: pxY / canvas.height,
                w: pxW / canvas.width,
                h: pxH / canvas.height,
                page: pageNum
              },
              pdfUrl: selectedPdf.fileUrl || '',
              pdfName: selectedPdf.name,
              category: globalCategory
            }
          }));
        }
      }
    }
  };

  const handleUpdateStagedCategory = (day: number, category: string) => {
    setStagedCrops(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        category
      }
    }));
  };

  const handleSaveAll = async () => {
    const days = Object.keys(stagedCrops);
    if (days.length === 0) {
      alert('No crops staged to save.');
      return;
    }

    setSaving(true);
    try {
      for (const day of days) {
        const crop = stagedCrops[Number(day)];
        const fileName = `passage_crop_day${day}_${Date.now()}.png`;
        
        // 1. Upload
        const { error: uploadError } = await supabase.storage.from('reading-passages').upload(fileName, crop.blob);
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('reading-passages').getPublicUrl(fileName);

        // 2. Save DB Record
        const { error: dbError } = await supabase.from('reading_questions').insert({
          practice_id: null,
          question_text: `Passage for Day ${day}`,
          correct_answer: 'PASSAGE_CROP_TEMPLATE',
          interaction_type: 'passage-crop',
          evidence_coords: crop.coords,
          question_image_url: publicUrl,
          metadata: {
            day: String(day),
            pdf_url: crop.pdfUrl,
            pdf_name: crop.pdfName
          },
          // @ts-ignore - category column was added via migration but types are not updated
          category: crop.category || null
        });
        if (dbError) throw dbError;
      }
      
      alert(`Successfully saved ${days.length} passage crops!`);
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error('[PassageCrop] Save Error:', err);
      alert(`Error saving crops: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeStaged = (day: number) => {
    setStagedCrops(prev => {
      const next = { ...prev };
      if (next[day]) {
        URL.revokeObjectURL(next[day].previewUrl);
        delete next[day];
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-50 w-full max-w-[95vw] h-[95vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white">
        
        {/* HEADER */}
        <div className="px-8 py-4 bg-white border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Passage Bulk Cropper</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stage multiple days & save once</p>
            </div>
            {/* Global Category Input */}
            <div className="ml-8 px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-500">Global Category:</span>
              <input 
                type="text" 
                value={globalCategory}
                onChange={(e) => setGlobalCategory(e.target.value)}
                placeholder="e.g. History..."
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 w-24 placeholder:text-slate-300"
              />
            </div>

            {/* PDF Selector */}
            <div className="ml-4 relative group">
              <button 
                onClick={() => setShowPdfSelector(!showPdfSelector)}
                className="px-4 py-2 bg-white border-2 border-indigo-100 rounded-2xl flex items-center gap-3 hover:border-indigo-600 transition-all shadow-sm"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <div className="text-left max-w-[200px]">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Selected PDF</p>
                  <p className="text-[10px] font-bold text-slate-800 truncate">{selectedPdf?.name || 'Select PDF...'}</p>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showPdfSelector ? 'rotate-90' : ''}`} />
              </button>

              {showPdfSelector && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-indigo-50 p-4 z-[70] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text"
                      value={pdfSearch}
                      onChange={(e) => setPdfSearch(e.target.value)}
                      placeholder="Search PDFs..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                    {filteredPdfs.map((pdf) => (
                      <button
                        key={pdf.pageId}
                        onClick={() => {
                          loadPdfDoc(pdf);
                          setShowPdfSelector(false);
                        }}
                        className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                          selectedPdf?.pageId === pdf.pageId 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <FileText className={`w-4 h-4 ${selectedPdf?.pageId === pdf.pageId ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-bold truncate">{pdf.name}</span>
                      </button>
                    ))}
                    {filteredPdfs.length === 0 && (
                      <p className="text-[10px] font-bold text-slate-400 text-center py-4">No PDFs found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-slate-100 rounded-xl">
              <span className="text-xs font-black text-slate-500">{Object.keys(stagedCrops).length} STAGED</span>
            </div>
            <button 
              onClick={handleSaveAll}
              disabled={saving || Object.keys(stagedCrops).length === 0}
              className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-50 disabled:opacity-30 active:scale-95 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save All Cropping
            </button>
            <button onClick={onCancel} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          
          {/* LEFT: DAY SELECTION (1-48) */}
          <div className="w-64 bg-white border-r flex flex-col overflow-hidden">
            {/* Notion Reference Field */}
            <div className="p-4 border-b bg-indigo-50/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Notion Reference</span>
                {Object.keys(dayPageMapping).length > 0 && (
                  <span className="text-[8px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase">
                    {Object.keys(dayPageMapping).length} Loaded
                  </span>
                )}
              </div>
              <div className="relative group">
                <input 
                  type="text" 
                  value={notionDbId}
                  onChange={(e) => setNotionDbId(e.target.value)}
                  placeholder="Notion DB ID..."
                  className="w-full pl-3 pr-10 py-2 bg-white border-2 border-slate-200 rounded-xl text-[10px] font-bold focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                />
                <button 
                  onClick={fetchNotionMapping}
                  disabled={isFetchingNotion || !notionDbId}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingNotion ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Target Day</span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-300 uppercase">Jump</span>
                <input 
                  type="text" 
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  onBlur={handleJumpToDay}
                  onKeyDown={(e) => e.key === 'Enter' && handleJumpToDay()}
                  className="w-10 h-7 text-center font-black border-2 border-slate-200 rounded-lg text-[10px] focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div ref={sidebarRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {Array.from({ length: 48 }, (_, i) => i + 1).map(num => {
                const staged = stagedCrops[num];
                const active = activeDay === num;
                return (
                  <button 
                    key={num}
                    data-day={num}
                    onClick={() => handleDaySelect(num)}
                    className={`w-full p-3 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${
                      active ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-50 hover:border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <span className={`text-xs font-black ${active ? 'text-indigo-900' : 'text-slate-700'}`}>Day {num}</span>
                      {staged && (
                        <p className="text-[8px] font-bold text-emerald-500 uppercase flex items-center gap-1 mt-0.5 animate-in fade-in zoom-in duration-300">
                          <Check className="w-2.5 h-2.5" /> STAGED
                        </p>
                      )}
                    </div>
                    {staged && (
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200">
                        <img src={staged.previewUrl} className="w-full h-full object-cover" alt="Staged" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER: PDF WORKSPACE */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-200/50 p-6 relative">
            <div 
              ref={containerRef}
              className="bg-white rounded-[3rem] shadow-xl flex-1 overflow-auto relative custom-scrollbar border border-white p-12"
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center p-20">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading PDF...</p>
                </div>
              ) : (
                <div className="min-w-fit mx-auto">
                  <div 
                    className={`relative cursor-crosshair transition-opacity duration-300 ${loading ? 'opacity-30' : 'opacity-100'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    <canvas ref={canvasRef} />
                    <div 
                      ref={overlayRef}
                      className="absolute border-2 border-indigo-600 bg-indigo-600/10 pointer-events-none hidden"
                      style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)' }}
                    />
                    
                    {/* EXISTING CROP OVERLAY (IF STAGED) */}
                    {stagedCrops[activeDay] && stagedCrops[activeDay].coords.page === pageNum && (
                      <div 
                        className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none flex items-center justify-center"
                        style={{
                          left: `${stagedCrops[activeDay].coords.x * 100}%`,
                          top: `${stagedCrops[activeDay].coords.y * 100}%`,
                          width: `${stagedCrops[activeDay].coords.w * 100}%`,
                          height: `${stagedCrops[activeDay].coords.h * 100}%`,
                        }}
                      >
                        <div className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full -mt-6">STAGED</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* PDF CONTROLS */}
            <div className="mt-4 flex items-center justify-between px-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setPageNum(p => Math.max(1, p - 1))}
                  disabled={pageNum <= 1 || loading}
                  className="p-3 bg-white rounded-2xl shadow-lg shadow-slate-200/50 disabled:opacity-30 active:scale-95 transition-all"
                >
                  <ChevronLeft />
                </button>
                <div className="px-6 py-2 bg-white rounded-2xl shadow-lg shadow-slate-200/50">
                  <span className="text-sm font-black text-slate-800">Page {pageNum} of {numPages}</span>
                </div>
                <button 
                  onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
                  disabled={pageNum >= numPages || loading}
                  className="p-3 bg-white rounded-2xl shadow-lg shadow-slate-200/50 disabled:opacity-30 active:scale-95 transition-all"
                >
                  <ChevronRight />
                </button>
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Draw to crop for Day {activeDay} • PDF: {selectedPdf?.name || '...'} • Zoom: {Math.round(renderScale * 100)}%</p>
            </div>
          </div>

          {/* RIGHT: CURRENT CROP PREVIEW & STAGE LIST */}
          <div className="w-80 bg-white border-l flex flex-col overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Current Selection</h3>
              {stagedCrops[activeDay] ? (
                <div className="space-y-4">
                  <div className="aspect-[4/5] bg-slate-100 rounded-[2rem] overflow-hidden border border-slate-200 group relative">
                    <img src={stagedCrops[activeDay].previewUrl} className="w-full h-full object-cover" alt="Active Day Preview" />
                    <button 
                      onClick={() => removeStaged(activeDay)}
                      className="absolute top-4 right-4 p-2 bg-white/90 text-red-500 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-900 uppercase">Day {activeDay} Staged</p>
                      <p className="text-[9px] font-bold text-emerald-600 uppercase mb-2">Page {stagedCrops[activeDay].coords.page}</p>
                      
                      {/* Label/Category Input */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Label / Category</span>
                        <input 
                          type="text"
                          value={stagedCrops[activeDay].category}
                          onChange={(e) => handleUpdateStagedCategory(activeDay, e.target.value)}
                          placeholder="Category..."
                          className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-900 outline-none focus:border-emerald-500 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-[4/5] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-200">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                    No crop for Day {activeDay} yet. Draw on the PDF!
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Staged Queue</h3>
              <div className="space-y-3">
                {Object.keys(stagedCrops).sort((a, b) => Number(a) - Number(b)).map(dayNum => {
                  const day = Number(dayNum);
                  if (day === activeDay) return null;
                  const crop = stagedCrops[day];
                  return (
                    <div 
                      key={day} 
                      onClick={() => handleDaySelect(day)}
                      className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 cursor-pointer transition-all"
                    >
                      <img src={crop.previewUrl} className="w-10 h-10 rounded-lg object-cover border border-white shadow-sm" alt={`Day ${day}`} />
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-700">Day {day}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Page {crop.coords.page}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeStaged(day); }}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {Object.keys(stagedCrops).length <= (stagedCrops[activeDay] ? 1 : 0) && (
                  <p className="text-[9px] font-black text-slate-300 text-center uppercase tracking-widest py-8">Queue is empty</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
