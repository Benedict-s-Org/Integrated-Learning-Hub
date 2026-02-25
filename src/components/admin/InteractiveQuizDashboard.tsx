import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Users, CheckCircle2 } from 'lucide-react';

interface QuizSession {
    id: string;
    host_id: string;
    class_id: string;
    status: 'idle' | 'polling' | 'revealed';
    current_question_id: string | null;
}

interface QuizQuestion {
    id: string;
    question_text: string;
    options: Record<string, string>;
    correct_answer: string;
}

interface InteractiveQuizDashboardProps {
    className: string;
}

export function InteractiveQuizDashboard({ className }: InteractiveQuizDashboardProps) {
    const [session, setSession] = useState<QuizSession | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [responses, setResponses] = useState<Record<string, string>>({}); // student_id -> answer

    useEffect(() => {
        if (className) {
            setupDashboard();
        }
        return () => {
            supabase.removeAllChannels();
        };
    }, [className]);

    const setupDashboard = async () => {
        // Fetch students
        const { data: usersData } = await supabase
            .from('users')
            .select('id, username')
            .eq('class', className);

        if (usersData) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, display_name, class_number')
                .in('id', usersData.map(u => u.id));

            const _profiles: any[] = profiles || [];
            const merged = usersData.map(u => {
                const p = _profiles.find(p => p.id === u.id);
                return {
                    ...u,
                    display_name: p?.display_name || null,
                    class_number: p?.class_number || null
                };
            }).sort((a, b) => (a.class_number || 0) - (b.class_number || 0));
            setStudents(merged);
        }

        // Find active session for this class
        const { data: sessionData } = await supabase
            .from('interactive_quiz_sessions' as any)
            .select('*')
            .eq('class_id', className)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (sessionData) {
            setSession(sessionData);
            if (sessionData.current_question_id) {
                fetchQuestion(sessionData.current_question_id);
                fetchResponses(sessionData.id, sessionData.current_question_id);
            }
            subscribeToSession(className);
            subscribeToResponses(sessionData.id);
        } else {
            // Subscribe to new sessions
            subscribeToSession(className);
        }
    };

    const fetchQuestion = async (qId: string) => {
        const { data } = await supabase
            .from('interactive_quiz_questions' as any)
            .select('*')
            .eq('id', qId)
            .single();
        if (data) setCurrentQuestion(data);
    };

    const fetchResponses = async (sId: string, qId: string) => {
        const { data } = await supabase
            .from('interactive_quiz_responses' as any)
            .select('*')
            .eq('session_id', sId)
            .eq('question_id', qId);

        if (data) {
            const r: Record<string, string> = {};
            data.forEach(d => r[d.student_id] = d.answer);
            setResponses(r);
        }
    };

    const subscribeToSession = (clsName: string) => {
        supabase.channel(`session_${clsName}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'interactive_quiz_sessions', filter: `class_id=eq.${clsName}` }, async payload => {
                if (payload.eventType === 'DELETE') {
                    setSession(null);
                    setCurrentQuestion(null);
                    setResponses({});
                    return;
                }
                const newSession = payload.new as QuizSession;
                setSession(newSession);

                // Fetch question and clear responses if question changed
                if (newSession.current_question_id !== session?.current_question_id) {
                    if (newSession.current_question_id) {
                        fetchQuestion(newSession.current_question_id);
                    } else {
                        setCurrentQuestion(null);
                    }
                    setResponses({});
                    if (newSession.id && newSession.current_question_id) {
                        fetchResponses(newSession.id, newSession.current_question_id);
                        subscribeToResponses(newSession.id);
                    }
                }
            })
            .subscribe();
    };

    const subscribeToResponses = (sessionId: string) => {
        // Just listening to anything on this session ID
        supabase.channel(`dashboard_res_${sessionId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interactive_quiz_responses', filter: `session_id=eq.${sessionId}` }, payload => {
                const newResponse = payload.new;
                setResponses(prev => ({ ...prev, [newResponse.student_id]: newResponse.answer }));
            })
            .subscribe();
    };

    const getAnswerCounts = () => {
        const counts = { A: 0, B: 0, C: 0, D: 0 };
        Object.values(responses).forEach(ans => {
            if (ans in counts) counts[ans as keyof typeof counts]++;
        });
        return counts;
    };

    if (!session) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-12 text-center border-4 border-dashed border-slate-200">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <Users size={40} className="text-blue-500" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-4">No Active Quiz</h2>
                <p className="text-xl text-slate-500 max-w-md mx-auto">
                    Waiting for the teacher to start an interactive scanning session.
                </p>
            </div>
        );
    }

    const answerCounts = getAnswerCounts();
    const totalResponses = Object.keys(responses).length;

    return (
        <div className="h-full flex flex-col bg-slate-900 text-slate-50 rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="p-8 pb-4 shrink-0 flex items-center justify-between border-b border-slate-800">
                <div className="flex-1">
                    {session.status === 'polling' ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase tracking-wider text-sm animate-pulse mb-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            Scanner Active
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full font-bold uppercase tracking-wider text-sm mb-4">
                            Results Revealed
                        </div>
                    )}
                    <h2 className="text-4xl font-extrabold text-white leading-tight">
                        {currentQuestion?.question_text || "Waiting for question..."}
                    </h2>
                </div>
                <div className="text-right ml-8">
                    <div className="text-6xl font-black text-blue-400">{totalResponses} <span className="text-3xl text-slate-500">/ {students.length}</span></div>
                    <div className="text-slate-400 font-medium tracking-wide uppercase mt-2">Responses</div>
                </div>
            </div>

            <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 overflow-y-auto content-start">
                {students.map(student => {
                    const hasAnswered = !!responses[student.id];
                    const answer = responses[student.id];
                    const isCorrect = answer === currentQuestion?.correct_answer;

                    let bgClass = "bg-slate-800 border-slate-700";
                    let textClass = "text-slate-300";

                    if (session.status === 'polling' && hasAnswered) {
                        bgClass = "bg-blue-600 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]";
                        textClass = "text-white";
                    } else if (session.status === 'revealed' && hasAnswered) {
                        if (isCorrect) {
                            bgClass = "bg-emerald-600 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]";
                            textClass = "text-white";
                        } else {
                            bgClass = "bg-red-600 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]";
                            textClass = "text-white";
                        }
                    }

                    return (
                        <div key={student.id} className={`p-4 rounded-2xl border-2 transition-all duration-500 flex flex-col items-center justify-center transform ${hasAnswered ? 'scale-105' : 'scale-100'} ${bgClass}`}>
                            <span className={`text-lg font-bold truncate w-full text-center ${textClass}`}>
                                {student.display_name || student.username}
                            </span>
                            <div className="mt-3 h-12 flex items-center justify-center">
                                {session.status === 'polling' ? (
                                    hasAnswered ? <CheckCircle2 size={32} className="text-white animate-in zoom-in spin-in" /> : <div className="w-8 h-8 rounded-full border-4 border-slate-700" />
                                ) : (
                                    hasAnswered ? <span className="text-4xl font-black">{answer}</span> : <span className="text-slate-600 font-bold">N/A</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Results Chart - only show if revealed and options exist */}
            {session.status === 'revealed' && currentQuestion?.options && (
                <div className="shrink-0 bg-slate-800/80 backdrop-blur border-t border-slate-700 p-8 pt-6 animate-in slide-in-from-bottom flex justify-center gap-8">
                    {['A', 'B', 'C', 'D'].map(opt => {
                        if (!currentQuestion.options[opt]) return null;
                        const count = answerCounts[opt as keyof typeof answerCounts];
                        const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
                        const isCorrect = currentQuestion.correct_answer === opt;

                        return (
                            <div key={opt} className="flex flex-col items-center w-32">
                                <div className="text-xl font-bold mb-2 h-16 flex items-end">
                                    <span className={isCorrect ? 'text-emerald-400' : 'text-slate-300'}>{percentage.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-32 bg-slate-900 rounded-t-xl overflow-hidden relative border-t-2 border-x-2 border-slate-700 flex items-end justify-center">
                                    <div
                                        className={`w-full transition-all duration-1000 ease-out ${isCorrect ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                        style={{ height: `${percentage}%` }}
                                    ></div>
                                </div>
                                <div className={`w-full text-center py-3 font-black text-2xl rounded-b-xl ${isCorrect ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-700 text-slate-300'}`}>
                                    {opt}
                                </div>
                                <div className="text-center mt-2 text-sm text-slate-400 font-medium px-2 truncate w-full">
                                    {currentQuestion.options[opt]}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default InteractiveQuizDashboard;
