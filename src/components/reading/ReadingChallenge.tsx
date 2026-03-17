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
  Loader2
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
  interaction_type: 'rearrange' | 'proofreading' | 'aplus-coordinates';
  level: number;
  metadata: any;
  evidence_coords: any;
}

interface ReadingChallengeProps {
  practiceId: string;
  studentId: string;
  assignmentId?: string;
  interactionMode?: 'rearrange' | 'proofreading';
  onComplete: (score: number, bonus: number) => void;
  onExit: () => void;
}

// --- Sub-Components ---

// 1. Sortable Word Item for Rearrange Mode
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
export const ReadingChallenge: React.FC<ReadingChallengeProps> = ({
  practiceId,
  studentId,
  assignmentId,
  interactionMode: propInteractionMode,
  onComplete,
  onExit
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [practice, setPractice] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bonusCoins, setBonusCoins] = useState(0);
  
  // Interaction State
  const [rearrangeWords, setRearrangeWords] = useState<{id: string, text: string, options?: {text: string, prefix?: string}[]}[]>([]);
  const [proofreadingChunks, setProofreadingChunks] = useState<any[]>([]);
  const [selectedProofreadingIndex, setSelectedProofreadingIndex] = useState<number | null>(null);
  const [userSelections, setUserSelections] = useState<Record<string, string>>({}); // For options/dropdowns
  const [userPrefixes, setUserPrefixes] = useState<Record<string, string>>({}); // For auxiliary verb inputs
  
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
    loadData();
  }, [practiceId]);

  const loadData = async () => {
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
      if (propInteractionMode) {
        // 'rearrange' from UI maps to 'rearrange' or 'aplus-coordinates' in DB
        if (propInteractionMode === 'rearrange') {
          query = query.in('interaction_type', ['rearrange', 'aplus-coordinates']);
        } else {
          query = query.eq('interaction_type', 'proofreading');
        }
      }

      const { data: qData, error: qError } = await query.order('order_index', { ascending: true });
      
      if (qError) throw qError;

      // 3. Filter by Student Level
      // Level rule: "Students in level 1 can choose the advanced level but students in advanced level cannot choose the easier levels"
      // This means if student is Level 2, they ONLY see Level 2. If student is Level 1, they see 1 and 2.
      const { data: userData } = await supabase.from('users').select('*').eq('id', studentId).single();
      const u = userData as any;
      const studentLevel = propInteractionMode === 'rearrange' 
        ? (u.reading_level || 1) 
        : (u.reading_proof_level || 1);

      const filteredQuestions = (qData as unknown as Question[] || []).filter(q => {
        if (studentLevel === 1) return true; // Level 1 sees everything (1 and 2, or 1,2,3)
        return q.level >= studentLevel; // Level 2 only sees 2+
      });

      setQuestions(filteredQuestions);
      
      if (filteredQuestions.length > 0) {
        setupInteraction(filteredQuestions[0]);
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
          const uniqueOptions = Array.from(new Map(optionsWithCorrect.map(o => [o.text, o])).values());
          
          // Default selection to the first alternative (usually the base form)
          const defaultOpt = options[0];
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
      setRearrangeWords(shuffled);
    } else if (q.interaction_type === 'proofreading') {
      // Setup proofreading chunks
      const metadata = q.metadata || {};
      const chunks = metadata.chunks || [];
      setProofreadingChunks(chunks.map((c: any, idx: number) => ({
        id: idx,
        text: typeof c === 'string' ? c : c.text,
        options: c.options || []
      })));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRearrangeWords((items) => {
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
      const currentOrder = rearrangeWords.map(w => {
        const text = userSelections[w.id] || w.text;
        const prefix = userPrefixes[w.id];
        return prefix ? `${prefix} ${text}` : text;
      }).join(' ');
      
      // Clean up multiple spaces and check against correct answer
      const normalizedAnswer = currentOrder.replace(/\s+/g, ' ').trim().toLowerCase();
      const actualCorrect = q.correct_answer.replace(/\s+/g, ' ').trim().toLowerCase();
      isUserCorrect = normalizedAnswer === actualCorrect;
    } else if (q.interaction_type === 'proofreading') {
      const userCorrection = userSelections['proofread-correction'];
      isUserCorrect = userCorrection === q.correct_answer;
    }

    setIsCorrect(isUserCorrect);
    setStatus('feedback');

    if (isUserCorrect) {
      setScore(prev => prev + 10);
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
        user_answer: q.interaction_type === 'rearrange' 
          ? rearrangeWords.map(w => userSelections[w.id] || w.text).join(' ') 
          : userSelections['proofread-correction'] || 'no-selection',
        hint_usage_count: hintsUsed,
        bonus_evidence_completed: false
      });
    } catch (err) {
      console.error('Error saving response:', err);
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
            {questions[currentIndex]?.interaction_type === 'rearrange' || questions[currentIndex]?.interaction_type === 'aplus-coordinates' ? (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={rearrangeWords.map(w => w.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap justify-center gap-3">
                    {rearrangeWords.map((word) => (
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
              <div className="flex flex-col items-center gap-8 w-full">
                <div className="flex flex-wrap justify-center gap-2">
                  {proofreadingChunks.map((chunk, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedProofreadingIndex(idx)}
                      className={`px-4 py-2 rounded-xl border-2 transition-all font-medium ${
                        selectedProofreadingIndex === idx 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' 
                          : 'border-slate-100 text-slate-600 hover:border-slate-200'
                      }`}
                    >
                      {userSelections[`proofread-${idx}`] || chunk.text}
                    </button>
                  ))}
                </div>

                {selectedProofreadingIndex !== null && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 w-full max-w-md animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-4 text-center">Correct this part</p>
                    <div className="grid grid-cols-1 gap-2">
                      {proofreadingChunks[selectedProofreadingIndex].options.map((opt: string) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setUserSelections(prev => ({ ...prev, [`proofread-${selectedProofreadingIndex}`]: opt }));
                            // For Level 1/2 simplicity, we might just store the main correction
                            setUserSelections(prev => ({ ...prev, 'proofread-correction': opt }));
                          }}
                          className={`w-full py-3 px-4 rounded-xl text-left font-bold transition-all ${
                            userSelections[`proofread-${selectedProofreadingIndex}`] === opt
                              ? 'bg-indigo-600 text-white shadow-lg'
                              : 'bg-white text-slate-700 hover:bg-indigo-50 border border-slate-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
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
            <button className="px-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-all">
              <SkipForward className="w-5 h-5" />
              Not Sure
            </button>
          </div>

          <div className="flex-1 flex justify-center">
             {showEvidencePrompt && (
               <button 
                 onClick={handleEvidenceClick}
                 className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 animate-bounce"
               >
                 <Target className="w-5 h-5" />
                 Link Evidence for +5 Bonus
               </button>
             )}
          </div>

          <button 
            onClick={status === 'feedback' ? nextQuestion : handleSubmit}
            className={`px-10 py-4 ${
              status === 'feedback' 
                ? 'bg-slate-800 text-white' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200'
            } rounded-2xl font-black text-lg flex items-center gap-3 transition-all active:scale-95`}
          >
            {status === 'feedback' ? (
              <>
                Next Question
                <ArrowRight className="w-6 h-6" />
              </>
            ) : (
              <>
                Check My Answer
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
