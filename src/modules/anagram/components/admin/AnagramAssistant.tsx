import { useState } from "react";
import { 
  Search, AlertCircle, CheckCircle2, 
  Loader2, Sparkles, X, ChevronRight, RefreshCw
} from "lucide-react";
import { findAnagrams, isAnagramOf, isPotentialSimpleInflection } from "../../../../utils/anagramFinder";
import { checkWord, DictionaryResult } from "../../../../utils/dictionaryApi";

interface AnagramAssistantProps {
  letters: string;
  knownAnswers: string[];
}

export function AnagramAssistant({ letters, knownAnswers }: AnagramAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [manualWord, setManualWord] = useState("");
  const [verificationResult, setVerificationResult] = useState<DictionaryResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const results = await findAnagrams(letters, knownAnswers);
      setCandidates(results);
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleVerify = async (word: string) => {
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const result = await checkWord(word);
      setVerificationResult(result);
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTryManual = async () => {
    if (!manualWord.trim()) return;
    
    if (!isAnagramOf(manualWord, letters)) {
      setVerificationResult({ isValid: false });
      return;
    }
    
    await handleVerify(manualWord);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all uppercase tracking-widest"
      >
        <Sparkles size={12} />
        Anagram Assistant
      </button>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-600" />
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Anagram Assistant</h4>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      {/* Manual Tester */}
      <div className="space-y-2">
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Test a potential word</label>
        <div className="flex gap-2">
          <input 
            type="text"
            value={manualWord}
            onChange={(e) => setManualWord(e.target.value.toUpperCase())}
            placeholder="TYPE WORD..."
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            onKeyDown={(e) => e.key === 'Enter' && handleTryManual()}
          />
          <button 
            onClick={handleTryManual}
            disabled={isVerifying || !manualWord}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-1.5 rounded-lg transition-all"
          >
            {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </div>

        {verificationResult && (
          <div className={`mt-2 p-3 rounded-xl border ${verificationResult.isValid ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
            <div className="flex items-start gap-2">
              {verificationResult.isValid ? (
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle size={14} className="text-red-500 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-widest ${verificationResult.isValid ? 'text-emerald-700' : 'text-red-700'}`}>
                  {verificationResult.isValid ? 'Valid Answer Found!' : 'Invalid Combination'}
                </p>
                {verificationResult.isValid && verificationResult.definition && (
                  <div className="mt-1">
                    <p className="text-[10px] text-emerald-800 font-bold italic line-clamp-2">
                      ({verificationResult.partsOfSpeech?.join(", ")}) {verificationResult.definition}
                    </p>
                    {/* Inflection Rule Warning */}
                    {isPotentialSimpleInflection(manualWord) && (
                      <p className="mt-1 text-[8px] font-black uppercase text-blue-600 bg-blue-100/50 px-1.5 py-0.5 rounded w-fit">
                        {manualWord.endsWith('ing') && !verificationResult.partsOfSpeech?.includes('noun') && "⚠️ Verb Case: Typically excluded (-ing not noun)"}
                        {manualWord.endsWith('ed') && !verificationResult.partsOfSpeech?.includes('adjective') && "⚠️ Verb Case: Typically excluded (-ed not adjective)"}
                        {manualWord.endsWith('s') && "⚠️ Plural Case: Check if base exists"}
                      </p>
                    )}
                  </div>
                )}
                {!verificationResult.isValid && !isAnagramOf(manualWord, letters) && (
                  <p className="text-[10px] text-red-600 font-bold mt-0.5">Letters do not match.</p>
                )}
                {!verificationResult.isValid && isAnagramOf(manualWord, letters) && (
                  <p className="text-[10px] text-red-600 font-bold mt-0.5">Not found in English dictionary.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-slate-200 mx-1" />

      {/* Discovery Tool */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Discovery Tool</label>
          <button 
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-tighter"
          >
            {isScanning ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            {isScanning ? 'Scanning...' : 'Find Missing'}
          </button>
        </div>

        {candidates.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((word) => (
              <button
                key={word}
                onClick={() => {
                  setManualWord(word);
                  handleVerify(word);
                }}
                className={`flex items-center justify-between border px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all group ${
                  isPotentialSimpleInflection(word) 
                    ? 'bg-amber-50 border-amber-200 text-amber-800 hover:border-amber-300' 
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold uppercase">
                  <span>{word.toUpperCase()}</span>
                  {isPotentialSimpleInflection(word) && (
                    <AlertCircle size={10} className="text-amber-500" />
                  )}
                </div>
                <ChevronRight size={10} className={`${isPotentialSimpleInflection(word) ? 'text-amber-300' : 'text-slate-300'} group-hover:text-blue-400 transition-colors`} />
              </button>
            ))}
          </div>
        ) : !isScanning && (
          <p className="text-[9px] text-slate-400 text-center py-2 font-medium italic">
            No unknown common words found.
          </p>
        )}
      </div>
    </div>
  );
}

// Internal RefreshCw was removed as it's now imported from lucide-react

