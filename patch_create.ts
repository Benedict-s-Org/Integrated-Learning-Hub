import { readFileSync, writeFileSync } from 'fs';

const file = 'src/pages/InteractiveScanQuizPage.tsx';
let content = readFileSync(file, 'utf-8');

const newTypeDecl = `type ViewMode = 'dashboard' | 'go-live-prep' | 'active-session' | 'create-session';`;
content = content.replace(`type ViewMode = 'dashboard' | 'go-live-prep' | 'active-session';`, newTypeDecl);

const newCreateHandler = `    const handleCreateNewSession = () => {
        setViewMode('create-session');
    };`;

content = content.replace(`    const handleCreateNewSession = async () => {
        const sessionTitle = prompt("Enter a name for this session:", \`Quiz \${new Date().toLocaleDateString()}\`);
        if (!sessionTitle) return;

        const { data, error } = await supabase
            .from('interactive_quiz_sessions' as any)
            .insert({
                host_id: user?.id,
                title: sessionTitle,
                status: 'idle'
            })
            .select()
            .single();

        if (data && !error) {
            setSessions(prev => [data as QuizSession, ...prev]);
        }
    };`, newCreateHandler);

const createSessionUI = `    // --- RENDER CREATE SESSION ---
    const renderCreateSession = () => {
        const [title, setTitle] = useState(\`Class Quiz \${new Date().toLocaleDateString()}\`);
        const [draftQuestions, setDraftQuestions] = useState([{ id: 1, text: '', a: '', b: '', c: '', d: '', correct: 'A' }]);
        const [isSubmitting, setIsSubmitting] = useState(false);

        const addQuestion = () => setDraftQuestions([...draftQuestions, { id: Date.now(), text: '', a: '', b: '', c: '', d: '', correct: 'A' }]);
        const removeQuestion = (id: number) => setDraftQuestions(draftQuestions.filter(q => q.id !== id));
        const updateQuestion = (id: number, field: string, value: string) => {
            setDraftQuestions(draftQuestions.map(q => q.id === id ? { ...q, [field]: value } : q));
        };

        const handleSaveSession = async () => {
            if (!title) return alert("Please enter a session title");
            const validQs = draftQuestions.filter(q => q.text.trim() && q.a.trim() && q.b.trim() && q.c.trim() && q.d.trim());
            if (validQs.length === 0) return alert("Please add at least one complete question.");

            setIsSubmitting(true);
            const { data: sessionData, error: sessionError } = await supabase
                .from('interactive_quiz_sessions' as any)
                .insert({ host_id: user?.id, title, status: 'idle' })
                .select()
                .single();

            if (sessionData && !sessionError) {
                const qInserts = validQs.map((q, idx) => ({
                    session_id: sessionData.id,
                    question_text: q.text,
                    options: { "A": q.a, "B": q.b, "C": q.c, "D": q.d },
                    correct_answer: q.correct,
                    order_index: idx
                }));
                await supabase.from('interactive_quiz_questions' as any).insert(qInserts);
                
                setSessions([sessionData as QuizSession, ...sessions]);
                setViewMode('dashboard');
            } else {
                alert("Failed to create session.");
            }
            setIsSubmitting(false);
        };

        return (
            <div className="w-full max-w-5xl mx-auto p-6 md:p-8 animate-in slide-in-from-right duration-300 h-screen flex flex-col">
                <header className="flex justify-between items-center mb-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setViewMode('dashboard')} className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-200 transition-all active:scale-95 text-slate-500">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800">Create New Session</h1>
                            <p className="text-slate-500 font-medium font-sm">Add questions manually or import them.</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleSaveSession} 
                        disabled={isSubmitting}
                        className="px-8 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Session'} <CheckCircle2 size={20} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                        <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Session Title</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xl font-black text-slate-800 outline-none focus:border-orange-400 focus:bg-white transition-all"
                            placeholder="e.g. History Midterm Quiz"
                        />
                    </div>

                    <div className="space-y-6">
                        {draftQuestions.map((q, index) => (
                            <div key={q.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 relative group">
                                <div className="absolute top-6 left-6 w-8 h-8 bg-slate-100 text-slate-400 font-bold rounded-lg flex items-center justify-center">
                                    {index + 1}
                                </div>
                                {draftQuestions.length > 1 && (
                                    <button 
                                        onClick={() => removeQuestion(q.id)}
                                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <div className="ml-12 mb-6">
                                    <input 
                                        type="text" 
                                        value={q.text} 
                                        onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                                        placeholder="Type your question here..." 
                                        className="w-full text-xl font-bold text-slate-800 placeholder:text-slate-300 outline-none bg-transparent border-b-2 border-transparent focus:border-orange-200 pb-2 transition-colors"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                        <div key={opt} className={\`relative flex items-center p-3 rounded-2xl border-2 transition-all \${q.correct === opt ? 'border-emerald-400 bg-emerald-50/50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}\`}>
                                            <button 
                                                onClick={() => updateQuestion(q.id, 'correct', opt)}
                                                className={\`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all \${q.correct === opt ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}\`}
                                                title={\`Mark \${opt} as correct\`}
                                            >
                                                {opt}
                                            </button>
                                            <input 
                                                type="text" 
                                                value={q[opt.toLowerCase() as 'a'|'b'|'c'|'d']} 
                                                onChange={e => updateQuestion(q.id, opt.toLowerCase(), e.target.value)}
                                                placeholder={\`Option \${opt} text\`}
                                                className="flex-1 ml-3 bg-transparent font-medium text-slate-700 outline-none placeholder:text-slate-300"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={addQuestion}
                        className="w-full py-6 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-[2rem] text-slate-500 font-bold flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="bg-white p-2 text-slate-400 rounded-full shadow-sm w-10 h-10" />
                        Add Another Question
                    </button>
                </div>
            </div>
        );
    };`;

const renderBlockOld = `    return (
        <div className="w-full h-full bg-slate-50 flex flex-col relative overflow-hidden font-sans">
            {viewMode === 'dashboard' && renderDashboard()}
            {viewMode === 'go-live-prep' && renderGoLivePrep()}
            {viewMode === 'active-session' && renderActiveSession()}
        </div>
    );`;

const renderBlockNew = `    return (
        <div className="w-full h-full bg-slate-50 flex flex-col relative overflow-hidden font-sans">
            {viewMode === 'dashboard' && renderDashboard()}
            {viewMode === 'create-session' && renderCreateSession()}
            {viewMode === 'go-live-prep' && renderGoLivePrep()}
            {viewMode === 'active-session' && renderActiveSession()}
        </div>
    );`;

content = content.replace(renderBlockOld, createSessionUI + '\n\n' + renderBlockNew);

writeFileSync(file, content);
