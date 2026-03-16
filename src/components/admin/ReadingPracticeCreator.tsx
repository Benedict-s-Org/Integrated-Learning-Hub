import React, { useState, useRef, useEffect } from 'react';
import {
    parseReadingNotionResponse
} from '../../utils/importParsers';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite handled worker import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { 
  Plus, Search, FileText, ChevronLeft, ChevronRight, 
  Loader2, Check, Layers, Type, 
  RotateCcw, Database, Upload
} from 'lucide-react';
import { getVerbForms, isVerb } from '@/utils/verbUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

// Set up PDF.js worker using Vite's URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ReadingPdf {
  pageId: string;
  name: string;
  fileUrl?: string;
  day?: number | string | null;
}

interface ChunkOption {
  id: string;
  text: string;
  alternatives: { text: string; prefix?: string }[];
}

interface NotionQuestion {
  id: string;
  question: string;
  answer: string;
  day?: string;
  page?: number;
}

type CreatorStep = 'select-pdf' | 'workspace' | 'preview';

interface ReadingPracticeCreatorProps {
  onComplete?: (id: string) => void;
  onCancel?: () => void;
  initialPdfUrl?: string;
  initialTitle?: string;
}

export const ReadingPracticeCreator: React.FC<ReadingPracticeCreatorProps> = ({ 
  onComplete, 
  onCancel,
  initialPdfUrl,
  initialTitle
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<CreatorStep>('select-pdf');
  
  // PDF State
  const [pdfs, setPdfs] = useState<ReadingPdf[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<ReadingPdf | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageNumInput, setPageNumInput] = useState('1');
  const [numPages, setNumPages] = useState(0);
  
  // App Logic State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialTitle || '');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Question Selection State
  const [questionsOnPage, setQuestionsOnPage] = useState<NotionQuestion[]>([]);
  const [fetchError, setFetchError] = useState<{ message: string; hint?: string; found?: string[] } | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<NotionQuestion | null>(null);
  
  // Notion Config
  const [questionsDbId, setQuestionsDbId] = useState(() => 
    localStorage.getItem('aplus_questions_db_id') || '3249baca6fa381f18526ca44ce27447c'
  );
  const [showConfig, setShowConfig] = useState(false);
  
  // Chunking State
  const [chunks, setChunks] = useState<ChunkOption[]>([]);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);
  
  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const cropEndRef = useRef<{ x: number; y: number } | null>(null);

  // 1. Initial Load & Fetching
  useEffect(() => {
    fetchPdfs();
    if (initialPdfUrl) {
      handleRemotePdf(initialPdfUrl, initialTitle || 'Untitled');
    }
  }, []);

  const fetchPdfs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reading-api', {
        headers: {
          'x-action': 'list-activities',
          'x-database-id': '3239baca6fa380a9b501deceb133946d'
        },
        body: { action: 'list-activities' }
      });
      
      if (error) throw error;
      const results = (data?.results || []).map((item: any) => ({
        ...item,
        day: item.day
      })).sort((a: any, b: any) => (Number(a.day) || 0) - (Number(b.day) || 0));
      setPdfs(results);
    } catch (err) {
      console.error('Error fetching PDFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemotePdf = async (url: string, name: string) => {
    setSelectedPdf({ pageId: 'remote', name, fileUrl: url });
    // This will trigger the PDF loader useEffect
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      setFile(f);
      setSelectedPdf({ pageId: 'local', name: f.name });
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  // 2. Load PDF document
  useEffect(() => {
    const loadPdfDoc = async () => {
      if (!selectedPdf) return;
      setLoading(true);
      try {
        let arrayBuffer: ArrayBuffer;
        
        if (selectedPdf.pageId === 'local' && file) {
          arrayBuffer = await file.arrayBuffer();
        } else if (selectedPdf.fileUrl) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const proxyUrl = `${supabaseUrl}/functions/v1/reading-api?action=proxy-reading-pdf&url=${encodeURIComponent(selectedPdf.fileUrl)}`;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          const response = await fetch(proxyUrl, {
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey
            }
          });
          if (!response.ok) throw new Error('Failed to fetch PDF');
          arrayBuffer = await response.arrayBuffer();
        } else {
          return;
        }

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        setPageNumInput('1');
        
        // Advance to next step if we have a proper PDF
        setStep('workspace');
        fetchQuestionsForPage(1); // Explicitly pass 1 for initial load
      } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Failed to load PDF.');
      } finally {
        setLoading(false);
      }
    };

    loadPdfDoc();
  }, [selectedPdf, file]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || step !== 'workspace') return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context!, viewport, canvas }).promise;
      } catch (err) {
        console.error('Render error:', err);
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, step]);

  const fetchQuestionsForPage = async (page: number = pageNum) => {
    if (!selectedPdf || selectedPdf.pageId === 'local') {
      setQuestionsOnPage([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      // Use notion-api directly — the same proven pattern as Spaced Repetition's NotionImporter
      const { data, error } = await supabase.functions.invoke('notion-api', {
        headers: {
          'x-action': 'query-mcq-database',
          'x-database-id': questionsDbId
        },
        body: { 
          databaseId: questionsDbId,
          action: 'query-mcq-database'
        },
        method: 'POST'
      });
      
      if (error) {
        console.error('[ReadingPractice] notion-api error:', error);
        setFetchError({
          message: error.message || 'Failed to fetch from Notion',
          hint: 'Make sure the database is shared with the integration and ID is correct.'
        });
        setQuestionsOnPage([]);
        return;
      }

      if (data?.error) {
        setFetchError({ message: data.error });
        setQuestionsOnPage([]);
        return;
      }

      if (!data?.results || data.results.length === 0) {
        setFetchError({ message: 'No questions found in this Notion database.' });
        setQuestionsOnPage([]);
        return;
      }

      // Parse raw Notion results on the frontend (same as Spaced Repetition)
      const allQuestions = parseReadingNotionResponse(data.results);
      
      // Frontend filtering by Day and Page if available
      let filtered = allQuestions;
      if (selectedPdf.day) {
        filtered = filtered.filter(q => {
          // Check if question has matching day info in its raw data
          const rawPage = data.results.find((r: any) => r.id === q.id);
          if (!rawPage) return true; // Keep if we can't check
          const props = rawPage.properties || {};
          const dayProp = props['Day'] || props['day'];
          if (!dayProp) return true; // Keep if no Day column
          
          let dayVal: any = null;
          if (dayProp.number !== undefined && dayProp.number !== null) dayVal = dayProp.number;
          else if (dayProp.select?.name) dayVal = dayProp.select.name;
          else if (dayProp.rich_text?.[0]?.plain_text) dayVal = dayProp.rich_text[0].plain_text;
          
          return dayVal !== null && String(dayVal) === String(selectedPdf.day);
        });
      }

      // Also filter by page number if available
      if (page) {
        const pageFiltered = filtered.filter(q => {
          const rawPage = data.results.find((r: any) => r.id === q.id);
          if (!rawPage) return true;
          const props = rawPage.properties || {};
          const pageProp = props['Page'] || props['page'] || props['Page Number'];
          if (!pageProp) return true; // Keep if no Page column
          
          let pageVal: any = null;
          if (pageProp.number !== undefined && pageProp.number !== null) pageVal = pageProp.number;
          else if (pageProp.select?.name) pageVal = pageProp.select.name;
          else if (pageProp.rich_text?.[0]?.plain_text) pageVal = pageProp.rich_text[0].plain_text;
          
          return pageVal !== null && String(pageVal) === String(page);
        });
        // Only apply page filter if it doesn't eliminate everything
        if (pageFiltered.length > 0) filtered = pageFiltered;
      }

      // Sort by Day then Page ascending
      filtered.sort((a, b) => {
        const dayA = Number(a.day) || 0;
        const dayB = Number(b.day) || 0;
        if (dayA !== dayB) return dayA - dayB;
        return (a.page || 0) - (b.page || 0);
      });

      console.log(`[ReadingPractice] Fetched ${allQuestions.length} total, ${filtered.length} after filtering (day=${selectedPdf.day}, page=${page})`);
      setQuestionsOnPage(filtered);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setFetchError({ message: 'Connection error. Please check your Notion configuration.' });
      setQuestionsOnPage([]);
    } finally {
      setLoading(false);
    }
  };

  // 4. Cropping Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (step !== 'workspace' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pos = { x, y };
    cropStartRef.current = pos;
    cropEndRef.current = pos;
    setCropStart(pos);
    setCropEnd(pos);
    setIsCropping(true);

    // Immediate visual reset for the overlay
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
    
    // Direct DOM update for performance
    const startX = cropStartRef.current.x;
    const startY = cropStartRef.current.y;
    
    cropEndRef.current = { x, y };
    
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(startX - x);
    const height = Math.abs(startY - y);
    
    overlayRef.current.style.left = `${left}px`;
    overlayRef.current.style.top = `${top}px`;
    overlayRef.current.style.width = `${width}px`;
    overlayRef.current.style.height = `${height}px`;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (step !== 'workspace' || !isCropping || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pos = { x, y };
    cropEndRef.current = pos;
    
    // Final state sync for React components
    setCropEnd(pos);
    setIsCropping(false);
  };

  // State Management Transitions
  const handleSelectQuestion = (q: NotionQuestion) => {
    setSelectedQuestion(q);
    // Title defaults to question text if not set
    if (!title || title.startsWith('Question from')) {
      setTitle(q.question);
    }
    initializeChunks(q.answer);
    
    // Auto-jump to page if available in properties
    if (q.page && q.page >= 1 && q.page <= numPages && q.page !== pageNum) {
      setPageNum(q.page);
      setPageNumInput(q.page.toString());
      fetchQuestionsForPage(q.page);
    }
  };


  const initializeChunks = (text: string) => {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const initialChunks: ChunkOption[] = words.map(w => {
      const verbForms = getVerbForms(w);
      return {
        id: crypto.randomUUID(),
        text: w,
        alternatives: verbForms.map((vf: any) => ({ text: vf.text, prefix: vf.prefix }))
      };
    });
    setChunks(initialChunks);
  };

  const toggleChunkSelection = (id: string) => {
    setSelectedChunkIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const combineChunks = () => {
    if (selectedChunkIds.length < 2) return;
    const selectedIndices = chunks
      .map((c, i) => selectedChunkIds.includes(c.id) ? i : -1)
      .filter(i => i !== -1);
    
    const isContiguous = selectedIndices.every((val, i) => i === 0 || val === selectedIndices[i-1] + 1);
    if (!isContiguous) {
      alert('Please select contiguous words to combine.');
      return;
    }

    const firstIdx = selectedIndices[0];
    const lastIdx = selectedIndices[selectedIndices.length - 1];
    const chunksToCombine = chunks.slice(firstIdx, lastIdx + 1);
    const allVariations = chunksToCombine.map(c => [c.text, ...c.alternatives.map(a => a.text)]);
    
    let combinations: string[] = [""];
    for (const variations of allVariations) {
      const next: string[] = [];
      for (const current of combinations) {
        for (const v of variations) {
          next.push((current + " " + v).trim());
        }
      }
      combinations = next;
    }

    const finalAlternatives = Array.from(new Set(combinations)).slice(0, 4);
    
    // Auto-enhance with verb forms if the combined text is a verb
    const combinedText = finalAlternatives[0];
    let alternatives: { text: string; prefix?: string }[] = finalAlternatives.slice(1).map(a => ({ text: a }));
    
    if (isVerb(combinedText)) {
      const verbForms = getVerbForms(combinedText);
      if (verbForms.length > 0) {
        alternatives = verbForms.map((vf: any) => ({ text: vf.text, prefix: vf.prefix }));
      }
    }

    const newChunk: ChunkOption = {
      id: crypto.randomUUID(),
      text: combinedText,
      alternatives
    };

    setChunks([...chunks.slice(0, firstIdx), newChunk, ...chunks.slice(lastIdx + 1)]);
    setSelectedChunkIds([]);
  };

  const updateChunkAlternatives = (id: string, alts: { text: string; prefix?: string }[]) => {
    setChunks(prev => prev.map(c => c.id === id ? { ...c, alternatives: alts.filter(a => a.text.trim() !== '') } : c));
  };

  const handleSaveAll = async (randomizedIds: string[]) => {
    if (!pdfDoc || !cropStart || !cropEnd) return;
    setSaving(true);
    try {
      // 1. Identify if we are saving a "Reading Practice" (Legacy Image) or "A+ Question"
      const canvas = canvasRef.current!;
      const x = Math.min(cropStart.x, cropEnd.x) / canvas.width;
      const y = Math.min(cropStart.y, cropEnd.y) / canvas.height;
      const w = Math.abs(cropStart.x - cropEnd.x) / canvas.width;
      const h = Math.abs(cropStart.y - cropEnd.y) / canvas.height;

      // If we have a question, save as an A+ Question
      if (selectedQuestion) {
        const { error } = await supabase
          .from('reading_questions')
          .insert({
            question_text: selectedQuestion.question,
            correct_answer: selectedQuestion.answer,
            interaction_type: 'aplus-coordinates',
            evidence_coords: { x, y, w, h, page: pageNum },
            metadata: {
              chunks: chunks.map(c => ({ id: c.id, text: c.text, alternatives: c.alternatives })),
              randomized_ids: randomizedIds,
              source_pdf_id: selectedPdf?.pageId,
              notion_question_id: selectedQuestion.id,
              questions_db_id: questionsDbId
            }
          });
        if (error) throw error;
      } else {
        // Legacy Save (Reading Practice Background)
        // ... (This involves capturing a blob and uploading to Storage)
        const cropCanvas = document.createElement('canvas');
        const pxX = Math.min(cropStart.x, cropEnd.x);
        const pxY = Math.min(cropStart.y, cropEnd.y);
        const pxW = Math.abs(cropStart.x - cropEnd.x);
        const pxH = Math.abs(cropStart.y - cropEnd.y);
        cropCanvas.width = pxW;
        cropCanvas.height = pxH;
        cropCanvas.getContext('2d')?.drawImage(canvas, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);
        
        const blob = await new Promise<Blob | null>(resolve => cropCanvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Failed to capture selection');
        const fileName = `${user?.id || 'guest'}_${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from('reading-passages').upload(fileName, blob);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('reading-passages').getPublicUrl(fileName);
        
        const { error: dbError } = await supabase.from('reading_practices').insert({
          title, passage_image_url: publicUrl, created_by: user?.id
        });
        if (dbError) throw dbError;
      }

      alert('Reading material saved successfully!');
      if (onComplete) onComplete('success');
      else if (onCancel) onCancel();
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // Rendering Helpers
  const renderStepIndicator = () => {
    const steps: { key: CreatorStep; label: string }[] = [
      { key: 'select-pdf', label: 'PDF' },
      { key: 'workspace', label: 'Workspace' },
      { key: 'preview', label: 'Preview' }
    ];
    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === s.key ? 'bg-blue-600 text-white shadow-md' : 
              steps.findIndex(x => x.key === step) > i ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === s.key ? 'bg-white text-blue-600' : 
                steps.findIndex(x => x.key === step) > i ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {steps.findIndex(x => x.key === step) > i ? <Check className="w-3 h-3" /> : (i + 1)}
              </div>
              {s.label}
            </div>
            {i < steps.length - 1 && <div className="w-4 h-px bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden" ref={containerRef}>
      {/* Header */}
      <div className="p-4 bg-white border-b flex items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 uppercase tracking-tighter text-sm">Universal Reading Creator</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-bold uppercase">{step}</span>
              {selectedPdf && <span className="text-[10px] text-blue-500 font-bold truncate max-w-xs">{selectedPdf.name}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-bold">Exit</button>
          )}
          {step !== 'select-pdf' && (
            <button 
              onClick={() => {
                const stepOrder: CreatorStep[] = ['select-pdf', 'workspace', 'preview'];
                const idx = stepOrder.indexOf(step);
                if (idx > 0) setStep(stepOrder[idx - 1]);
              }}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-bold flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 bg-white/50 border-b">{renderStepIndicator()}</div>
        <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
          
          {/* STEP 1: SELECT PDF */}
          {step === 'select-pdf' && (
            <div className="w-full max-w-5xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Local Upload */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-slate-800">Local Upload</h3>
                  <div className="relative group">
                    <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" id="pdf-upload" />
                    <label htmlFor="pdf-upload" className="flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[2rem] p-12 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all bg-white shadow-xl">
                      <Upload className="w-12 h-12 text-slate-300 group-hover:text-blue-500 mb-4" />
                      <span className="text-lg font-black text-slate-700">Choose PDF File</span>
                      <p className="text-sm text-slate-400 font-bold mt-2 text-center">Drag and drop or click to browse</p>
                      {file && <span className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg">{file.name}</span>}
                    </label>
                  </div>
                </div>

                {/* Notion Source */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800">Notion Bank</h3>
                    <div className="relative w-48">
                      <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-xs border text-slate-600 rounded-lg outline-none font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                  </div>
                  {loading ? (
                    <div className="grid grid-cols-1 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
                      {pdfs.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(pdf => (
                        <button key={pdf.pageId} onClick={() => handleRemotePdf(pdf.fileUrl!, pdf.name)} className="text-left p-4 bg-white rounded-2xl border-2 border-slate-100 hover:border-blue-400 hover:shadow-lg transition-all flex items-center gap-3 group">
                          <div className="p-2 bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-all"><FileText className="w-5 h-5" /></div>
                          <span className="text-sm font-black text-slate-700 truncate">{pdf.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}          {/* STEP 2: UNIFIED WORKSPACE (VERTICAL REDESIGN) */}
          {step === 'workspace' && (
            <div className="w-full h-full flex flex-col gap-8 overflow-y-auto max-w-7xl mx-auto px-4 pb-12">
              
              {/* TOP: QUESTION BANK (FULL WIDTH) */}
              <div className="h-[220px] shrink-0 flex flex-col bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="px-6 py-3 border-b flex items-center justify-between bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-100">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em]">Notion Bank</h3>
                      <p className="text-[9px] font-bold text-slate-400 -mt-0.5">Select a task to begin evidence cropping</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-xl transition-all ${showConfig ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:border-indigo-200'}`}><Database className="w-4 h-4" /></button>
                      {showConfig && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                          <p className="text-[10px] font-black text-slate-800 mb-3 uppercase tracking-wider">Database Configuration</p>
                          <input type="text" value={questionsDbId} onChange={(e) => setQuestionsDbId(e.target.value)} className="w-full h-10 px-4 bg-slate-50 border rounded-xl outline-none text-[11px] mb-3 font-mono focus:ring-2 focus:ring-indigo-500/20" placeholder="32-char Database ID..." />
                          <div className="bg-indigo-50/50 p-3 rounded-2xl mb-4 border border-indigo-100/50">
                            <p className="text-[10px] font-bold text-indigo-700 leading-snug">
                              💡 The ID is the 32-character string in your Notion URL after 'notion.so/'.
                            </p>
                          </div>
                          <button onClick={() => { localStorage.setItem('aplus_questions_db_id', questionsDbId); setShowConfig(false); fetchQuestionsForPage(); }} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all">Save & Sync</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  <div className="flex flex-col gap-4">
                    {loading ? (
                      <div className="flex flex-col gap-4 w-full">{[...Array(4)].map((_, i) => <div key={i} className="w-full h-16 bg-slate-50 rounded-2xl animate-pulse" />)}</div>
                    ) : fetchError ? (
                      <div className="w-full p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col justify-center items-center text-center">
                        <Database className="w-8 h-8 text-red-200 mb-2" />
                        <p className="text-[11px] font-black uppercase text-red-600">Sync Failed</p>
                        <p className="text-[10px] font-bold text-red-800/70 max-w-md mt-1">{fetchError.message}</p>
                      </div>
                    ) : questionsOnPage.length === 0 ? (
                      <div className="w-full h-32 flex flex-col items-center justify-center text-slate-300 gap-3 opacity-50">
                        <Search className="w-10 h-10" />
                        <p className="text-xs font-black uppercase tracking-widest">No questions in this database</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {/* Table Header */}
                        <div className="flex px-4 py-2 bg-slate-100/50 rounded-xl border border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          <div className="w-16 shrink-0">Day / Page</div>
                          <div className="flex-1 pl-4">Question & Answer Detail</div>
                        </div>

                        {/* Table Rows */}
                        <div className="flex flex-col gap-2">
                          {questionsOnPage.map(q => (
                            <button 
                              key={q.id} 
                              onClick={() => handleSelectQuestion(q)} 
                              className={`w-full text-left rounded-3xl border-2 transition-all flex group relative overflow-hidden ${
                                selectedQuestion?.id === q.id 
                                  ? 'border-indigo-600 bg-indigo-50/30' 
                                  : 'border-slate-50 hover:border-indigo-100 hover:bg-white hover:shadow-lg'
                              }`}
                            >
                              {/* Left Column: Day/Page info */}
                              <div className={`w-16 shrink-0 flex flex-col items-center justify-center p-4 border-r-2 ${selectedQuestion?.id === q.id ? 'border-indigo-100 bg-indigo-600/5' : 'border-slate-50 bg-slate-50/30'}`}>
                                <span className={`text-xl font-black leading-none ${selectedQuestion?.id === q.id ? 'text-indigo-600' : 'text-slate-700'}`}>
                                  {q.day || '-'}
                                </span>
                                <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">Pg {q.page || '-'}</span>
                              </div>

                              {/* Right Column: Question Content */}
                              <div className="flex-1 p-4 pl-6 relative">
                                <p className={`text-xs font-black leading-relaxed mb-1 ${selectedQuestion?.id === q.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                                  {q.question}
                                </p>
                                <div className="flex items-center gap-2">
                                  <div className={`w-1 h-1 rounded-full shrink-0 ${selectedQuestion?.id === q.id ? 'bg-indigo-400' : 'bg-slate-300'}`} />
                                  <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-500 italic truncate">
                                    Ans: {q.answer}
                                  </p>
                                </div>

                                {selectedQuestion?.id === q.id && (
                                  <div className="absolute top-1/2 -translate-y-1/2 right-6 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200 animate-in zoom-in-50 duration-200">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MIDDLE: PDF & CROPPING (FULL WIDTH) */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-[450px]">
                <div className="flex items-center justify-between bg-white px-6 py-4 rounded-[2rem] shadow-xl border border-slate-100 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100">
                      <button onClick={() => { const p = Math.max(1, pageNum - 1); setPageNum(p); setPageNumInput(p.toString()); fetchQuestionsForPage(p); }} disabled={pageNum <= 1 || loading} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>
                      <div className="flex items-center gap-2 px-3">
                        <input type="text" value={pageNumInput} onChange={(e) => setPageNumInput(e.target.value)} onBlur={() => { const v = parseInt(pageNumInput); if (!isNaN(v) && v >= 1 && v <= numPages) { setPageNum(v); fetchQuestionsForPage(v); } else { setPageNumInput(pageNum.toString()); } }} className="w-10 h-8 text-center font-black border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">of {numPages}</span>
                      </div>
                      <button onClick={() => { const p = Math.min(numPages, pageNum + 1); setPageNum(p); setPageNumInput(p.toString()); fetchQuestionsForPage(p); }} disabled={pageNum >= numPages || loading} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 pr-4 border-r-2 border-slate-100">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" /> Evidence Canvas
                      </span>
                    </div>
                    <button onClick={() => { setCropStart(null); setCropEnd(null); }} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border border-slate-100">
                      <RotateCcw className="w-3.5 h-3.5" /> Clear Selection
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-100/50 rounded-[2.5rem] border-4 border-white shadow-2xl relative flex justify-center p-8 backdrop-blur-sm">
                  <div 
                    className="relative bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] h-fit w-fit transition-transform hover:scale-[1.002]" 
                    onMouseDown={handleMouseDown} 
                    onMouseMove={handleMouseMove} 
                    onMouseUp={handleMouseUp}
                  >
                    {loading && <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center z-10 backdrop-blur-md"><Loader2 className="w-12 h-12 animate-spin text-indigo-600" /><p className="mt-4 text-xs font-black text-indigo-900 uppercase tracking-widest">Rendering Page...</p></div>}
                    <canvas ref={canvasRef} className="max-w-full h-auto cursor-crosshair block rounded-sm shadow-sm" />
                    <div 
                      ref={overlayRef}
                      className="absolute border-[3px] border-indigo-500 bg-indigo-500/10 pointer-events-none shadow-[0_0_25px_rgba(79,70,229,0.4)] ring-2 ring-white/50"
                      style={{ 
                        display: cropStart && cropEnd ? 'block' : 'none',
                        left: cropStart ? Math.min(cropStart.x, cropEnd?.x || cropStart.x) : 0,
                        top: cropStart ? Math.min(cropStart.y, cropEnd?.y || cropStart.y) : 0,
                        width: cropStart && cropEnd ? Math.abs(cropStart.x - cropEnd.x) : 0,
                        height: cropStart && cropEnd ? Math.abs(cropStart.y - cropEnd.y) : 0
                      }} 
                    />
                  </div>
                </div>
              </div>

              {/* BOTTOM: CHUNK EDITOR (FULL WIDTH) */}
              <div className="h-[280px] shrink-0 flex flex-col bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-100">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em]">Chunk Synthesizer</h3>
                      <p className="text-[9px] font-bold text-slate-400 -mt-0.5">Divide the answer into manageable learning steps</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => initializeChunks(selectedQuestion?.answer || '')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
                    <button onClick={combineChunks} disabled={selectedChunkIds.length < 2} className="px-5 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all disabled:opacity-30">Combine Steps</button>
                    <button onClick={() => setStep('preview')} disabled={!cropStart || chunks.length === 0} className="px-8 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black text-xs uppercase tracking-[0.1em] shadow-xl shadow-indigo-100 transition-all disabled:opacity-30 flex items-center gap-2">Continue <ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-x-auto p-6">
                  {chunks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 opacity-50">
                      <Type className="w-10 h-10" />
                      <p className="text-xs font-black uppercase tracking-widest">Select a question to edit chunks</p>
                    </div>
                  ) : (
                    <div className="flex gap-4 h-full pb-2">
                      {chunks.map((chunk) => {
                        const isSelected = selectedChunkIds.includes(chunk.id);
                        return (
                          <div key={chunk.id} className={`flex flex-col gap-3 p-4 min-w-[140px] w-fit rounded-3xl border-2 transition-all ${isSelected ? 'bg-indigo-50/50 border-indigo-500 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
                            <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleChunkSelection(chunk.id)}>
                              <span className={`text-sm font-black truncate pr-2 ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{chunk.text}</span>
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white rotate-0' : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600'}`}>{isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}</div>
                            </div>
                            <div className="space-y-1.5 mt-1 border-t border-slate-100 pt-3">
                              {[0, 1, 2].map(idx => (
                                <div key={idx} className="flex gap-1">
                                  {chunk.alternatives[idx]?.prefix && (
                                    <div className="bg-amber-50 text-amber-700 text-[8px] font-black px-1.5 flex items-center rounded-lg border border-amber-100 shrink-0 uppercase tracking-tighter">
                                      {chunk.alternatives[idx].prefix}
                                    </div>
                                  )}
                                  <input 
                                    type="text" 
                                    value={chunk.alternatives[idx]?.text || ''} 
                                    onChange={(e) => { 
                                      const n = [...chunk.alternatives]; 
                                      if (!n[idx]) n[idx] = { text: '' };
                                      n[idx] = { ...n[idx], text: e.target.value }; 
                                      updateChunkAlternatives(chunk.id, n); 
                                    }} 
                                    placeholder={`Ans ${idx + 2}`} 
                                    className="w-full h-8 px-3 rounded-xl border border-slate-100 bg-slate-50/30 outline-none text-[10px] font-bold focus:border-indigo-500 transition-all font-inter" 
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* STEP 5: PREVIEW & SAVE */}
          {step === 'preview' && (
            <div className="w-full max-w-3xl space-y-8">
              <div className="text-center"><h3 className="text-3xl font-black text-slate-800">Final Verification</h3><p className="text-slate-500 text-sm font-bold mt-2">Verify the interaction behavior and save the question.</p></div>
              <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden relative">
                <div className="mb-8 p-6 bg-slate-50 rounded-3xl">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Question Text</p>
                  <p className="font-black text-lg text-slate-800">{selectedQuestion ? selectedQuestion.question : title}</p>
                </div>
                <div className="flex flex-wrap gap-3 p-2">
                  {chunks.map(c => (
                    <div key={c.id} className="px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm text-sm font-black text-slate-700">{c.text}{c.alternatives.length > 0 && <span className="ml-2 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">+{c.alternatives.length}</span>}</div>
                  ))}
                </div>
                <button onClick={() => handleSaveAll(chunks.map(c => c.id).sort(() => Math.random() - 0.5))} disabled={saving} className="w-full mt-10 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg hover:bg-blue-700 shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                  {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                  {saving ? 'Saving...' : 'Finalize & Save'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
