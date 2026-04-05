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
import TaskComplete from "./components/TaskComplete";
import PostSurvey from "./components/PostSurvey";
import Debrief from "./components/Debrief";

type Phase =
  | "welcome"
  | "demographics"
  | "predict1"
  | "task1"
  | "complete1"
  | "predict2"
  | "task2"
  | "complete2"
  | "postsurvey"
  | "debrief";

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

  const [phase, setPhase] = useState<Phase>("welcome");
  const [participantId] = useState(() => generateId());
  const [groupId] = useState<"self" | "other">(() =>
    Math.random() < 0.5 ? "self" : "other"
  );

  const [demographics, setDemographics] = useState<DemographicsData | null>(
    null
  );
  const [task1Result, setTask1Result] = useState<TaskResult | null>(null);
  const [task2Result, setTask2Result] = useState<TaskResult | null>(null);
  const [postSurvey, setPostSurvey] = useState<PostSurveyData | null>(null);
  const [pred1, setPred1] = useState(0);
  const [pred2, setPred2] = useState(0);

  const handleDemographics = useCallback((data: DemographicsData) => {
    setDemographics(data);
    setPhase("predict1");
  }, []);

  const handlePred1 = useCallback((seconds: number) => {
    setPred1(seconds);
    setPhase("task1");
  }, []);

  const handleTask1Complete = useCallback(
    (responses: QuestionResponse[]) => {
      const result: TaskResult = {
        taskId: "task1",
        taskName: "Task 1 (Easy)",
        predictionSeconds: pred1,
        responses,
        startTime: Date.now(),
        endTime: Date.now(),
      };
      setTask1Result(result);
      setPhase("complete1");
    },
    [pred1]
  );

  const handlePred2 = useCallback((seconds: number) => {
    setPred2(seconds);
    setPhase("task2");
  }, []);

  const handleTask2Complete = useCallback(
    (responses: QuestionResponse[]) => {
      const result: TaskResult = {
        taskId: "task2",
        taskName: "Task 2 (Hard)",
        predictionSeconds: pred2,
        responses,
        startTime: Date.now(),
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
  }, []);

  const targetLabel = groupId === "self" ? "you" : "other students";

  const experimentData: ExperimentData = {
    participantId,
    timestamp: new Date().toISOString(),
    groupId,
    demographics,
    task1Result,
    task2Result,
    postSurvey,
  };

  switch (phase) {
    case "welcome":
      return (
        <Welcome groupId={groupId} onStart={() => setPhase("demographics")} />
      );

    case "demographics":
      return <Demographics onComplete={handleDemographics} />;

    case "predict1":
      return (
        <PredictionScreen
          taskName="Task 1 (Easy)"
          taskDescription="10 anagrams with IELTS B2 vocabulary (3–4 letters each)"
          targetLabel={targetLabel}
          onConfirm={handlePred1}
        />
      );

    case "task1":
      return (
        <AnagramTask
          sets={easySets}
          taskName="Task 1 (Easy)"
          onComplete={handleTask1Complete}
        />
      );

    case "complete1":
      return task1Result ? (
        <TaskComplete
          result={task1Result}
          onNext={() => setPhase("predict2")}
          isLast={false}
        />
      ) : null;

    case "predict2":
      return (
        <PredictionScreen
          taskName="Task 2 (Hard)"
          taskDescription="10 anagrams with IELTS B2 vocabulary (5–6 letters each)"
          targetLabel={targetLabel}
          onConfirm={handlePred2}
        />
      );

    case "task2":
      return (
        <AnagramTask
          sets={hardSets}
          taskName="Task 2 (Hard)"
          onComplete={handleTask2Complete}
        />
      );

    case "complete2":
      return task2Result ? (
        <TaskComplete
          result={task2Result}
          onNext={() => setPhase("postsurvey")}
          isLast={true}
        />
      ) : null;

    case "postsurvey":
      return <PostSurvey groupId={groupId} onComplete={handlePostSurvey} />;

    case "debrief":
      return <Debrief data={experimentData} />;

    default:
      return null;
  }
}
