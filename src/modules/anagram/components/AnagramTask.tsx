import { useState, useRef, useEffect, useCallback } from "react";
import type { AnagramSet } from "../data/anagrams";
import type { QuestionResponse } from "../types/experiment";
import { scrambleLetters } from "../data/anagrams";

const MAX_ATTEMPTS = 5;

type HintStage = 'none' | 'first_letter' | 'last_letter';

interface Props {
  sets: AnagramSet[];
  taskName: string;
  onComplete: (responses: QuestionResponse[]) => void;
  enableHints?: boolean; // true for Task 1 & 2, false/omitted for Trial
}

export default function AnagramTask({ sets, taskName, onComplete, enableHints = false }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: "correct" | "wrong" | "skip" | "maxed";
    message: string;
  } | null>(null);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<QuestionResponse | null>(null);

  // Hint state (only used when enableHints is true)
  const [hintStage, setHintStage] = useState<HintStage>('none');
  const [hintFirstLetterTime, setHintFirstLetterTime] = useState<number | undefined>(undefined);
  const [hintLastLetterTime, setHintLastLetterTime] = useState<number | undefined>(undefined);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSet = sets[currentIndex];
  const [scrambled, setScrambled] = useState(() =>
    scrambleLetters(currentSet.letters, currentSet.validAnswers)
  );

  // Derive the revealed letters from the first valid answer
  const firstAnswer = currentSet.validAnswers[0]?.toUpperCase() || "";
  const revealedFirst = firstAnswer[0] || "";
  const revealedLast = firstAnswer[firstAnswer.length - 1] || "";

  // Start timer for each question
  useEffect(() => {
    setTimer(0);
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex]);

  // Re-scramble when question changes
  useEffect(() => {
    setScrambled(
      scrambleLetters(sets[currentIndex].letters, sets[currentIndex].validAnswers)
    );
  }, [currentIndex, sets]);

  // Reset hint state when question changes
  useEffect(() => {
    setHintStage('none');
    setHintFirstLetterTime(undefined);
    setHintLastLetterTime(undefined);
  }, [currentIndex]);

  // Auto-focus input on question change (only when NOT waiting for next)
  useEffect(() => {
    if (!waitingForNext && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [currentIndex, waitingForNext]);

  // Focus the Next button when it appears
  useEffect(() => {
    if (waitingForNext && nextBtnRef.current) {
      setTimeout(() => nextBtnRef.current?.focus(), 50);
    }
  }, [waitingForNext]);

  const stopTimer = () => {
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Build hint data for the current question's response
  const buildHintData = (gaveUp: boolean) => {
    if (!enableHints) return {};
    return {
      hintStage: gaveUp ? 'gave_up' as const : hintStage === 'none' ? 'none' as const : hintStage === 'first_letter' ? 'first_letter' as const : 'last_letter' as const,
      revealedFirstLetter: hintStage !== 'none' ? revealedFirst : undefined,
      revealedLastLetter: hintStage === 'last_letter' || gaveUp ? revealedLast : undefined,
      hintFirstLetterTime: hintFirstLetterTime,
      hintLastLetterTime: hintLastLetterTime,
      hintGaveUpTime: gaveUp ? timer : undefined,
    };
  };

  // Handle clicking "Next →"
  const handleNext = useCallback(() => {
    if (!pendingResponse) return;

    const newResponses = [...responses, pendingResponse];
    setResponses(newResponses);

    if (currentIndex < sets.length - 1) {
      setCurrentIndex((i) => i + 1);
      setInput("");
      setAttempts(0);
      setFeedback(null);
      setWaitingForNext(false);
      setPendingResponse(null);
    } else {
      onComplete(newResponses);
    }
  }, [pendingResponse, responses, currentIndex, sets.length, onComplete]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!input.trim() || waitingForNext) return;

    const answer = input.trim().toUpperCase();
    const isCorrect = currentSet.validAnswers.some(
      (a) => a.toUpperCase() === answer
    );

    if (isCorrect) {
      stopTimer();
      setFeedback({ type: "correct", message: "✅ Correct!" });
      setWaitingForNext(true);
      setPendingResponse({
        questionId: currentSet.id,
        questionPageUrl: currentSet.notionUrl,
        questionIndex: currentIndex,
        letters: currentSet.letters,
        userAnswer: answer,
        isCorrect: true,
        timeTaken: timer,
        attempts: attempts + 1,
        skipped: false,
        ...buildHintData(false),
      });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        stopTimer();
        setFeedback({
          type: "maxed",
          message: "⏭️ Max attempts reached. Moving on...",
        });
        setWaitingForNext(true);
        setPendingResponse({
          questionId: currentSet.id,
          questionPageUrl: currentSet.notionUrl,
          questionIndex: currentIndex,
          letters: currentSet.letters,
          userAnswer: answer,
          isCorrect: false,
          timeTaken: timer,
          attempts: newAttempts,
          skipped: true,
          ...buildHintData(false),
        });
      } else {
        setFeedback({
          type: "wrong",
          message: `❌ Not quite! (${MAX_ATTEMPTS - newAttempts} attempts left)`,
        });
        setTimeout(() => {
          setFeedback(null);
          setInput("");
          if (inputRef.current) inputRef.current.focus();
        }, 1200);
      }
    }
  }, [input, waitingForNext, currentSet, currentIndex, timer, attempts, hintStage, hintFirstLetterTime, hintLastLetterTime, enableHints]);

  // Handle skip (used for Trial "I don't know the answer")
  const handleSkip = useCallback(() => {
    if (waitingForNext) return;
    stopTimer();

    setFeedback({
      type: "skip",
      message: "⏭️ Skipped. Moving on...",
    });
    setWaitingForNext(true);
    setPendingResponse({
      questionId: currentSet.id,
      questionPageUrl: currentSet.notionUrl,
      questionIndex: currentIndex,
      letters: currentSet.letters,
      userAnswer: "",
      isCorrect: false,
      timeTaken: timer,
      attempts: 0,
      skipped: true,
    });
  }, [waitingForNext, currentSet, currentIndex, timer]);

  // Handle hint button click (3-stage progressive)
  const handleHintClick = useCallback(() => {
    if (waitingForNext || !!feedback) return;

    if (hintStage === 'none') {
      // Stage 0 → reveal first letter
      setHintStage('first_letter');
      setHintFirstLetterTime(timer);
    } else if (hintStage === 'first_letter') {
      // Stage 1 → reveal last letter
      setHintStage('last_letter');
      setHintLastLetterTime(timer);
    } else {
      // Stage 2 → "I really have no idea" → skip
      stopTimer();
      setFeedback({
        type: "skip",
        message: "⏭️ No worries! Moving on...",
      });
      setWaitingForNext(true);
      setPendingResponse({
        questionId: currentSet.id,
        questionPageUrl: currentSet.notionUrl,
        questionIndex: currentIndex,
        letters: currentSet.letters,
        userAnswer: "",
        isCorrect: false,
        timeTaken: timer,
        attempts,
        skipped: true,
        ...buildHintData(true),
      });
    }
  }, [waitingForNext, feedback, hintStage, timer, currentSet, currentIndex, attempts, hintFirstLetterTime, hintLastLetterTime, enableHints]);

  // Hint button label and styling
  const getHintButtonConfig = () => {
    if (hintStage === 'none') {
      return {
        label: "🔍 Reveal 1st letter",
        className: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
      };
    } else if (hintStage === 'first_letter') {
      return {
        label: "🔍 Reveal final letter",
        className: "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200",
      };
    } else {
      return {
        label: "I really have no idea",
        className: "bg-emerald-200 text-emerald-800 border-emerald-400 hover:bg-emerald-300",
      };
    }
  };

  const isLastQuestion = currentIndex === sets.length - 1;
  const hintConfig = getHintButtonConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-500">{taskName}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {currentIndex + 1}/{sets.length}
            </span>
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${((currentIndex + 1) / sets.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="text-center">
          <span
            className={`text-3xl font-mono font-bold ${
              timerRunning ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            {timer}s
          </span>
        </div>

        {/* Scrambled Letters */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-500">
            Rearrange these letters to form a word:
          </p>
          <div className="flex justify-center gap-2">
            {scrambled.split("").map((letter, i) => (
              <div
                key={`${currentIndex}-${i}`}
                className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-2xl font-bold transition-all ${
                  waitingForNext
                    ? feedback?.type === "correct"
                      ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                      : "bg-amber-100 border-amber-300 text-amber-700"
                    : "bg-emerald-50 border-emerald-300 text-emerald-700"
                }`}
              >
                {letter}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            {currentSet.letters.length} letters
          </p>
        </div>

        {/* Revealed letter hints — only shown when hints are active */}
        {enableHints && hintStage !== 'none' && !waitingForNext && (
          <div className="flex justify-center gap-3">
            {(hintStage === 'first_letter' || hintStage === 'last_letter') && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
                <span className="text-xs text-emerald-500">1st:</span>
                <span className="text-lg">{revealedFirst}</span>
              </span>
            )}
            {hintStage === 'last_letter' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
                <span className="text-xs text-emerald-500">Last:</span>
                <span className="text-lg">{revealedLast}</span>
              </span>
            )}
          </div>
        )}

        {/* Input — hidden when waiting for Next */}
        {!waitingForNext && (
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              disabled={!!feedback}
              placeholder="Type your answer..."
              className={`w-full px-4 py-3 border-2 rounded-xl text-lg font-medium text-center uppercase tracking-wider focus:outline-none transition-all ${
                feedback?.type === "wrong"
                  ? "border-red-400 bg-red-50 animate-shake"
                  : "border-gray-300 focus:border-emerald-400"
              }`}
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || !!feedback}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  !input.trim() || feedback
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg"
                }`}
              >
                Submit
              </button>

              {/* Conditional button: hints (Task 1 & 2) vs simple skip (Trial) */}
              {enableHints ? (
                <button
                  onClick={handleHintClick}
                  disabled={!!feedback}
                  className={`px-5 py-3 rounded-xl font-medium border transition-all disabled:opacity-50 ${hintConfig.className}`}
                >
                  {hintConfig.label}
                </button>
              ) : (
                <button
                  onClick={handleSkip}
                  disabled={!!feedback}
                  className="px-5 py-3 rounded-xl font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50"
                >
                  I don't know the answer
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className={`text-center p-4 rounded-xl font-medium ${
              feedback.type === "correct"
                ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-200"
                : feedback.type === "wrong"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700 border-2 border-amber-200"
            }`}
          >
            <p className="text-lg">{feedback.message}</p>
          </div>
        )}

        {/* Next Button — appears after correct/skip/maxed */}
        {waitingForNext && (
          <button
            ref={nextBtnRef}
            onClick={handleNext}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNext();
            }}
            className="w-full py-4 rounded-xl font-bold text-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition-all active:scale-95"
          >
            {isLastQuestion ? "Finish Task ✓" : "Next Question →"}
          </button>
        )}

        {/* Attempts indicator — only show when actively answering */}
        {!waitingForNext && !feedback && (
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  i < attempts
                    ? "bg-red-400"
                    : i === attempts
                    ? "bg-emerald-400 ring-2 ring-emerald-200"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}

        {/* How to play */}
        {!waitingForNext && (
          <p className="text-xs text-gray-400 text-center">
            Type a word using ALL the letters shown. You have {MAX_ATTEMPTS}{" "}
            attempts per question. Press Enter or click Submit.
          </p>
        )}
      </div>
    </div>
  );
}
