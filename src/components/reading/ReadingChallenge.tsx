import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  Coins, 
  Lightbulb, 
  Target,
  ArrowRight,
  CheckCircle2,
  XCircle,
  SkipForward,
  Loader2,
  Type
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import confetti from 'canvas-confetti';

// --- Types ---
interface Question {
  id: string;
  question_text: string | null;
  correct_answer: string;
  error_sentence?: string;
  error?: string;
  interaction_type: 'rearrange' | 'proofreading' | 'aplus-coordinates' | 'full-typing';
  level: number;
  metadata: any;
  evidence_coords: any;
}

interface ReadingChallengeProps {
  practiceId: string;
  studentId: string;
  assignmentId?: string;
  interactionMode?: 'unscramble' | 'proofreading' | 'advanced';
  onComplete: (score: number, bonus: number) => void;
  onExit: () => void;
}

// --- Sub-Components ---

// 1. Sortable Word Item for Unscramble Mode
const SortableWord: React.FC<{ 
  id: string; 
  text: string; 
  selectedValue?: string;
  options?: { text: string; prefix?: string }[]; 
  onOptionChange?: (val: string, prefixVal?: string) => void;
  isSelected?: boolean;
  prefixValue?: string;
}> = ({ id, text, selectedValue, options, onOptionChange, isSelected, prefixValue }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`px-4 py-2 bg-white border-2 ${isSelected ? 'border-indigo-500 shadow-indigo-100' : 'border-slate-200'} rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-all font-medium flex items-center gap-2`}
    >
      {options && options.length > 0 ? (
        <div className="flex items-center gap-2">
          {/* Prefix Input Box for Verbs (e.g. is/are) */}
          {options.find(opt => opt.text === text)?.prefix && (
            <input 
              type="text"
              placeholder="..."
              value={prefixValue || ''}
              onChange={(e) => onOptionChange && onOptionChange(text, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 h-7 px-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          )}
          <select 
            className="bg-indigo-50 text-indigo-700 font-bold rounded px-1 outline-none pointer-events-auto cursor-pointer"
            value={selectedValue || text}
            onChange={(e) => {
              onOptionChange && onOptionChange(e.target.value, prefixValue);
            }}
            onClick={(e) => e.stopPropagation()} // Prevent drag trigger on click
          >
            {options.map((opt, oIdx) => <option key={`${opt.text}-${oIdx}`} value={opt.text}>{opt.text}</option>)}
          </select>
        </div>
      ) : (
        <span>{text}</span>
      )}
    </div>
  );
};

// --- Main Component ---
console.log('ReadingChallenge.tsx: File loaded');

export const ReadingChallenge: React.FC<ReadingChallengeProps> = ({
  practiceId,
  studentId,
  assignmentId,
  interactionMode: propInteractionMode,
  onComplete,
  onExit
}) => {
  window.alert('READING CHALLENGE RENDERED');
  console.log('ReadingChallenge: Component rendered with propInteractionMode:', propInteractionMode);
  // State
  const [loading, setLoading] = useState(true);
  const [practice, setPractice] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bonusCoins, setBonusCoins] = useState(0);
  
  // Interaction State
  const [interactionMode /*, setInteractionMode*/] = useState<'unscramble' | 'proofreading' | 'advanced'>(propInteractionMode || 'unscramble');
  const [unscrambleWords, setUnscrambleWords] = useState<{id: string, text: string, options?: {text: string, prefix?: string}[]}[]>([]);
  const [proofreadingChunks, setProofreadingChunks] = useState<{id: number, text: string, isError: boolean}[]>([]);
  const [selectedProofreadingIndex, setSelectedProofreadingIndex] = useState<number | null>(null);
  const [userSelections, setUserSelections] = useState<Record<string, string>>({}); // For options/dropdowns
  
  // @@CHALLENGE_MARKER_V2@@
  useEffect(() => {
    console.log('@@CHALLENGE_MARKER_V2@@ ReadingChallenge mounted');
  }, []);
  const [userPrefixes, setUserPrefixes] = useState<Record<string, string>>({}); // For prefix inputs
  const [proofreadingCorrection, setProofreadingCorrection] = useState('');
  const [typingAnswer, setTypingAnswer] = useState('');
  
  // Progress State
  const [status, setStatus] = useState<'idle' | 'answering' | 'submitting' | 'feedback' | 'finished'>('answering');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isEvidenceLinked, setIsEvidenceLinked] = useState(false);
  const [showEvidencePrompt, setShowEvidencePrompt] = useState(false);

  // Refs
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    console.log('ReadingChallenge: useEffect triggered with practiceId:', practiceId, 'interactionMode:', interactionMode);
    if (practiceId) {
      loadData();
    }
  }, [practiceId, interactionMode]);

  const loadData = async () => {
    console.log('ReadingChallenge: loadData started for practiceId:', practiceId, 'mode:', interactionMode);
    setLoading(true);
    try {
      // 1. Fetch Practice
      const { data: pData, error: pError } = await supabase
        .from('reading_practices')
        .select('*')
        .eq('id', practiceId)
        .single();
      
      if (pError) throw pError;
      setPractice(pData);

      // 2. Fetch Questions
      let query = supabase
        .from('reading_questions')
        .select('*')
        .eq('practice_id', practiceId);

      // Filter by interaction mode if provided
      if (interactionMode) { // Use component's interactionMode state
        if (interactionMode === 'unscramble') {
          query = query.in('interaction_type', ['rearrange', 'aplus-coordinates']);
        } else {
          query = query.eq('interaction_type', 'proofreading');
        }
      }

      const { data: qData, error: qError } = await query.order('order_index', { ascending: true });
      
      if (qError) throw qError;

      await supabase.from('users').select('*').eq('id', studentId).single();
      
      console.log('ReadingChallenge: Fetched qData:', qData);
      console.log('ReadingChallenge: interactionMode:', interactionMode);

      const filteredQuestions = (qData as unknown as Question[] || []).filter(q => {
        // Repeated words rule for proofreading
        if (q.interaction_type === 'proofreading' && q.error_sentence && q.error) {
          const words = q.error_sentence.toLowerCase().split(/\s+/);
          const errorLower = q.error.toLowerCase().trim();
          
          // Count occurrences of the error word
          if (errorLower !== '') {
            const count = words.filter(w => w === errorLower).length;
            if (count > 1) {
              console.log(`ReadingChallenge: Filtering out proofreading question ${q.id} due to ambiguous error word "${errorLower}"`);
              return false; // Exclude if ambiguous
            }
          }
        }
        return true;
      });

      console.log('ReadingChallenge: filteredQuestions:', filteredQuestions);

      setQuestions(filteredQuestions);
      
      if (filteredQuestions.length > 0) {
        setupInteraction(filteredQuestions[0]);
      } else {
        // If no questions for the selected mode, reset state
        setUnscrambleWords([]);
        setProofreadingChunks([]);
        setCurrentIndex(0);
        setStatus('idle'); // Or some other appropriate state
      }
    } catch (err) {
      console.error('Error loading challenge:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupInteraction = (q: Question) => {
    setStatus('answering');
    setIsCorrect(null);
    setIsEvidenceLinked(false);
    setShowEvidencePrompt(false);
    setHintsUsed(0);

    if (q.interaction_type === 'rearrange' || q.interaction_type === 'aplus-coordinates') {
      const metadata = q.metadata || {};
      const rawChunks = (metadata as any).chunks || [];
      
      // Map to interaction format
      const initialSelections: Record<string, string> = {};
      const initialPrefixes: Record<string, string> = {};

      const words = rawChunks.map((c: any, idx: number) => {
        const chunkId = c.id || `${c.text}-${idx}`;
        const options = c.alternatives || [];
        
        if (options.length > 0) {
          // Include the correct answer in the options if it's not already there
          // The USER wants the FIRST option (base form) to be the initial selection
          const optionsWithCorrect = [ ...options, { text: c.text } ];
          let uniqueOptions = Array.from(new Map(optionsWithCorrect.map(o => [o.text, o])).values());
          
          let defaultOpt = options[0];
          
          if (c.mode === 'preposition') {
            uniqueOptions.sort((a, b) => a.text.localeCompare(b.text));
            defaultOpt = uniqueOptions[0];
          }

          // Default selection to the first alternative (usually the base form, or alphabetically first for prepositions)
          initialSelections[chunkId] = defaultOpt.text;
          initialPrefixes[chunkId] = ''; 

          return {
            id: chunkId,
            text: c.text,
            options: uniqueOptions
          };
        }

        return {
          id: chunkId,
          text: c.text,
          options: []
        };
      });

      setUserSelections(initialSelections);
      setUserPrefixes(initialPrefixes);

      // Shuffle for student view
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      setUnscrambleWords(shuffled);
    } else if (q.interaction_type === 'proofreading') {
      // Use new database columns if available, otherwise fallback to metadata
      if (q.error_sentence && q.error) {
        const sentence = q.error_sentence;
        const error = q.error;
        
        // Split by spaces but preserve them if needed
        // If error is a space at the end, we need to handle it
        let words = sentence.split(' ');
        
        // Find the error word index
        // Safety: If there are multiple identical words, we might need a better way.
        // For now, let's assume we can find the first match or use a marker if the user provided one.
        // The user said "To prevent confusion, answers with repeated words should be excluded"
        // so we probably won't have duplicates often.
        
        const chunks = words.map((w, idx) => ({
          id: idx,
          text: w,
          isError: w === error || (error === ' ' && idx === words.length - 1 && w === '')
        }));
        
        setProofreadingChunks(chunks);
      } else {
        // Fallback to legacy metadata chunks
        const metadata = q.metadata || {};
        const chunks = metadata.chunks || [];
        setProofreadingChunks(chunks.map((c: any, idx: number) => ({
          id: idx,
          text: typeof c === 'string' ? c : c.text,
          isError: true // In legacy mode, we don't know which one is the error easily
        })));
      }
      setSelectedProofreadingIndex(null);
      setProofreadingCorrection('');
    } else if (q.interaction_type === 'full-typing') {
      setTypingAnswer('');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setUnscrambleWords((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async () => {
    const q = questions[currentIndex];
    let isUserCorrect = false;

    if (q.interaction_type === 'rearrange' || q.interaction_type === 'aplus-coordinates') {
      const currentOrder = unscrambleWords.map(w => {
        const text = userSelections[w.id] || w.text;
        const prefix = userPrefixes[w.id];
        return prefix ? `${prefix} ${text}` : text;
      }).join(' ');
      
      // Clean up multiple spaces and check against correct answer
      const normalizedAnswer = currentOrder.replace(/\s+/g, ' ').trim().toLowerCase();
      const actualCorrect = q.correct_answer.replace(/\s+/g, ' ').trim().toLowerCase();
      isUserCorrect = normalizedAnswer === actualCorrect;
    } else if (q.interaction_type === 'proofreading') {
      const normalizedUser = proofreadingCorrection.trim().toLowerCase();
      const normalizedCorrect = q.correct_answer.trim().toLowerCase();
      
      // Check if also the correct word was selected
      const isWordCorrect = selectedProofreadingIndex !== null && proofreadingChunks[selectedProofreadingIndex]?.isError;
      
      isUserCorrect = isWordCorrect && normalizedUser === normalizedCorrect;
    } else if (q.interaction_type === 'full-typing') {
      const normalizedUser = typingAnswer.trim().toLowerCase();
      const normalizedCorrect = q.correct_answer.trim().toLowerCase();
      isUserCorrect = normalizedUser === normalizedCorrect;
    }

    setIsCorrect(isUserCorrect);
    setStatus('feedback');

    if (isUserCorrect) {
      const awardAmount = practice?.reward_coins || 10;
      setScore(prev => prev + awardAmount);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#ec4899']
      });
      setShowEvidencePrompt(!!q.evidence_coords);
    }

    // Save response to DB
    try {
      await supabase.from('reading_student_responses').insert({
        student_id: studentId,
        question_id: q.id,
        is_correct: isUserCorrect,
        user_answer: interactionMode === 'unscramble' 
          ? unscrambleWords.map(w => userSelections[w.id] || w.text).join(' ') 
          : proofreadingCorrection,
        hint_usage_count: hintsUsed,
        bonus_evidence_completed: false
      });
    } catch (err) {
      console.error('Error saving response:', err);
    }
  };

  const handleSkip = () => {
    if (confirm('Skip this question? You won\'t earn coins for this one.')) {
      nextQuestion();
    }
  };

  const handleEvidenceClick = () => {
    if (!isCorrect || !showEvidencePrompt) return;
    
    setIsEvidenceLinked(true);
    setBonusCoins(prev => prev + 5);
    setShowEvidencePrompt(false);
    
    // Update response in DB for bonus
    // (This would ideally be an RPC or a secondary update)
    confetti({
      particleCount: 50,
      spread: 360,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#f59e0b']
    });
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setupInteraction(questions[nextIdx]);
    } else {
      setStatus('finished');
      
      // Update assignment table if needed
      if (assignmentId) {
        try {
          const finalScore = score;
          await (supabase
            .from('reading_practice_assignments' as any) as any)
            .update({
              completed: true,
              completed_at: new Date().toISOString(),
              score: finalScore
            })
            .eq('id', assignmentId);
        } catch (err) {
          console.error('Error updating reading assignment:', err);
        }
      }
      onComplete(score, bonusCoins);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden">
      {/* 1. Header & Progress */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onExit}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              {practice?.title || 'Reading Practice'}
            </h1>
            {/* Mode Switcher */}
            {/* Hiding mode switcher as it should be dictated by the assignment/practice type
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner mt-2">
              <button
                onClick={() => {
                  console.log('ReadingChallenge: Switching to unscramble mode');
                  setInteractionMode('unscramble');
                  setCurrentIndex(0); // Reset to first question of new mode
                }}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  interactionMode === 'unscramble' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Unscramble
              </button>
              <button
                onClick={() => {
                  console.log('ReadingChallenge: Switching to proofreading mode');
                  setInteractionMode('proofreading');
                  setCurrentIndex(0);
                }}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  interactionMode === 'proofreading' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Proofreading
              </button>
            </div>
            */}

            <div className="flex items-center gap-2 mt-1">
              <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800">{score}</span>
              <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center shadow-inner">
                <Coins className="w-3.5 h-3.5 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="h-10 w-[1px] bg-slate-100" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Bonus</span>
            <span className="text-xl font-black text-indigo-600">+{bonusCoins}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto pb-10 custom-scrollbar">
        {/* Passage Area */}
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 relative group">
            {practice?.passage_image_url && (
              <img 
                src={practice.passage_image_url} 
                alt="Passage" 
                className="w-full h-auto select-none"
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
            
            {/* Highlight Overlay (Bonus Mode) */}
            {isEvidenceLinked && (
              <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Interaction Area */}
        <div className="max-w-4xl mx-auto px-6 space-y-8">
          {/* Question Text */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                  Level {questions[currentIndex]?.level || 1} • {questions[currentIndex]?.interaction_type}
                </span>
                <h2 className="text-xl font-medium text-slate-800 leading-relaxed">
                  {questions[currentIndex]?.question_text || 'What is the correct answer?'}
                </h2>
              </div>
            </div>
          </div>

          {/* Answering Component */}
          <div className="bg-white rounded-3xl p-10 border-2 border-slate-100 shadow-lg min-h-[300px] flex flex-col items-center justify-center">
            {interactionMode === 'advanced' || questions[currentIndex]?.interaction_type === 'full-typing' ? (
              <div className="w-full max-w-2xl space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] p-8 shadow-inner">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                      <Type className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest text-left">Type the entire sentence exactly:</span>
                  </div>
                  <textarea
                    autoFocus
                    value={typingAnswer}
                    onChange={(e) => setTypingAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full h-40 p-6 bg-white border-2 border-slate-200 rounded-[1.5rem] focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/10 transition-all outline-none font-bold text-xl resize-none shadow-sm"
                    disabled={status !== 'answering'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 mt-4 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Exact wordings required. Pay attention to punctuation!</p>
                  </div>
                </div>

                {status === 'feedback' && (
                  <div className="bg-white border-2 border-indigo-100 rounded-[2rem] p-6 shadow-xl animate-in slide-in-from-top-4 duration-500">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Target Sentence:</span>
                    <p className="text-xl font-bold text-slate-800 leading-relaxed italic">
                      "{questions[currentIndex]?.correct_answer}"
                    </p>
                  </div>
                )}
              </div>
            ) : interactionMode === 'unscramble' ? (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={unscrambleWords.map(w => w.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap justify-center gap-3">
                    {unscrambleWords.map((word) => (
                      <SortableWord 
                        key={word.id} 
                        id={word.id} 
                        text={word.text} 
                        selectedValue={userSelections[word.id]}
                        options={word.options}
                        prefixValue={userPrefixes[word.id]}
                        onOptionChange={(val, prefixVal) => {
                          setUserSelections(prev => ({ ...prev, [word.id]: val }));
                          if (prefixVal !== undefined) {
                            setUserPrefixes(prev => ({ ...prev, [word.id]: prefixVal }));
                          }
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="flex flex-col items-center gap-10 w-full max-w-2xl mx-auto">
                {/* Sentence Display */}
                <div className="flex flex-wrap justify-center gap-x-2 gap-y-4 text-2xl font-medium leading-loose text-slate-800">
                  {proofreadingChunks.map((chunk, idx) => {
                    const isSelected = selectedProofreadingIndex === idx;
                    const isError = status === 'feedback' && chunk.isError;
                    const isIncorrectSelection = status === 'feedback' && isSelected && !chunk.isError;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => status === 'answering' && setSelectedProofreadingIndex(idx)}
                        disabled={status === 'feedback'}
                        className={`
                          relative px-2 py-1 rounded-lg transition-all duration-200
                          ${status === 'answering' ? 'hover:bg-slate-100' : ''}
                          ${isSelected && status === 'answering' ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500 shadow-sm' : ''}
                          ${isError ? 'text-red-500 line-through decoration-2' : ''}
                          ${isIncorrectSelection ? 'bg-red-50 text-red-700 ring-2 ring-red-500' : ''}
                          ${status === 'feedback' && !isError && !isIncorrectSelection ? 'opacity-50' : ''}
                        `}
                      >
                        {chunk.text || (chunk.isError ? '⎵' : '')}
                        {isSelected && status === 'answering' && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Input Area */}
                {selectedProofreadingIndex !== null && status === 'answering' && (
                  <div className="w-full flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Type the correction</p>
                    <div className="relative w-full max-w-md">
                      <input
                        autoFocus
                        type="text"
                        value={proofreadingCorrection}
                        onChange={(e) => setProofreadingCorrection(e.target.value)}
                        placeholder="What should it be?"
                        className="w-full px-6 py-4 bg-white border-2 border-indigo-100 rounded-2xl text-xl font-bold text-center text-indigo-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-xl transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      />
                    </div>
                  </div>
                )}

                {/* Feedback Correction */}
                {status === 'feedback' && (
                  <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                    <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl text-center">
                      <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest block mb-2">The Correction is:</span>
                      <span className="text-3xl font-black text-indigo-600 italic">
                        {questions[currentIndex]?.correct_answer}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hint Message (Animated) */}
            {status === 'feedback' && (
              <div className={`mt-10 flex items-center gap-3 px-6 py-4 rounded-2xl animate-in slide-in-from-top-4 duration-500 ${
                isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <p className="font-bold">Fantastic! That's correct.</p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6" />
                    <p className="font-bold">Not quite. Try checking the tense or order!</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Bottom Action Bar */}
      <div className="bg-white border-t border-slate-200 p-6 sticky bottom-0 w-full z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              className="px-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-all"
              onClick={() => {
                setHintsUsed(prev => prev + 1);
                // Implementation for hint display
              }}
            >
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Hint
            </button>
            <button 
              onClick={handleSkip}
              className="px-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-all"
            >
              <SkipForward className="w-5 h-5" />
              Skip
            </button>
          </div>

          <div className="flex-1 flex justify-center">
             {showEvidencePrompt && (
               <button 
                 onClick={handleEvidenceClick}
                 className="flex items-center gap-3 px-8 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-100 animate-in zoom-in duration-300 hover:scale-105 active:scale-95"
               >
                 <Target className="w-5 h-5" />
                 Link Evidence (+5 Coins)
               </button>
             )}
          </div>

          <button 
            onClick={status === 'feedback' ? nextQuestion : handleSubmit}
            className={`px-10 py-4 ${
              status === 'feedback' 
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200'
            } rounded-2xl font-black text-lg flex items-center gap-3 transition-all active:scale-95`}
          >
            {status === 'feedback' ? (
              <>
                Next Challenge
                <ArrowRight className="w-6 h-6" />
              </>
            ) : (
              <>
                Check Answer
                <ChevronRight className="w-6 h-6" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReadingChallenge;
