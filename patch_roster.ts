import { readFileSync, writeFileSync } from 'fs';

const file = 'src/pages/InteractiveScanQuizPage.tsx';
let content = readFileSync(file, 'utf-8');

const oldRosterHtml = `                    {/* Placeholder Student List */}
                    {Object.keys(responses).map(sid => (
                        <div key={sid} className="bg-slate-700 p-4 rounded-xl flex justify-between items-center border border-slate-600">
                            <span className="font-bold text-white">Seat Placeholder</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                                <span className="font-black text-emerald-400">?</span>
                            </div>
                        </div>
                    ))}
                    {Object.keys(responses).length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                            <Users size={48} className="mb-4 opacity-50" />
                            <p className="font-medium text-lg">No answers yet</p>
                            <p className="text-sm mt-2 opacity-75">Scan markers to see students pop in here.</p>
                        </div>
                    )}`;

const newRosterHtml = `                    {/* Student List */}
                    {Object.keys(responses).map(sid => {
                        const isRevealed = activeSession?.status === 'revealed';
                        const isCorrect = responses[sid] === questions[currentQuestionIndex]?.correct_answer;
                        
                        return (
                            <div key={sid} className="bg-slate-700 p-4 rounded-xl flex justify-between items-center border border-slate-600 shadow-sm">
                                <span className="font-bold text-slate-200 truncate pr-4">{sid}</span>
                                <div className={\`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all \${
                                    !isRevealed 
                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                                        : isCorrect 
                                            ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' 
                                            : 'bg-red-500 border-red-400 text-white'
                                }\`}>
                                    <span className="font-black text-lg">
                                        {!isRevealed ? '?' : responses[sid]}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(responses).length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                            <Users size={48} className="mb-4 opacity-30" />
                            <p className="font-bold text-lg text-slate-400">No Answers Yet</p>
                            <p className="text-sm mt-2">Point camera at student markers to register their answers automatically.</p>
                        </div>
                    )}`;

content = content.replace(oldRosterHtml, newRosterHtml);

writeFileSync(file, content);
