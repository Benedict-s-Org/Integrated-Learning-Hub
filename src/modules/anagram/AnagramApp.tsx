import { useState, useCallback, useEffect } from "react";
import type {
  ExperimentData,
  TaskResult,
  QuestionResponse,
  Demographics as DemographicsData,
  PostSurveyData,
} from "./types/experiment";
import { easySets, hardSets } from "./data/anagrams";
import Welcome from "./components/Welcome";
import Demographics from "./components/Demographics";
import PredictionScreen from "./components/PredictionScreen";
import AnagramTask from "./components/AnagramTask";
import TrialDifficultyEvaluation from "./components/TrialDifficultyEvaluation";
import TaskComplete from "./components/TaskComplete";
import PostSurvey from "./components/PostSurvey";
import Debrief from "./components/Debrief";
import { useAuth } from "../../context/AuthContext";
import { useCMS } from "../../hooks/useCMS";
import AnagramAdminLayout from "./components/admin/AnagramAdminLayout";
import WelcomeEditor from "./components/admin/WelcomeEditor";
import DemographicsEditor from "./components/admin/DemographicsEditor";
import TrialEditor from "./components/admin/TrialEditor";
import PredictionEditor from "./components/admin/PredictionEditor";
import FeedbackEditor from "./components/admin/FeedbackEditor";
import SurveyEditor from "./components/admin/SurveyEditor";
import QuestionBankEditor from "./components/admin/QuestionBankEditor";
import DifficultyEvaluationEditor from "./components/admin/DifficultyEvaluationEditor";
import AnagramManifest from "./components/admin/AnagramManifest";
import AdminQuickNav from "./components/admin/AdminQuickNav";
import { Settings, Play } from "lucide-react";

type Phase =
  | "welcome"
  | "demographics"
  | "trial_intro"
  | "trial"
  | "trial_difficulty"
  | "predict1"
  | "task1"
  | "complete1"
  | "predict2"
  | "task2"
  | "complete2"
  | "postsurvey"
  | "debrief"
  | "cms";

// Generate a unique participant ID
function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `P-${ts}-${rand}`.toUpperCase();
}

export default function App() {
  useEffect(() => {
    document.title = "Cognitive Anagram Task";
  }, []);

  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === 'admin@anagram.com' || user?.username?.toLowerCase() === 'admin@anagram.com';

  const [phase, setPhase] = useState<Phase>(() => {
    return isAdmin ? "cms" : "welcome";
  });
  const { getContent } = useCMS();
  const [activeAdminTab, setActiveAdminTab] = useState('manifest');
  const [cmsQuestions, setCmsQuestions] = useState<{
    calibration: any[],
    warmup: any[],
    easy: any[], 
    hard: any[]
  } | null>(null);
  const [cmsContent, setCmsContent] = useState<Record<string, any>>({});
  const [isCmsLoaded, setIsCmsLoaded] = useState(false);

  const [participantId] = useState(() => generateId());
  const [groupId] = useState<"self" | "other">("self");

  useEffect(() => {
    const loadNotionQuestions = async () => {
      const { fetchQuestions } = await import("./services/notionLogger");
      
      try {
        const [calibrationData, warmupData, easyData, hardData] = await Promise.all([
           fetchQuestions("Calibration", 4, true),
           fetchQuestions("Warm-up", 50, true),
           fetchQuestions("Easy", 100, true),
           fetchQuestions("Hard", 100, true)
        ]);

        const mapToAnagramSet = (q: any) => ({
           id: q.questionId,
           notionUrl: q.questionPageUrl,
           letters: q.letters,
           validAnswers: q.validAnswers,
           tier: q.tier, // Keep tier for reference
           length: q.length || q.letters.length
        });

        if (easyData.length > 0 || hardData.length > 0 || warmupData.length > 0 || calibrationData.length > 0) {
           setCmsQuestions({
             calibration: calibrationData.map(mapToAnagramSet),
             warmup: warmupData.map(mapToAnagramSet),
             easy: easyData.map(mapToAnagramSet),
             hard: hardData.map(mapToAnagramSet)
           });
        }
      } catch (err) {
        console.error("Failed to load Notion questions:", err);
      }
    };
    loadNotionQuestions();

    const loadAllCMS = async () => {
      const keys = [
        "anagram_welcome",
        "anagram_demographics",
        "anagram_trial",
        "anagram_trial_difficulty",
        "anagram_trial_difficulty",
        "anagram_task1_prediction",
        "anagram_task1_feedback",
        "anagram_task2_prediction",
        "anagram_task2_feedback",
        "anagram_survey",
        "anagram_debrief"
      ];
      
      const results: Record<string, any> = {};
      
      // Fetch each key individually and silently to prevent crashes on missing data
      for (const key of keys) {
        try {
          const data = await getContent(key);
          if (data && data.content) {
            results[key] = data.content;
          }
        } catch (err) {
          console.warn(`Silently failed to load CMS key ${key}:`, err);
        }
      }
      
      // Update state once all keys are resolved
      setCmsContent(results);
      setIsCmsLoaded(true);
    };
    loadAllCMS();
  }, [getContent]);

  const refreshCMS = useCallback(async () => {
    setIsCmsLoaded(false);
    const keys = [
      "anagram_welcome",
      "anagram_demographics",
      "anagram_trial",
      "anagram_trial_difficulty",
      "anagram_task1_prediction",
      "anagram_task2_prediction",
      "anagram_task1_feedback",
      "anagram_task2_feedback",
      "anagram_survey",
      "anagram_debrief"
    ];
    
    const results: Record<string, any> = {};
    for (const key of keys) {
      try {
        const data = await getContent(key);
        if (data && data.content) {
          results[key] = data.content;
        }
      } catch (err) {
        console.warn(`Silently failed to load CMS key ${key}:`, err);
      }
    }
    setCmsContent(results);
    setIsCmsLoaded(true);
  }, [getContent]);

  // Helper to get N random items from an array
  const getRandomItems = (arr: any[], n: number) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
  };

  const activeTrialSets = (() => {
    if (!cmsQuestions) return [];
    // All fetched calibration questions (up to 4)
    return cmsQuestions.calibration;
  })();

  const activeEasySets = (() => {
    if (!cmsQuestions) return easySets.slice(0, 10);
    
    // 3 Warm-up + 7 Easy
    const pickedWarmup = getRandomItems(cmsQuestions.warmup, 3);
    const pickedEasy = getRandomItems(cmsQuestions.easy, 7);
    
    // Concatenate so warmup comes first
    return [...pickedWarmup, ...pickedEasy];
  })();

  const activeHardSets = (() => {
    if (!cmsQuestions) return hardSets.slice(0, 10);
    
    const pool6 = cmsQuestions.hard.filter(q => q.length === 6);
    const pool7 = cmsQuestions.hard.filter(q => q.length === 7);
    
    const picked6 = getRandomItems(pool6, 8);
    const picked7 = getRandomItems(pool7, 2);
    
    const finalSet = [];
    let p6 = 0;
    let p7 = 0;
    
    for (let i = 0; i < 10; i++) {
        if (i === 3 || i === 6) {
          const next7 = picked7[p7++];
          if (next7) finalSet.push(next7);
          else {
            const next6 = picked6[p6++];
            if (next6) finalSet.push(next6);
          }
        } else {
          const next6 = picked6[p6++];
          if (next6) finalSet.push(next6);
          else {
            const next7 = picked7[p7++];
            if (next7) finalSet.push(next7);
          }
        }
    }
    return finalSet.length === 10 ? finalSet : getRandomItems(cmsQuestions.hard, 10);
  })();

  const [demographics, setDemographics] = useState<DemographicsData | null>(
    null
  );
  const [trialResult, setTrialResult] = useState<TaskResult | null>(null);
  const [trialDifficulty, setTrialDifficulty] = useState<'easy' | 'moderate' | 'difficult' | null>(null);
  const [task1Result, setTask1Result] = useState<TaskResult | null>(null);
  const [task2Result, setTask2Result] = useState<TaskResult | null>(null);
  const [postSurvey, setPostSurvey] = useState<PostSurveyData | null>(null);
  const [pred1, setPred1] = useState(0);
  const [pred2, setPred2] = useState(0);

  // Time tracking for non-zero durations
  const [trialStart, setTrialStart] = useState<number>(0);
  const [task1Start, setTask1Start] = useState<number>(0);
  const [task2Start, setTask2Start] = useState<number>(0);

  const handleDemographics = useCallback((data: DemographicsData) => {
    setDemographics(data);
    setPhase("trial_intro");
  }, []);

  const handleTrialComplete = useCallback(
    (responses: QuestionResponse[]) => {
      const result: TaskResult = {
        taskId: "trial",
        taskName: "Trial Part",
        predictionSeconds: 0,
        responses,
        startTime: trialStart || Date.now(),
        endTime: Date.now(),
      };
      setTrialResult(result);
      setPhase("trial_difficulty");
    },
    []
  );

  const handleTrialDifficulty = useCallback((difficulty: 'easy' | 'moderate' | 'difficult') => {
    setTrialDifficulty(difficulty);
    setPhase("predict1");
  }, []);

  const handlePred1 = useCallback((seconds: number) => {
    setPred1(seconds);
    setTask1Start(Date.now());
    setPhase("task1");
  }, []);

  const handleTask1Complete = useCallback(
    (responses: QuestionResponse[]) => {
      const result: TaskResult = {
        taskId: "task1",
        taskName: "Task 1 (Easy)",
        predictionSeconds: pred1,
        responses,
        startTime: task1Start || Date.now(),
        endTime: Date.now(),
      };
      setTask1Result(result);
      setPhase("complete1");
    },
    [pred1, task1Start]
  );

  const handlePred2 = useCallback((seconds: number) => {
    setPred2(seconds);
    setTask2Start(Date.now());
    setPhase("task2");
  }, []);

  const handleTask2Complete = useCallback(
    (responses: QuestionResponse[]) => {
      const result: TaskResult = {
        taskId: "task2",
        taskName: "Task 2 (Hard)",
        predictionSeconds: pred2,
        responses,
        startTime: task2Start || Date.now(),
        endTime: Date.now(),
      };
      setTask2Result(result);
      setPhase("complete2");
    },
    [pred2]
  );

  const handlePostSurvey = useCallback((data: PostSurveyData) => {
    setPostSurvey(data);
    setPhase("debrief");

    const logToSheets = async () => {
      try {
        const { postRunToGoogleSheet } = await import("./services/googleSheetsLogger");
        const getDeviceBrowser = () => {
           if (typeof navigator !== 'undefined') return navigator.userAgent;
           return "Unknown";
        };

        const totalDurationMs = (trialResult ? (trialResult.endTime - trialResult.startTime) : 0) + (task1Result ? (task1Result.endTime - task1Result.startTime) : 0) + (task2Result ? (task2Result.endTime - task2Result.startTime) : 0);

        const buildResponses = (task: TaskResult | null, blockName: string) => {
           if (!task) return [];
           return task.responses.map((r) => ({
             responseId: `resp_${participantId}_${blockName}_${r.questionIndex}`,
             questionId: r.questionId || "",
             block: blockName,
             position: r.questionIndex,
             lettersShown: r.letters,
             wordLength: r.letters.length,
             answerTyped: r.userAnswer,
             isCorrect: r.isCorrect,
             skipped: r.skipped,
             attempts: r.attempts,
             timeTakenMs: r.timeTaken * 1000, 
             validAnswersSnapshot: "N/A",
             // Hint tracking
             hintStage: r.hintStage || 'none',
             revealedFirstLetter: r.revealedFirstLetter || null,
             revealedLastLetter: r.revealedLastLetter || null,
             hintFirstLetterTimeSec: r.hintFirstLetterTime ?? null,
             hintLastLetterTimeSec: r.hintLastLetterTime ?? null,
             hintGaveUpTimeSec: r.hintGaveUpTime ?? null,
           }));
        };
        const getFlattenedData = () => {
          const flat: Record<string, any> = {
            ParticipantID: participantId,
            Timestamp_Start: experimentData.timestamp,
            Timestamp_End: new Date().toISOString(),
            Total_Duration_Ms: totalDurationMs,
            GroupID: groupId,
            Browser: getDeviceBrowser(),
            Trial_Difficulty_Evaluation: trialDifficulty || "none"
          };

          // Demographics
          if (demographics) {
            Object.entries(demographics).forEach(([key, val]) => {
              flat[`demo_${key}`] = val;
            });
          }

          // Summary performance
          flat.Easy_Prediction_Sec = pred1;
          flat.Hard_Prediction_Sec = pred2;
          flat.Easy_Total_Actual_Sec = (task1Result?.endTime && task1Result?.startTime) ? (task1Result.endTime - task1Result.startTime) / 1000 : 0;
          flat.Hard_Total_Actual_Sec = (task2Result?.endTime && task2Result?.startTime) ? (task2Result.endTime - task2Result.startTime) / 1000 : 0;

          // Helper for puzzles
          const mapPuzzles = (task: TaskResult | null, prefix: string) => {
            if (!task) return;
            task.responses.forEach((r, idx) => {
              const p = `${prefix}_p${idx + 1}`;
              flat[`${p}_letters`] = r.letters;
              flat[`${p}_answer`] = r.userAnswer;
              flat[`${p}_correct`] = r.isCorrect;
              flat[`${p}_time_ms`] = r.timeTaken * 1000;
              flat[`${p}_attempts`] = r.attempts;
              flat[`${p}_skipped`] = r.skipped;
              flat[`${p}_hintStage`] = r.hintStage;
              flat[`${p}_hint1_time`] = r.hintFirstLetterTime;
              flat[`${p}_hint2_time`] = r.hintLastLetterTime;
              flat[`${p}_gaveUp_time`] = r.hintGaveUpTime;
            });
          };

          mapPuzzles(trialResult, "trial");
          mapPuzzles(task1Result, "easy");
          mapPuzzles(task2Result, "hard");

          // Post-Survey
          if (postSurvey) {
            Object.entries(postSurvey).forEach(([key, val]) => {
              if (key === 'dynamicResponses' && val && typeof val === 'object') {
                Object.entries(val).forEach(([dk, dv]) => {
                  flat[`survey_dynamic_${dk}`] = dv;
                });
              } else {
                flat[`survey_${key}`] = val;
              }
            });
          }

          return flat;
        };

        const payload = getFlattenedData();

        // Log the flattened payload for verification
        console.log("Exporting wide-format data:", payload);

        await postRunToGoogleSheet(payload);
      } catch (err) {
        console.error("Failed to log to Google Sheets silently:", err);
      }
    };
    logToSheets();
  }, [participantId, trialResult, task1Result, task2Result, demographics, groupId, trialDifficulty]);

  const handlePreview = useCallback(() => {
    const mapping: Record<string, Phase> = {
      welcome: "welcome",
      demographics: "demographics",
      trial: "trial_intro",
      trial_difficulty: "trial_difficulty",
      predict1: "predict1",
      feedback1: "complete1",
      predict2: "predict2",
      feedback2: "complete2",
      survey: "postsurvey",
      debrief: "debrief",
    };
    setPhase(mapping[activeAdminTab] || "welcome");
  }, [activeAdminTab]);

  const nextPhase = useCallback(() => {
    const phases: Phase[] = ["welcome", "demographics", "trial_intro", "trial", "trial_difficulty", "predict1", "task1", "complete1", "predict2", "task2", "complete2", "postsurvey", "debrief"];
    const currentIndex = phases.indexOf(phase);
    if (currentIndex < phases.length - 1) setPhase(phases[currentIndex + 1]);
  }, [phase]);

  const prevPhase = useCallback(() => {
    const phases: Phase[] = ["welcome", "demographics", "trial_intro", "trial", "trial_difficulty", "predict1", "task1", "complete1", "predict2", "task2", "complete2", "postsurvey", "debrief"];
    const currentIndex = phases.indexOf(phase);
    if (currentIndex > 0) setPhase(phases[currentIndex - 1]);
  }, [phase]);

  const targetLabel = groupId === "self" ? "you" : "other students";

  const experimentData: ExperimentData = {
    participantId,
    timestamp: new Date().toISOString(),
    groupId,
    demographics,
    demographicsContent: cmsContent.anagram_demographics,
    trialResult,
    trialDifficulty: trialDifficulty || undefined,
    task1Result,
    task2Result,
    postSurvey,
  };

  if (!isCmsLoaded && !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400 italic">Initializing Experiment...</div>;
  }

  const renderPhase = () => {
    switch (phase) {
      case "cms":
        return (
          <AnagramAdminLayout 
            activeTab={activeAdminTab} 
            setActiveTab={setActiveAdminTab} 
            onPreview={handlePreview}
          >
          {activeAdminTab === 'welcome' && <WelcomeEditor onPreview={handlePreview} />}
          {activeAdminTab === 'demographics' && <DemographicsEditor onPreview={handlePreview} />}
          {activeAdminTab === 'trial' && <TrialEditor onPreview={handlePreview} />}
          {activeAdminTab === 'trial_difficulty' && <DifficultyEvaluationEditor onPreview={handlePreview} />}
          {activeAdminTab === 'predict1' && <PredictionEditor cmsKey="anagram_task1_prediction" taskLabel="Task 1 (Easy)" onPreview={handlePreview} />}
          {activeAdminTab === 'feedback1' && <FeedbackEditor cmsKey="anagram_task1_feedback" taskLabel="Task 1 (Easy)" onPreview={handlePreview} />}
          {activeAdminTab === 'predict2' && <PredictionEditor cmsKey="anagram_task2_prediction" taskLabel="Task 2 (Hard)" onPreview={handlePreview} />}
          {activeAdminTab === 'feedback2' && <FeedbackEditor cmsKey="anagram_task2_feedback" taskLabel="Task 2 (Hard)" onPreview={handlePreview} />}
          {activeAdminTab === 'survey' && <SurveyEditor onPreview={handlePreview} />}
          {activeAdminTab === 'debrief' && (
            <Debrief 
               data={experimentData.trialResult ? experimentData : {
                 ...experimentData,
                 participantId: "ADMIN-PREVIEW",
                 trialResult: { taskId: "trial", taskName: "Trial (Mock)", predictionSeconds: 0, responses: [], startTime: Date.now(), endTime: Date.now() },
                 task1Result: { taskId: "task1", taskName: "Task 1 (Mock)", predictionSeconds: 30, responses: [], startTime: Date.now(), endTime: Date.now() },
                 task2Result: { taskId: "task2", taskName: "Task 2 (Mock)", predictionSeconds: 45, responses: [], startTime: Date.now(), endTime: Date.now() }
               }} 
               groupId={groupId} 
            />
          )}
          {activeAdminTab === 'questions' && <QuestionBankEditor />}
          {activeAdminTab === 'manifest' && <AnagramManifest />}
        </AnagramAdminLayout>
      );

      case "welcome":
        return <Welcome groupId={groupId} onStart={() => setPhase("demographics")} />;

    case "demographics":
      return <Demographics onComplete={handleDemographics} content={cmsContent.anagram_demographics} />;

    case "trial_intro":
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 mb-2">
              <Play size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight" dangerouslySetInnerHTML={{ __html: cmsContent.anagram_trial?.title || "Trial Phase" }} />
            <div className="text-slate-600 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: cmsContent.anagram_trial?.description || "Get ready for a short trial phase to practice the puzzles." }} />
            <button
              onClick={() => {
                setTrialStart(Date.now());
                setPhase("trial");
              }}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
            >
              <span dangerouslySetInnerHTML={{ __html: cmsContent.anagram_trial?.button_text || "Start Trial →" }} />
            </button>
          </div>
        </div>
      );

    case "trial":
      return (
        <AnagramTask
          sets={activeTrialSets}
          taskName="Trial Part"
          onComplete={handleTrialComplete}
        />
      );

      case "predict1":
        return (
          <PredictionScreen
             targetLabel={targetLabel}
             onConfirm={handlePred1}
             cmsContent={cmsContent.anagram_task1_prediction}
          />
        );

    case "task1":
      return (
        <AnagramTask
          sets={activeEasySets}
          taskName="Task 1 (Easy)"
          onComplete={handleTask1Complete}
          enableHints
        />
      );

    case "complete1":
      return task1Result ? (
        <TaskComplete
          result={task1Result}
          onNext={() => setPhase("predict2")}
          isLast={false}
          cmsContent={cmsContent.anagram_task1_feedback}
        />
      ) : null;

      case "predict2":
        return (
          <PredictionScreen
             targetLabel={targetLabel}
             onConfirm={handlePred2}
             cmsContent={cmsContent.anagram_task2_prediction}
          />
        );

    case "task2":
      return (
        <AnagramTask
          sets={activeHardSets}
          taskName="Task 2 (Hard)"
          onComplete={handleTask2Complete}
          enableHints
        />
      );

    case "complete2":
      return task2Result ? (
        <TaskComplete
          result={task2Result}
          onNext={() => setPhase("postsurvey")}
          isLast={true}
          cmsContent={cmsContent.anagram_task2_feedback}
        />
      ) : null;

    case "postsurvey":
      return <PostSurvey groupId={groupId} onComplete={handlePostSurvey} />;

      case "debrief":
        return (
          <Debrief 
            data={experimentData.trialResult ? experimentData : {
              ...experimentData,
              participantId: "ADMIN-PREVIEW",
              trialResult: { taskId: "trial", taskName: "Trial (Mock)", predictionSeconds: 0, responses: [], startTime: Date.now(), endTime: Date.now() },
              task1Result: { taskId: "task1", taskName: "Task 1 (Mock)", predictionSeconds: 30, responses: [], startTime: Date.now(), endTime: Date.now() },
              task2Result: { taskId: "task2", taskName: "Task 2 (Mock)", predictionSeconds: 45, responses: [], startTime: Date.now(), endTime: Date.now() }
            }} 
            groupId={groupId} 
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen">
      {renderPhase()}
      {isAdmin && phase !== "cms" && (
        <AdminQuickNav 
          onBackToAdmin={() => setPhase("cms")}
          onRefreshContent={refreshCMS}
          onNextPhase={nextPhase}
          onPrevPhase={prevPhase}
          currentPhase={phase}
        />
      )}
    </div>
  );
}
