import { useState, useRef } from "react";
import type { ExperimentData } from "../types/experiment";

interface Props {
  data: ExperimentData;
}

function calculatePFI(result: {
  predictionSeconds: number;
  responses: { skipped: boolean; timeTaken: number }[];
}): number | null {
  const answered = result.responses.filter((r) => !r.skipped);
  if (answered.length === 0) return null;

  const totalPredicted = result.predictionSeconds * answered.length;
  const totalActual = answered.reduce((sum, r) => sum + r.timeTaken, 0);

  if (totalPredicted === 0) return null;
  return (totalActual - totalPredicted) / totalPredicted;
}

const APPS_SCRIPT_CODE = `function doPost(e) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Add headers if first row is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "ParticipantID", "Timestamp", "Group",
      "Age", "Gender", "Education",
      "NativeLang", "EnglishProf",
      "Task1_PredSec", "Task1_Correct",
      "Task1_TotalSec", "Task1_PFI",
      "Task2_PredSec", "Task2_Correct",
      "Task2_TotalSec", "Task2_PFI",
      "Opt1","Opt2","Opt3",
      "NFC1","NFC2","NFC3",
      "PastAnagram","PastPsych",
      "ManipCheck","ManipMatch",
      "DiffTask1","DiffTask2",
      "Comments"
    ]);
  }
  
  function taskStats(t) {
    if (!t) return {p:0,c:0,s:0,pfi:"N/A"};
    var ans = t.responses.filter(
      function(r){return !r.skipped}
    );
    var c = ans.filter(
      function(r){return r.isCorrect}
    ).length;
    var s = ans.reduce(
      function(a,r){return a+r.timeTaken},0
    );
    var tp = t.predictionSeconds * ans.length;
    var pfi = tp > 0
      ? ((s - tp) / tp).toFixed(4)
      : "N/A";
    return {p:t.predictionSeconds,c:c,s:s,pfi:pfi};
  }
  
  var t1 = taskStats(data.task1Result);
  var t2 = taskStats(data.task2Result);
  var d = data.demographics || {};
  var sv = data.postSurvey || {};
  
  sheet.appendRow([
    data.participantId, data.timestamp,
    data.groupId,
    d.age, d.gender, d.education,
    d.nativeLanguage, d.englishProficiency,
    t1.p, t1.c, t1.s, t1.pfi,
    t2.p, t2.c, t2.s, t2.pfi,
    sv.optimism1, sv.optimism2, sv.optimism3,
    sv.nfc1, sv.nfc2, sv.nfc3,
    sv.pastAnagramExperience,
    sv.pastPsychExperience,
    sv.manipulationCheck,
    sv.manipulationCheck===data.groupId?1:0,
    sv.task1Difficulty, sv.task2Difficulty,
    sv.comments
  ]);
  
  return ContentService
    .createTextOutput("OK")
    .setMimeType(ContentService.MimeType.TEXT);
}`;

export default function Debrief({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [sendStatus, setSendStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const webhookInputRef = useRef<HTMLInputElement>(null);

  const task1PFI = data.task1Result ? calculatePFI(data.task1Result) : null;
  const task2PFI = data.task2Result ? calculatePFI(data.task2Result) : null;

  const hasInvalidData = task1PFI === null || task2PFI === null;
  const manipulationFailed =
    data.postSurvey &&
    data.postSurvey.manipulationCheck !== data.groupId;

  // ─── Build flat data for CSV ───
  const buildCSVRows = () => {
    const rows: string[] = [];
    const header = [
      "ParticipantID", "Timestamp", "Group",
      "Age", "Gender", "Education", "NativeLanguage", "EnglishProficiency",
      "Task", "PredictionSecPerQ", "Question", "Letters",
      "Answer", "Correct", "TimeSec", "Attempts", "Skipped",
      "TaskPFI",
      "Optimism1", "Optimism2", "Optimism3",
      "NFC1", "NFC2", "NFC3",
      "PastAnagram", "PastPsych",
      "ManipCheck", "ManipCheckMatch",
      "Task1Difficulty", "Task2Difficulty",
      "Comments",
    ];
    rows.push(header.join(","));

    const d = data.demographics;
    const s = data.postSurvey;

    [data.task1Result, data.task2Result].forEach((task) => {
      if (!task) return;
      const pfi = calculatePFI(task);
      task.responses.forEach((r) => {
        const row = [
          data.participantId,
          data.timestamp,
          data.groupId,
          d?.age ?? "",
          d?.gender ?? "",
          d?.education ?? "",
          d?.nativeLanguage ?? "",
          d?.englishProficiency ?? "",
          task.taskName,
          task.predictionSeconds,
          r.questionIndex + 1,
          r.letters,
          `"${r.userAnswer}"`,
          r.isCorrect ? 1 : 0,
          r.timeTaken,
          r.attempts,
          r.skipped ? 1 : 0,
          pfi !== null ? pfi.toFixed(4) : "N/A",
          s?.optimism1 ?? "",
          s?.optimism2 ?? "",
          s?.optimism3 ?? "",
          s?.nfc1 ?? "",
          s?.nfc2 ?? "",
          s?.nfc3 ?? "",
          s?.pastAnagramExperience ?? "",
          s?.pastPsychExperience ?? "",
          s?.manipulationCheck ?? "",
          s ? (s.manipulationCheck === data.groupId ? 1 : 0) : "",
          s?.task1Difficulty ?? "",
          s?.task2Difficulty ?? "",
          s?.comments ? `"${s.comments.replace(/"/g, '""')}"` : "",
        ];
        rows.push(row.join(","));
      });
    });

    return rows.join("\n");
  };

  // ─── Download CSV ───
  const downloadCSV = () => {
    const csv = buildCSVRows();
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning_fallacy_${data.participantId}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  };

  // ─── Copy JSON ───
  const copyJSON = () => {
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─── Copy Apps Script code ───
  const copyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 3000);
    });
  };

  // ─── Send to Google Sheets via webhook ───
  const sendToWebhook = async () => {
    if (!webhookUrl) return;
    setSendStatus("sending");
    try {
      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSendStatus("success");
    } catch {
      setSendStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-rose-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-3xl font-bold text-gray-900">
            Thank You! — Debrief
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            ID: {data.participantId}
          </p>
        </div>

        {/* Warnings */}
        {hasInvalidData && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
            <p className="text-lg font-bold text-red-600">⚠️ Invalid Data</p>
            <p className="text-sm text-red-500">
              One or both tasks were entirely skipped. This data cannot be used
              for analysis.
            </p>
          </div>
        )}
        {manipulationFailed && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-amber-700">
              ⚠️ Manipulation check mismatch
            </p>
            <p className="text-xs text-amber-600">
              Participant was in &quot;{data.groupId}&quot; group but answered
              &quot;{data.postSurvey?.manipulationCheck}&quot; on the
              comprehension check.
            </p>
          </div>
        )}

        {/* Results Summary */}
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">
            📊 Your Results
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 text-center border">
              <p className="text-sm text-gray-500 mb-1">Task 1 (Easy) PFI</p>
              <p
                className={`text-2xl font-bold ${
                  task1PFI === null ? "text-red-500" : "text-gray-900"
                }`}
              >
                {task1PFI === null ? "N/A" : task1PFI.toFixed(2)}
              </p>
              {task1PFI !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {task1PFI > 0
                    ? "Underestimated"
                    : task1PFI < 0
                    ? "Overestimated"
                    : "Accurate"}
                </p>
              )}
            </div>
            <div className="bg-white rounded-lg p-4 text-center border">
              <p className="text-sm text-gray-500 mb-1">Task 2 (Hard) PFI</p>
              <p
                className={`text-2xl font-bold ${
                  task2PFI === null ? "text-red-500" : "text-gray-900"
                }`}
              >
                {task2PFI === null ? "N/A" : task2PFI.toFixed(2)}
              </p>
              {task2PFI !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {task2PFI > 0
                    ? "Underestimated"
                    : task2PFI < 0
                    ? "Overestimated"
                    : "Accurate"}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            PFI = (Actual Time − Predicted Time) / Predicted Time
            <br />
            Positive = underestimated · Negative = overestimated
          </p>
        </div>

        {/* Study Explanation */}
        <div className="bg-blue-50 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 text-lg">
            🔬 About This Study
          </h2>
          <p className="text-sm text-gray-700">
            This experiment investigates the <strong>Planning Fallacy</strong> —
            the tendency for people to underestimate how long tasks will take.
          </p>
          <p className="text-sm text-gray-700">
            <strong>Your group:</strong>{" "}
            {data.groupId === "self"
              ? 'You predicted for "yourself"'
              : 'You predicted for "other students"'}
          </p>
          <p className="text-sm text-gray-700">
            We compare whether people show a stronger planning fallacy when
            predicting for themselves vs. others, and whether task difficulty
            affects this bias.
          </p>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* DATA COLLECTION SECTION                    */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-emerald-50 rounded-xl p-5 space-y-5">
          <h2 className="font-semibold text-gray-900 text-lg">
            💾 Data Collection
          </h2>

          {/* Option 1: CSV */}
          <button
            onClick={downloadCSV}
            className="w-full py-3 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg transition-all"
          >
            📥 Download CSV File
          </button>

          {/* Option 2: Copy JSON */}
          <button
            onClick={copyJSON}
            className={`w-full py-3 rounded-xl font-semibold transition-all border-2 ${
              copied
                ? "bg-green-100 border-green-400 text-green-700"
                : "bg-white border-gray-200 hover:border-emerald-400 text-gray-700"
            }`}
          >
            {copied ? "✅ Copied to clipboard!" : "📋 Copy Full Data as JSON"}
          </button>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* GOOGLE SHEETS AUTO-COLLECTION              */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-indigo-50 rounded-xl p-5 space-y-4 border-2 border-indigo-200">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📡</span>
            <h2 className="font-bold text-gray-900 text-lg">
              Auto-Send to Google Sheets
            </h2>
          </div>

          <p className="text-sm text-gray-600">
            Connect this experiment to a Google Sheet to automatically collect
            all participant data. Follow the 3 steps below:
          </p>

          {/* Step 1 */}
          <div className="bg-white rounded-xl p-4 space-y-3 border">
            <h3 className="font-semibold text-indigo-700 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center font-bold">
                1
              </span>
              Create Google Apps Script
            </h3>
            <ol className="text-sm text-gray-600 space-y-1 ml-9 list-decimal">
              <li>
                Open a new{" "}
                <a
                  href="https://sheets.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline"
                >
                  Google Sheet
                </a>
              </li>
              <li>
                Go to <strong>Extensions → Apps Script</strong>
              </li>
              <li>Delete any existing code</li>
              <li>Paste the code below</li>
            </ol>
          </div>

          {/* Step 2: Code Block */}
          <div className="bg-white rounded-xl p-4 space-y-3 border">
            <h3 className="font-semibold text-indigo-700 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center font-bold">
                2
              </span>
              Copy & paste this code
            </h3>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-48 overflow-y-auto">
                {APPS_SCRIPT_CODE}
              </pre>
              <button
                onClick={copyCode}
                className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  codeCopied
                    ? "bg-green-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 border shadow-sm"
                }`}
              >
                {codeCopied ? "✅ Copied!" : "📋 Copy Code"}
              </button>
            </div>
            <ol className="text-sm text-gray-600 space-y-1 ml-9 list-decimal">
              <li>
                Click <strong>Deploy → New deployment</strong>
              </li>
              <li>
                Type: <strong>Web app</strong>
              </li>
              <li>
                Who has access: <strong>Anyone</strong>
              </li>
              <li>
                Click <strong>Deploy</strong> and authorize
              </li>
              <li>
                Copy the <strong>Web app URL</strong>
              </li>
            </ol>
          </div>

          {/* Step 3: Paste URL */}
          <div className="bg-white rounded-xl p-4 space-y-3 border">
            <h3 className="font-semibold text-indigo-700 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center font-bold">
                3
              </span>
              Paste the URL & send data
            </h3>
            <div className="flex gap-2">
              <input
                ref={webhookInputRef}
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-400 focus:outline-none font-mono"
              />
              <button
                onClick={sendToWebhook}
                disabled={!webhookUrl || sendStatus === "sending"}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                  sendStatus === "success"
                    ? "bg-green-500 text-white"
                    : sendStatus === "error"
                    ? "bg-red-500 text-white"
                    : webhookUrl
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {sendStatus === "sending"
                  ? "⏳ Sending..."
                  : sendStatus === "success"
                  ? "✅ Sent!"
                  : sendStatus === "error"
                  ? "❌ Retry"
                  : "🚀 Send Data"}
              </button>
            </div>
            {sendStatus === "success" && (
              <p className="text-sm text-green-600 font-medium">
                ✅ Data sent successfully! Check your Google Sheet.
              </p>
            )}
            {sendStatus === "error" && (
              <p className="text-sm text-red-600 font-medium">
                ❌ Failed to send. Please check the URL and try again.
              </p>
            )}
          </div>

          <p className="text-xs text-indigo-400 text-center">
            💡 Once set up, every participant's data will automatically appear
            in your Google Sheet — no manual download needed!
          </p>
        </div>

        <p className="text-center text-sm text-gray-400 pt-2">
          Thank you for participating! 🙏
        </p>
      </div>
    </div>
  );
}
