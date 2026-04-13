import React from 'react';
import { 
  Users, 
  Hand, 
  Brain, 
  PlayCircle, 
  BarChart2, 
  ClipboardCheck, 
  FileCheck, 
  Info,
  Database,
  Zap,
  RefreshCw
} from 'lucide-react';
import { setupNotionRelations } from '../../services/notionLogger';

interface ManifestStepProps {
  icon: React.ElementType;
  title: string;
  description: string;
  isLast?: boolean;
}

function ManifestStep({ icon: Icon, title, description, isLast }: ManifestStepProps) {
  return (
    <div className="flex gap-6 group">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 bg-white rounded-2xl border-2 border-slate-200 flex items-center justify-center text-slate-500 shadow-sm group-hover:border-blue-500 group-hover:text-blue-600 transition-all group-hover:scale-110 z-10">
          <Icon size={24} />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-slate-200 group-hover:bg-blue-100 transition-colors" />
        )}
      </div>
      <div className="pb-10 pt-1 group-hover:translate-x-1 transition-transform">
        <h4 className="font-black text-slate-800 text-lg tracking-tight mb-1">{title}</h4>
        <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function AnagramManifest() {
  const [isSettingUp, setIsSettingUp] = React.useState(false);

  const handleSetupRelations = async () => {
    setIsSettingUp(true);
    try {
      const res = await setupNotionRelations();
      alert(`Success: ${res?.message || 'Relations configured.'}`);
    } catch (err: any) {
      alert(`Error setting up relations: ${err.message}`);
    } finally {
      setIsSettingUp(false);
    }
  };

  const steps = [
    {
      icon: Database,
      title: "Notion Question Sync",
      description: "The experiment dynamically fetches its active question bank from Notion. Content management is handled externally for agility."
    },
    {
      icon: Hand,
      title: "Welcome & Consent",
      description: "Participants land on the welcome page, read the study information, and provide consent to participate."
    },
    {
      icon: Users,
      title: "Dynamic Demographics",
      description: "Collection of customizable demographic data: Age, Gender, Education, and other researcher-defined fields."
    },
    {
      icon: PlayCircle,
      title: "Trial Phase",
      description: "Short 4-question trial phase using 'Calibration' questions to familiarize participants with the interface."
    },
    {
      icon: ClipboardCheck,
      title: "Practice Trial Check",
      description: "Participants evaluate the difficulty of the calibration anagrams to establish a subjective baseline before making predictions for Task 1."
    },
    {
      icon: Brain,
      title: "Task 1 (Easy) Prediction",
      description: "The 'Self vs Other' manipulation starts here. Participants predict their performance for 10 anagrams (3 Warm-up + 7 Easy questions)."
    },
    {
      icon: PlayCircle,
      title: "Task 1 (Easy) Execution",
      description: "Real-time attempt at the task. 3 simple warm-up anagrams are followed by 7 B2-level easy anagrams to establish baseline confidence."
    },
    {
      icon: FileCheck,
      title: "Task 1 Feedback",
      description: "Immediate feedback on performance, showing accuracy and total time taken compared to predictions."
    },
    {
      icon: Brain,
      title: "Task 2 (Hard) Prediction",
      description: "Participants predict their performance for a more challenging set of 10 anagrams (8 6-letter + 2 7-letter words)."
    },
    {
      icon: PlayCircle,
      title: "Task 2 (Hard) Execution",
      description: "Attempting the difficult puzzles. 7-letter words are strategically placed at the 4th and 7th positions to measure the planning gap."
    },
    {
      icon: FileCheck,
      title: "Task 2 Feedback",
      description: "Review of Task 2 results. The data collection for performance is now complete."
    },
    {
      icon: ClipboardCheck,
      title: "Post-Experiment Survey",
      description: "Collection of psychological traits (Optimism, Need for Cognition) and verification of the manipulation check."
    },
    {
      icon: Zap,
      title: "Automated Notion Logging",
      description: "Complete experiment data (Runs & Responses) is automatically synced to the Notion backup databases upon completion."
    },
    {
      icon: BarChart2,
      title: "Debrief & Data Visualization",
      description: "Comprehensive breakdown of results, showing the participant's planning gap and group comparisons."
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Project Manifest</h2>
          <p className="text-slate-500 text-sm font-medium">Visualization of the participant's experimental journey.</p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-blue-600 rotate-12 pointer-events-none">
          <Brain size={400} strokeWidth={1} />
        </div>
        
        <div className="relative pl-4 overflow-hidden">
          {steps.map((step, idx) => (
            <ManifestStep
              key={idx}
              icon={step.icon}
              title={step.title}
              description={step.description}
              isLast={idx === steps.length - 1}
            />
          ))}
        </div>
      </div>

      <div className="bg-slate-900 text-white p-8 rounded-3xl flex items-start gap-6 shadow-2xl shadow-slate-200">
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400 shrink-0">
          <Info size={28} />
        </div>
        <div>
          <h4 className="font-black text-white text-lg mb-2">Technical Flow & Notion Sync</h4>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Experiment metadata and participant responses are automatically logged to **Notion (Runs & Responses DBs)** via the `anagram-notion` Edge Function. 
            Two-way relations are established between responses and the question bank for granular analysis.
          </p>
          <div className="flex flex-wrap items-center gap-4">
             <div className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/10">Sync: ACTIVE</div>
             <div className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/10">Backend: Edge Runtime</div>
             
             <button 
               onClick={handleSetupRelations}
               disabled={isSettingUp}
               className="ml-auto flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded border border-blue-500/30 transition-colors disabled:opacity-50"
             >
               <RefreshCw size={14} className={isSettingUp ? "animate-spin" : ""} />
               {isSettingUp ? "Configuring Databases..." : "Initialize Notion Relations"}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
