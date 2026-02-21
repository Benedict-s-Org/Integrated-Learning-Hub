import { readFileSync, writeFileSync } from 'fs';

const file = 'src/pages/InteractiveScanQuizPage.tsx';
let content = readFileSync(file, 'utf-8');

const oldStatusHeader = `                    <div>
                        <span className="text-orange-400 font-bold uppercase tracking-wider text-sm">QR Up! Live</span>
                        <h1 className="text-2xl font-black truncate">{activeSession?.title} <span className="text-slate-500 ml-2 font-medium">• Class {selectedClass}</span></h1>
                    </div>
                    <button onClick={endSessionAndReturn} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all">
                        End Session
                    </button>`;

const newStatusHeader = `                    <div>
                        <span className="text-orange-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                            QR Up! Live
                            {activeSession?.status === 'polling' && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">REC</span>}
                            {activeSession?.status === 'revealed' && <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full">REVEALED</span>}
                        </span>
                        <h1 className="text-2xl font-black truncate">{activeSession?.title} <span className="text-slate-500 ml-2 font-medium">• Class {selectedClass}</span></h1>
                    </div>
                    <button onClick={endSessionAndReturn} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all active:scale-95">
                        End Session
                    </button>`;

content = content.replace(oldStatusHeader, newStatusHeader);

const oldRevealButton = `                    <button className="w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90">
                        <CheckCircle2 size={24} className="text-white" />
                    </button>`;

const newRevealButton = `                    <button 
                        onClick={toggleRevealStatus}
                        className={\`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90 \${
                            activeSession?.status === 'polling' 
                                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        }\`}
                        title={activeSession?.status === 'polling' ? "Reveal Answers" : "Next Question / Reset"}
                    >
                        {activeSession?.status === 'polling' ? <CheckCircle2 size={24} /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>`;

content = content.replace(oldRevealButton, newRevealButton);

const oldFuncStart = `    const endSessionAndReturn = () => {`;

const newFuncs = `    const toggleRevealStatus = async () => {
        if (!activeSession) return;
        
        const newStatus = activeSession.status === 'polling' ? 'revealed' : 'polling';
        
        const { error } = await supabase
            .from('interactive_quiz_sessions' as any)
            .update({ status: newStatus })
            .eq('id', activeSession.id);
            
        if (!error) {
            setActiveSession({ ...activeSession, status: newStatus });
            if (newStatus === 'polling') {
                // If moving back to polling (e.g., next question), we might want to clear local responses
                // For a real app, you'd advance currentQuestionIndex here.
                setResponses({});
            }
        }
    };

    const endSessionAndReturn = () => {`;

content = content.replace(oldFuncStart, newFuncs);

writeFileSync(file, content);
