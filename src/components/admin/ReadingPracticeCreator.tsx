import React, { useState, useRef, useEffect } from 'react';
import {
    parseReadingNotionResponse
} from '../../utils/importParsers';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Plus, Search, FileText, ChevronLeft, ChevronRight, 
  Loader2, Check, Layers, Type, 
  RotateCcw, Database, Upload, Trash2
} from 'lucide-react';
import { getVerbForms, isVerb, getNounForms, type VerbForm, type VerbFormType } from '@/utils/verbUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { 
  DndContext, 
  closestCenter, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Set up PDF.js worker using unpkg CDN since strict hosting environments block .mjs from vite assets
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// @ts-ignore - Vite handled worker import
// import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

interface ReadingPdf {
  pageId: string;
  name: string;
  fileUrl?: string;
  day?: number | string | null;
}

interface ChunkOption {
  id: string;
  text: string;
  alternatives: { text: string; prefix?: string; type?: VerbFormType }[];
  mode?: 'verb' | 'noun';
  selectedFormTypes?: VerbFormType[];
}

interface NotionQuestion {
  id: string;
  question: string;
  answer: string;
  day?: string;
  page?: number;
}

type CreatorStep = 'select-pdf' | 'workspace';

interface ReadingPracticeCreatorProps {
  onComplete?: (id: string) => void;
  onCancel?: () => void;
  initialPdfUrl?: string;
  initialTitle?: string;
  editId?: string;
}

// 1. Sortable Preview Chunk Item
const SortablePreviewChunk: React.FC<{ 
  chunk: ChunkOption;
  previewSelections: Record<string, string>;
  setPreviewSelections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  previewPrefixes: Record<string, string>;
  setPreviewPrefixes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}> = ({ chunk, previewSelections, setPreviewSelections, previewPrefixes, setPreviewPrefixes }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: chunk.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const hasOptions = chunk.alternatives.length > 0;
  
  if (!hasOptions) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners}
        className="px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm text-sm font-black text-slate-700 cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-all"
      >
        {chunk.text}
      </div>
    );
  }

  const options = [{ text: chunk.text }, ...chunk.alternatives];
  const uniqueOptions = Array.from(new Map(options.map(o => [`${o.prefix || ''}:${o.text}`, o])).values());
  
  const selectedAlt = chunk.alternatives.find(a => a.text === previewSelections[chunk.id]);
  const showPrefix = !!selectedAlt?.prefix;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 p-1 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-indigo-300 cursor-grab active:cursor-grabbing"
    >
      {showPrefix && (
        <input
          type="text"
          placeholder="..."
          value={previewPrefixes[chunk.id] || ''}
          onChange={(e) => setPreviewPrefixes(prev => ({ ...prev, [chunk.id]: e.target.value }))}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when typing
          className="w-16 h-10 px-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20 cursor-text"
        />
      )}
      <div className="relative" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <select
          value={previewSelections[chunk.id] || ''}
          onChange={(e) => setPreviewSelections(prev => ({ ...prev, [chunk.id]: e.target.value }))}
          className="h-10 px-4 bg-white border-none rounded-xl text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-slate-50 transition-all appearance-none pr-8 relative bg-no-repeat bg-[right_0.5rem_center]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
        >
          {uniqueOptions.map((opt, i) => (
            <option key={i} value={opt.text}>{opt.text}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export const ReadingPracticeCreator: React.FC<ReadingPracticeCreatorProps> = ({ 
  onComplete, 
  onCancel,
  initialPdfUrl,
  initialTitle,
  editId
}) => {
  const { user, session } = useAuth();
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  
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
  
  // Preview Selection State
  const [previewSelections, setPreviewSelections] = useState<Record<string, string>>({});
  const [previewPrefixes, setPreviewPrefixes] = useState<Record<string, string>>({});
  const [previewChunkOrder, setPreviewChunkOrder] = useState<string[]>([]);

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Multi-Question State
  const [localQuestions, setLocalQuestions] = useState<{
    id: string;
    question: NotionQuestion;
    chunks: ChunkOption[];
    coords: { x: number; y: number; w: number; h: number; page: number };
    imageBlob: Blob;
    previewUrl: string;
    randomizedIds: string[];
  }[]>([]);
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // 1. Initial Load & Fetching
  useEffect(() => {
    fetchPdfs();
    if (initialPdfUrl) {
      handleRemotePdf(initialPdfUrl, initialTitle || 'Untitled');
    }
  }, []);

  useEffect(() => {
    if (editId) {
      fetchPracticeForEditing();
    }
  }, [editId]);

  const fetchPracticeForEditing = async () => {
    if (!editId) return;
    setLoading(true);
    try {
      // 1. Fetch practice metadata
      const { data: practice, error: practiceError } = await supabase
        .from('reading_practices')
        .select('*')
        .eq('id', editId)
        .single();

      if (practiceError) throw practiceError;
      if (practice.title) setTitle(practice.title);
      
      // 2. Fetch associated questions
      const { data: questions, error: questionsError } = await supabase
        .from('reading_questions')
        .select('*')
        .eq('practice_id', editId)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      // 3. Map to localQuestions format
      const mappedQuestions = questions.map((q: any) => ({
        id: q.id,
        question: {
          id: q.metadata?.notion_question_id || q.id,
          question: q.question_text,
          answer: q.correct_answer,
          day: q.metadata?.day,
        },
        chunks: q.metadata?.chunks || [],
        coords: q.evidence_coords,
        imageBlob: new Blob(), // We use the existing URL instead of re-capturing
        previewUrl: q.question_image_url,
        randomizedIds: q.metadata?.randomized_ids || [],
        metadata: q.metadata // Preserve all metadata
      }));

      setLocalQuestions(mappedQuestions);

      // Restore selectedDay from the first question if available
      const firstDay = (mappedQuestions[0]?.question as any)?.day || (mappedQuestions[0] as any)?.metadata?.day;
      if (firstDay) {
        setSelectedDay(firstDay);
      }

      // 4. Restore Context
      const firstMetadata = (mappedQuestions[0] as any)?.metadata;
      if (firstMetadata?.questions_db_id) {
        setQuestionsDbId(firstMetadata.questions_db_id);
      }
      
      // 5. Handle PDF loading if source exists
      if (practice.source_pdf_url) {
        // Try to find full context for Day restoration
        const fullContext = pdfs.find(p => p.fileUrl === practice.source_pdf_url);
        handleRemotePdf(practice.source_pdf_url, practice.title || 'Untitled', fullContext);
      }
    } catch (err) {
      console.error('Error fetching practice for editing:', err);
      alert('Failed to load practice for editing.');
    } finally {
      setLoading(false);
    }
  };

  // 1.5 Restore Activity Context if PDF URL matches known activity
  useEffect(() => {
    if (pdfs.length > 0 && selectedPdf && selectedPdf.pageId === 'remote' && selectedPdf.fileUrl) {
      const match = pdfs.find(p => p.fileUrl === selectedPdf.fileUrl);
      if (match && match.pageId !== selectedPdf.pageId) {
        console.log('[ReadingCreator] Restored Activity Context:', match.name);
        setSelectedPdf(match);
      }
    }
  }, [pdfs, selectedPdf]);

  // Sync Preview state and Shuffle Chunks
  useEffect(() => {
    if (step === 'workspace') {
      const selections: Record<string, string> = { ...previewSelections };
      const prefixes: Record<string, string> = { ...previewPrefixes };

      chunks.forEach(c => {
        if (c.alternatives.length > 0 && !selections[c.id]) {
          let defaultOpt = c.alternatives[0];
          if (c.mode === 'verb') {
            const base = c.alternatives.find(a => a.type === 'base');
            if (base) defaultOpt = base;
          } else if (c.mode === 'noun') {
            const singular = c.alternatives.find(a => a.type === 'singular');
            if (singular) defaultOpt = singular;
          }
          if (defaultOpt) {
            selections[c.id] = defaultOpt.text;
            if (defaultOpt.prefix) prefixes[c.id] = '';
          }
        }
      });

      setPreviewSelections(selections);
      setPreviewPrefixes(prefixes);
      
      // Shuffle chunks for preview
      if (chunks.length > 0) {
        setPreviewChunkOrder(chunks.map(c => c.id).sort(() => Math.random() - 0.5));
      }
    }
  }, [step, chunks]);

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
    } catch (err) {
      console.error('Error fetching PDFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemotePdf = async (url: string, name: string, fullContext?: ReadingPdf) => {
    setSelectedPdf(fullContext || { pageId: 'remote', name, fileUrl: url });
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
              'Authorization': `Bearer ${session?.access_token || anonKey}`,
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
        fetchQuestionsForPage();
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

    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        renderTask = page.render({ canvasContext: context, viewport, canvas });
        await renderTask.promise;
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') {
          // Ignore cancellation errors
          return;
        }
        console.error('Render error:', err);
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, step]);

  const fetchQuestionsForPage = async () => {
    if (!selectedPdf || selectedPdf.pageId === 'local') {
      setQuestionsOnPage([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      // Use notion-api directly — the same proven pattern as Spaced Repetition's NotionImporter
      const { data, error } = await supabase.functions.invoke('notion-api', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: { 
          databaseId: questionsDbId,
          action: 'query-mcq-database'
        }
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
      setQuestionsOnPage(allQuestions);
      
      // Sort by Day then Page ascending
      allQuestions.sort((a, b) => {
        const dayA = Number(a.day) || 0;
        const dayB = Number(b.day) || 0;
        if (dayA !== dayB) return dayA - dayB;
        return (a.page || 0) - (b.page || 0);
      });

      console.log(`[ReadingPractice] Fetched ${allQuestions.length} total questions from Notion.`);
      setQuestionsOnPage(allQuestions);
      
      const uniqueDays = Array.from(new Set(allQuestions.map(q => q.day).filter(Boolean))) as string[];
      if (uniqueDays.length > 0 && !selectedDay) {
        setSelectedDay(uniqueDays[0]);
      }
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
      fetchQuestionsForPage();
    }
  };


  const initializeChunks = (text: string) => {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const initialChunks: ChunkOption[] = words.map(w => {
      const verbForms = getVerbForms(w);
      const isV = isVerb(w);
      return {
        id: crypto.randomUUID(),
        text: w,
        mode: isV ? 'verb' : undefined,
        selectedFormTypes: isV ? ['base'] : [],
        alternatives: isV ? verbForms.filter(f => f.type === 'base').map(vf => ({ text: vf.text, prefix: vf.prefix, type: vf.type })) : []
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

  const handleToggleMode = (id: string) => {
    setChunks(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newMode = c.mode === 'noun' ? 'verb' : 'noun';
      let newAlts = [];
      let selectedTypes: VerbFormType[] = [];
      
      if (newMode === 'noun') {
        const nounForms = getNounForms(c.text);
        newAlts = nounForms.map(vf => ({ text: vf.text, type: vf.type }));
        selectedTypes = nounForms.map(vf => vf.type);
      } else {
        const verbForms = getVerbForms(c.text);
        newAlts = verbForms.filter(f => f.type === 'base').map(vf => ({ text: vf.text, prefix: vf.prefix, type: vf.type }));
        selectedTypes = ['base'];
      }
      return { ...c, mode: newMode, alternatives: newAlts, selectedFormTypes: selectedTypes };
    }));
  };

  const handleToggleVerbForm = (chunkId: string, form: VerbForm) => {
    setChunks(prev => prev.map(c => {
      if (c.id !== chunkId) return c;
      
      const currentTypes = c.selectedFormTypes || [];
      const isSelected = currentTypes.includes(form.type);
      
      let nextTypes: VerbFormType[];
      if (isSelected) {
        nextTypes = currentTypes.filter(t => t !== form.type);
      } else {
        nextTypes = [...currentTypes, form.type];
      }
      
      // Update alternatives based on selected types
      const allPossibleForms = c.mode === 'noun' ? getNounForms(c.text) : getVerbForms(c.text);
      const nextAlts = allPossibleForms
        .filter(f => nextTypes.includes(f.type))
        .map(f => ({ text: f.text, prefix: f.prefix, type: f.type }));
        
      return { ...c, selectedFormTypes: nextTypes, alternatives: nextAlts };
    }));
  };


  const handleAddQuestion = async (randomizedIds: string[]) => {
    if (!pdfDoc || !cropStart || !cropEnd || !selectedQuestion) {
      alert('Please select a question and draw a crop selection on the PDF first.');
      return;
    }
    
    const pxW = Math.abs(cropStart.x - cropEnd.x);
    const pxH = Math.abs(cropStart.y - cropEnd.y);
    
    if (pxW < 10 || pxH < 10) {
      alert('Crop selection is too small. Please draw a larger area.');
      return;
    }
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not ready');
      
      const pxX = Math.min(cropStart.x, cropEnd.x);
      const pxY = Math.min(cropStart.y, cropEnd.y);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = pxW;
      cropCanvas.height = pxH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) throw new Error('Could not create crop canvas context');
      cropCtx.drawImage(canvas, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);
      
      const blob = await new Promise<Blob | null>(resolve => cropCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to capture selection as image.');
      
      const previewUrl = URL.createObjectURL(blob);
      const newId = crypto.randomUUID(); // ALWAYS generate a new ID for Add
      
      const newLocalQuestion = {
        id: newId,
        question: selectedQuestion,
        chunks: [...chunks],
        coords: { 
          x: pxX / canvas.width, 
          y: pxY / canvas.height, 
          w: pxW / canvas.width, 
          h: pxH / canvas.height, 
          page: pageNum 
        },
        imageBlob: blob,
        previewUrl,
        randomizedIds
      };

      // ALWAYS append on Add
      setLocalQuestions(prev => [...prev, newLocalQuestion]);
      // After adding, detach so the next addition is completely fresh
      setEditingLocalId(null);

    } catch (err: any) {
      console.error('[ReadingCreator] Add error:', err);
      alert(`Failed to add question: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUpdateQuestion = async (randomizedIds: string[]) => {
    if (!editingLocalId) return;
    if (!pdfDoc || !cropStart || !cropEnd || !selectedQuestion) {
      alert('Please select a question and draw a crop selection on the PDF first.');
      return;
    }

    const pxW = Math.abs(cropStart.x - cropEnd.x);
    const pxH = Math.abs(cropStart.y - cropEnd.y);
    
    if (pxW < 10 || pxH < 10) {
      alert('Crop selection is too small. Please draw a larger area.');
      return;
    }

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not ready');
      
      const pxX = Math.min(cropStart.x, cropEnd.x);
      const pxY = Math.min(cropStart.y, cropEnd.y);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = pxW;
      cropCanvas.height = pxH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) throw new Error('Could not create crop canvas context');
      cropCtx.drawImage(canvas, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);
      
      const blob = await new Promise<Blob | null>(resolve => cropCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to capture selection as image.');
      
      const previewUrl = URL.createObjectURL(blob);
      
      const updatedLocalQuestion = {
        id: editingLocalId,
        question: selectedQuestion,
        chunks: [...chunks],
        coords: { 
          x: pxX / canvas.width, 
          y: pxY / canvas.height, 
          w: pxW / canvas.width, 
          h: pxH / canvas.height, 
          page: pageNum 
        },
        imageBlob: blob,
        previewUrl,
        randomizedIds
      };

      setLocalQuestions(prev => prev.map(lq => lq.id === editingLocalId ? updatedLocalQuestion : lq));
      // Keep attached after update to allow further continuous editing
    } catch (err: any) {
      console.error('[ReadingCreator] Update error:', err);
      alert(`Failed to update question: ${err.message || 'Unknown error'}`);
    }
  };

  const handleRemoveLocalQuestion = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLocalQuestions(prev => prev.filter(lq => lq.id !== id));
  };

  const handleLoadFromQueue = (lq: typeof localQuestions[0]) => {
    // 1. Restore question and chunks
    setSelectedQuestion(lq.question);
    setChunks([...lq.chunks]);
    
    // 2. Restore PDF Page
    if (lq.coords.page !== pageNum) {
      setPageNum(lq.coords.page);
      setPageNumInput(lq.coords.page.toString());
      fetchQuestionsForPage();
    }
    
    // 3. Restore Crop Coordinates (scaled back to current canvas pixels)
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const restoredStart = { x: lq.coords.x * canvas.width, y: lq.coords.y * canvas.height };
      const restoredEnd = { 
        x: (lq.coords.x + lq.coords.w) * canvas.width, 
        y: (lq.coords.y + lq.coords.h) * canvas.height 
      };
      
      setCropStart(restoredStart);
      setCropEnd(restoredEnd);
      cropStartRef.current = restoredStart;
      cropEndRef.current = restoredEnd;
    }

    // 4. Set as active editing item
    setEditingLocalId(lq.id);
    
    // 5. Scroll to workspace area
    containerRef.current?.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleStartNewQuestion = () => {
    setIsResetting(true);
    setEditingLocalId(null);
    setSelectedQuestion(null);
    setChunks([]);
    setSelectedChunkIds([]);
    setPreviewSelections({});
    setPreviewPrefixes({});
    setPreviewChunkOrder([]);
    setCropStart(null);
    setCropEnd(null);
    cropStartRef.current = null;
    cropEndRef.current = null;
    setIsCropping(false);
    
    // Scroll to Top
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    // End transition
    setTimeout(() => {
      setIsResetting(false);
    }, 400);
  };

  const handlePrepareNewCard = () => {
    // This is the "Templating" reset: only clear the editing ID 
    // so the purple button becomes "Add as NEW" again, but keep data.
    setEditingLocalId(null);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPracticeQueue = (isInsideCard: boolean = false) => {
    const shouldShow = localQuestions.length > 0 || (step === 'workspace' && isInsideCard);
    if (!shouldShow) return null;
    return (
      <div className={`${isInsideCard ? 'mt-8' : 'mt-12 pt-12 border-t-4 border-dashed border-slate-100'} animate-in fade-in slide-in-from-bottom-8 duration-700`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-xl uppercase tracking-widest">Practice Content Queue</h3>
              <p className="text-xs font-bold text-slate-400 mt-0.5">You have {localQuestions.length} question(s) staged for this practice</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrepareNewCard}
              className="px-6 py-4 bg-white border-2 border-slate-100 text-indigo-600 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.1em] hover:border-indigo-100 hover:bg-indigo-50/30 transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Prepare Next Question (Keep current as template)
            </button>
            
            <button
              onClick={handleSavePractice}
              disabled={saving}
              className="px-8 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.1em] hover:bg-emerald-600 shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
              {saving ? 'Completing Save...' : (editId ? 'Update Practice' : 'Save Practice & Finalize')}
            </button>
          </div>
        </div>

        {localQuestions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {localQuestions.map((lq, idx) => (
              <div 
                key={lq.id} 
                onClick={() => handleLoadFromQueue(lq)}
                className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-6 relative group hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-50 transition-all flex flex-col cursor-pointer active:scale-[0.98]"
              >
                <button 
                  onClick={(e) => handleRemoveLocalQuestion(lq.id, e)}
                  className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100 z-10"
                  title="Remove from queue"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">{idx + 1}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question {idx + 1}</span>
                  <div className="flex-1" />
                  <div className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity">
                    CLICK TO EDIT
                  </div>
                </div>

                <div className="aspect-[16/10] bg-slate-50 rounded-2xl overflow-hidden mb-4 border border-slate-100">
                  <img src={lq.previewUrl} className="w-full h-full object-cover" alt="Passage Crop" />
                </div>

                <div className="flex-1">
                  <p className="text-xs font-black text-slate-800 line-clamp-2 leading-relaxed mb-3">{lq.question.question}</p>
                  <div className="flex flex-wrap gap-1.5 opacity-60">
                    {lq.chunks.slice(0, 4).map(c => (
                      <span key={c.id} className="px-2 py-0.5 bg-slate-100 rounded-lg text-[8px] font-bold text-slate-500 uppercase">{c.text}</span>
                    ))}
                    {lq.chunks.length > 4 && <span className="text-[8px] font-bold text-slate-300">+{lq.chunks.length - 4} more</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 p-8 text-center mb-8">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No other questions in queue</p>
          </div>
        )}
      </div>
    );
  };

  const handlePreviewDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPreviewChunkOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSavePractice = async () => {
    if (localQuestions.length === 0) {
      alert('Please add at least one question to the practice.');
      return;
    }
    
    setSaving(true);
    try {
      // 1. Create the Reading Practice record
      // Use the first question as a base for the title if not set
      const practiceTitle = title || localQuestions[0].question.question.substring(0, 50);
      console.log('[ReadingCreator] Saving practice record:', practiceTitle, editId ? `(Editing: ${editId})` : '(New)');
      
      let coverUrl = localQuestions[0].previewUrl;

      // If it's a new image (from an actual blob), upload it
      if (localQuestions[0].imageBlob.size > 0) {
        const fileName = `${user?.id || 'guest'}_p_${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from('reading-passages').upload(fileName, localQuestions[0].imageBlob);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('reading-passages').getPublicUrl(fileName);
        coverUrl = publicUrl;
      }

      const practicePayload = {
        title: practiceTitle,
        passage_image_url: coverUrl,
        created_by: user?.id,
        source_pdf_url: selectedPdf?.fileUrl || null,
        is_deleted: false // Ensure it's not deleted if we're editing
      };

      let practiceId = editId;

      if (editId) {
        const { error: dbError } = await supabase
          .from('reading_practices')
          .update(practicePayload)
          .eq('id', editId);
        if (dbError) throw dbError;
      } else {
        const { data: practiceData, error: dbError } = await supabase
          .from('reading_practices')
          .insert(practicePayload)
          .select()
          .single();
        if (dbError) throw dbError;
        practiceId = practiceData.id;
      }

      // 2. Refresh questions: delete old ones and insert new ones
      if (editId) {
        const { error: deleteError } = await supabase
          .from('reading_questions')
          .delete()
          .eq('practice_id', editId);
        if (deleteError) throw deleteError;
      }

      const questionPromises = localQuestions.map(async (lq, index) => {
        let imageUrl = lq.previewUrl;
        
        // If it's a new image (from an actual blob), upload it
        if (lq.imageBlob.size > 0) {
          const fileName = `${user?.id || 'guest'}_q_${Date.now()}_${index}.png`;
          const { error: uploadError } = await supabase.storage.from('reading-passages').upload(fileName, lq.imageBlob);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('reading-passages').getPublicUrl(fileName);
          imageUrl = publicUrl;
        }

        return supabase.from('reading_questions').insert({
          practice_id: practiceId,
          question_text: lq.question.question,
          correct_answer: lq.question.answer,
          interaction_type: 'aplus-coordinates',
          evidence_coords: lq.coords,
          question_image_url: imageUrl,
          order_index: index,
          metadata: {
            chunks: lq.chunks.map(c => ({ id: c.id, text: c.text, alternatives: c.alternatives })),
            randomized_ids: lq.randomizedIds,
            source_pdf_id: selectedPdf?.pageId,
            notion_question_id: lq.question.id,
            questions_db_id: questionsDbId,
            day: lq.question.day // Preserve the day in metadata
          }
        });
      });

      const results = await Promise.all(questionPromises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to save some questions: ${errors[0].error?.message}`);
      }

      console.log('[ReadingCreator] Save complete!');
      alert(editId ? 'Reading practice updated successfully!' : 'Reading practice saved successfully!');
      
      // Cleanup preview URLs (only for new blobs)
      localQuestions.forEach(q => {
        if (q.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(q.previewUrl);
        }
      });
      
      if (onComplete) onComplete('success');
      else if (onCancel) onCancel();
    } catch (err: any) {
      console.error('[ReadingCreator] Save error:', err);
      alert(`Failed to save: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Rendering Helpers
  const renderStepIndicator = () => {
    const steps: { key: CreatorStep; label: string }[] = [
      { key: 'select-pdf', label: 'PDF' },
      { key: 'workspace', label: 'Workspace' }
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
            <h2 className="font-bold text-slate-800 uppercase tracking-tighter text-sm">{editId ? 'Edit' : 'Universal'} Reading Creator</h2>
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
                if (step === 'workspace') setStep('select-pdf');
              }}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-bold flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isResetting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
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
                      <div className="flex h-full min-h-0 gap-6">
                        {/* Column 1: Day Sidebar */}
                        <div className="w-24 shrink-0 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar border-r border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Day</p>
                          {Array.from(new Set(questionsOnPage.map(q => q.day).filter(Boolean)))
                            .sort((a, b) => {
                              const dayA = parseInt(a!.replace(/\D/g, '')) || 0;
                              const dayB = parseInt(b!.replace(/\D/g, '')) || 0;
                              return dayA - dayB;
                            })
                            .map(day => (
                              <button
                                key={day}
                                onClick={() => setSelectedDay(day!)}
                                className={`px-3 py-2 rounded-xl text-left transition-all font-black text-xs ${
                                  selectedDay === day 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                        </div>

                        {/* Column 2: Question List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                          <div className="flex flex-col gap-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Questions for {selectedDay || 'Selected Day'}</p>
                            {questionsOnPage
                              .filter(q => q.day === selectedDay)
                              .map(q => (
                                <button 
                                  key={q.id} 
                                  onClick={() => handleSelectQuestion(q)} 
                                  className={`w-full text-left rounded-2xl border-2 transition-all flex group relative overflow-hidden ${
                                    selectedQuestion?.id === q.id 
                                      ? 'border-indigo-600 bg-indigo-50/30' 
                                      : 'border-slate-50 hover:border-indigo-100 hover:bg-white hover:shadow-md'
                                  }`}
                                >
                                  {/* Left Strip: Page info */}
                                  <div className={`w-12 shrink-0 flex flex-col items-center justify-center p-2 border-r-2 ${selectedQuestion?.id === q.id ? 'border-indigo-100 bg-indigo-600/5' : 'border-slate-50 bg-slate-50/30'}`}>
                                    <span className={`text-xs font-black leading-none ${selectedQuestion?.id === q.id ? 'text-indigo-600' : 'text-slate-700'}`}>
                                      P{q.page || '-'}
                                    </span>
                                  </div>

                                  {/* Content Area */}
                                  <div className="flex-1 p-3 pl-4 relative">
                                    <p className={`text-[11px] font-black leading-tight mb-1 line-clamp-2 ${selectedQuestion?.id === q.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                                      {q.question}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1 h-1 rounded-full shrink-0 ${selectedQuestion?.id === q.id ? 'bg-indigo-400' : 'bg-slate-300'}`} />
                                      <p className="text-[9px] font-bold text-slate-400 group-hover:text-slate-500 italic truncate max-w-[200px]">
                                        Ans: {q.answer}
                                      </p>
                                    </div>

                                    {selectedQuestion?.id === q.id && (
                                      <div className="absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200 animate-in zoom-in-50 duration-200">
                                        <Check className="w-3 h-3" />
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            {questionsOnPage.filter(q => q.day === selectedDay).length === 0 && (
                              <div className="h-20 flex items-center justify-center text-slate-300 italic text-[10px] font-bold uppercase tracking-widest">
                                Select a day to view questions
                              </div>
                            )}
                          </div>
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
                      <button onClick={() => { const p = Math.max(1, pageNum - 1); setPageNum(p); setPageNumInput(p.toString()); fetchQuestionsForPage(); }} disabled={pageNum <= 1 || loading} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>
                      <div className="flex items-center gap-2 px-3">
                        <input type="text" value={pageNumInput} onChange={(e) => setPageNumInput(e.target.value)} onBlur={() => { const v = parseInt(pageNumInput); if (!isNaN(v) && v >= 1 && v <= numPages) { setPageNum(v); fetchQuestionsForPage(); } else { setPageNumInput(pageNum.toString()); } }} className="w-10 h-8 text-center font-black border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">of {numPages}</span>
                      </div>
                      <button onClick={() => { const p = Math.min(numPages, pageNum + 1); setPageNum(p); setPageNumInput(p.toString()); fetchQuestionsForPage(); }} disabled={pageNum >= numPages || loading} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 pr-4 border-r-2 border-slate-100">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" /> Evidence Canvas
                      </span>
                    </div>
                    
                    <button 
                      onClick={handleStartNewQuestion} 
                      className="flex items-center gap-2 px-6 py-3 bg-white text-slate-600 hover:text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 border-slate-100 hover:border-red-100 shadow-sm group"
                    >
                      <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-90 transition-transform" /> Full Reset (Blank Slot)
                    </button>

                    <button onClick={() => { setCropStart(null); setCropEnd(null); }} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border border-slate-100">
                      <RotateCcw className="w-3.5 h-3.5" /> Clear Crop Only
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
                            <div className={`flex items-center justify-between cursor-pointer`} onClick={() => toggleChunkSelection(chunk.id)}>
                              <span className={`text-sm font-black truncate pr-2 ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{chunk.text}</span>
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white rotate-0' : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600'}`}>{isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}</div>
                            </div>

                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleMode(chunk.id); }}
                              className={`w-full py-1 text-[8px] font-black uppercase tracking-widest rounded-lg border transition-all ${chunk.mode === 'noun' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:text-amber-600'}`}
                            >
                              {chunk.mode === 'noun' ? 'Noun Mode' : 'Switch to Noun'}
                            </button>

                            <div className="space-y-1 mt-1 border-t border-slate-100 pt-3 flex-1 overflow-y-auto min-h-0">
                              {(chunk.mode === 'noun' ? getNounForms(chunk.text) : getVerbForms(chunk.text)).map((vForm) => {
                                const isChecked = (chunk.selectedFormTypes || []).includes(vForm.type);
                                return (
                                  <label
                                    key={vForm.type}
                                    className={`flex items-start gap-2 p-1.5 rounded-xl cursor-pointer transition-all ${isChecked ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-slate-50 border-transparent'}`}
                                    onClick={(e) => { e.stopPropagation(); handleToggleVerbForm(chunk.id, vForm); }}
                                  >
                                    <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                      {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={`text-[10px] font-bold leading-none ${isChecked ? 'text-indigo-900' : 'text-slate-600'}`}>
                                        {vForm.prefix ? <span className="opacity-50 mr-1 italic">{vForm.prefix}</span> : null}
                                        {vForm.text}
                                      </span>
                                      <span className="text-[7px] font-black uppercase tracking-tighter text-slate-400 mt-0.5">
                                        {vForm.type.replace('_', ' ')}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                              {/* Fallback if no forms detected but mode is set */}
                              {(chunk.mode === 'verb' || chunk.mode === 'noun') && (chunk.mode === 'noun' ? getNounForms(chunk.text) : getVerbForms(chunk.text)).length === 0 && (
                                <p className="text-[9px] text-slate-400 italic text-center py-2">No forms detected</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>


                {/* UNIFIED INTERACTIVE PREVIEW & SAVE */}
                {chunks.length > 0 && (
                  <div className="mt-8 border-t-2 border-slate-50 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-100">
                          <Check className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Interactive Preview</h3>
                          <p className="text-[10px] font-bold text-slate-400 -mt-0.5">Test the student experience and stage the question</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 p-8 rounded-[3rem] border border-slate-100 relative mb-8">
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handlePreviewDragEnd}
                      >
                        <SortableContext 
                          items={previewChunkOrder}
                          strategy={horizontalListSortingStrategy}
                        >
                          <div className="flex flex-wrap gap-3 p-2">
                            {previewChunkOrder.map(chunkId => {
                              const chunk = chunks.find(c => c.id === chunkId);
                              if (!chunk) return null;
                              return (
                                <SortablePreviewChunk 
                                  key={chunk.id}
                                  chunk={chunk}
                                  previewSelections={previewSelections}
                                  setPreviewSelections={setPreviewSelections}
                                  previewPrefixes={previewPrefixes}
                                  setPreviewPrefixes={setPreviewPrefixes}
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>

                      <div className="flex flex-col gap-3 mt-8">
                        {editingLocalId ? (
                          <>
                            <button
                              onClick={() => handleUpdateQuestion(chunks.map(c => c.id).sort(() => Math.random() - 0.5))}
                              disabled={saving || !cropStart}
                              className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg hover:bg-indigo-700 shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                              <Check className="w-6 h-6" />
                              {`Update Card #${localQuestions.findIndex(q => q.id === editingLocalId) + 1} in Queue`}
                            </button>
                            <button
                              onClick={() => handleAddQuestion(chunks.map(c => c.id).sort(() => Math.random() - 0.5))}
                              disabled={saving || !cropStart}
                              className="w-full py-3 bg-emerald-600 text-white rounded-[1.5rem] font-bold text-sm hover:bg-emerald-700 shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Add as NEW Question (Card #{localQuestions.length + 1})
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleAddQuestion(chunks.map(c => c.id).sort(() => Math.random() - 0.5))}
                            disabled={saving || !cropStart}
                            className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg hover:bg-indigo-700 shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                          >
                            <Plus className="w-6 h-6" />
                            {`Add as NEW Question (Card #${localQuestions.length + 1})`}
                          </button>
                        )}
                      </div>

                      {/* PRACTICE CONTENT QUEUE (IN-CARD) */}
                      {renderPracticeQueue(true)}
                    </div>
                  </div>
                )}

              </div>
            )}

        </div>
      </div>
    </div>
  );
};
