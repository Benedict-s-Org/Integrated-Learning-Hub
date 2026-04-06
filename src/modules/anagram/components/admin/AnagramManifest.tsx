import React from 'react';
import { 
  Users, 
  Hand, 
  Brain, 
  PlayCircle, 
  BarChart2, 
  ClipboardCheck, 
  FileCheck, 
  Info
} from 'lucide-react';

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
  const steps = [
    {
      icon: Hand,
      title: "Welcome & Consent",
      description: "Participants land on the welcome page, read the study information, and provide consent to participate."
    },
    {
      icon: Users,
      title: "Demographics",
      description: "Collection of basic data: Age, Gender, Education, and Language Proficiency for research stratification."
    },
    {
      icon: Brain,
      title: "Task 1 (Easy) Prediction",
      description: "The 'Self vs Other' manipulation starts here. Participants predict how many seconds it will take to solve 10 easy anagrams."
    },
    {
      icon: PlayCircle,
      title: "Task 1 (Easy) Execution",
      description: "Real-time attempt at 10 anagram puzzles. Each anagram has a 5-attempt limit or can be skipped."
    },
    {
      icon: FileCheck,
      title: "Task 1 Feedback",
      description: "Immediate feedback on performance, showing accuracy and total time taken compared to predictions."
    },
    {
      icon: Brain,
      title: "Task 2 (Hard) Prediction",
      description: "Participants predict their performance for a more challenging set of 10 anagrams."
    },
    {
      icon: PlayCircle,
      title: "Task 2 (Hard) Execution",
      description: "Attempting the more difficult puzzles. This phase measures the 'Planning Fallacy' or 'Self-Bias'."
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
          <h4 className="font-black text-white text-lg mb-2">Technical Flow Persistence</h4>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            The experiment state is managed locally via React state but can be extended with Supabase sync for cross-session recovery. 
            Currently, data is submitted only upon completion of the Debrief phase.
          </p>
          <div className="flex gap-4">
             <div className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">Auth Bypassed: PUBLIC</div>
             <div className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">Mode: ISOLATED</div>
          </div>
        </div>
      </div>
    </div>
  );
}
