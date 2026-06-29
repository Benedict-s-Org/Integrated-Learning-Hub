const fs = require('fs');
const file = 'src/components/admin/MorningDutiesBoard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update MorningDutyLog interface
content = content.replace(
    /status: 'todo' \| 'submitted' \| 'missing' \| 'absent' \| 'late' \| 'exempted';/g,
    "status: 'todo' | 'submitted' | 'missing' | 'absent' | 'late' | 'exempted';"
).replace(
    /status: 'todo' \| 'submitted' \| 'missing' \| 'absent' \| 'late';/g,
    "status: 'todo' | 'submitted' | 'missing' | 'absent' | 'late' | 'exempted';"
);

// Add state for exemption
const stateInjection = `    const [missingItems, setMissingItems] = useState<Record<string, string[]>>({});
    const [homeworkOptions, setHomeworkOptions] = useState<Record<string, string[]>>(DEFAULT_SUB_OPTIONS);
    const [isSetupMode, setIsSetupMode] = useState(false);

    // Exemption Flow State
    const [showExemptionModal, setShowExemptionModal] = useState(false);
    const [exemptionReasons, setExemptionReasons] = useState<string[]>([]);
    const [selectedExemptionReason, setSelectedExemptionReason] = useState<string>('');
    const [newReason, setNewReason] = useState<string>('');`;

content = content.replace(
    /    const \[missingItems, setMissingItems\] = useState<Record<string, string\[\]>>\(\{\}\);\n    const \[homeworkOptions, setHomeworkOptions\] = useState<Record<string, string\[\]>>\(DEFAULT_SUB_OPTIONS\);\n    const \[isSetupMode, setIsSetupMode\] = useState\(false\);/,
    stateInjection
);

// Add fetchExemptionReasons to useEffect
const fetchInject = `    useEffect(() => {
        fetchLogs();
        fetchHomeworkOptions();
        fetchExemptionReasons();
    }, [activeClass, refreshTrigger]);

    const fetchExemptionReasons = async () => {
        const { data } = await supabase
            .from('app_content')
            .select('content')
            .eq('key', 'exemption_reasons')
            .single();
        if (data?.content && Array.isArray(data.content)) {
            setExemptionReasons(data.content);
        } else {
            setExemptionReasons(["做班務", "去洗手間", "見老師", "早退"]);
        }
    };`;

content = content.replace(
    /    useEffect\(\(\) => {\n        fetchLogs\(\);\n        fetchHomeworkOptions\(\);\n    }, \[activeClass, refreshTrigger\]\);/,
    fetchInject
);

// Add addReason function
const addReasonInject = `    const handleAddReason = async () => {
        if (!newReason.trim()) return;
        const updated = [...exemptionReasons, newReason.trim()];
        setExemptionReasons(updated);
        setSelectedExemptionReason(newReason.trim());
        setNewReason('');
        await supabase.from('app_content').upsert({
            key: 'exemption_reasons',
            content: updated,
            description: 'Default reasons for morning duty exemption'
        });
    };

    const processExemption = async (isExempted: boolean, reason?: string) => {
        try {
            const { error } = await supabase.rpc('set_homework_exemption', {
                p_log_id: logs[selectedStudent!.id]?.id,
                p_is_exempted: isExempted,
                p_reason: reason || null
            });
            if (error) throw error;
            setShowExemptionModal(false);
            setShowChoiceModal(false);
            await fetchLogs();
            onStatusChange();
            showToast(isExempted ? 'Exempted successfully' : 'Exemption removed', 'success');
        } catch (e: any) {
            showToast('Failed to set exemption: ' + e.message, 'error');
        }
    };`;

content = content.replace(
    /    const handleMissingConfirm = async \(\) => {/,
    addReasonInject + '\n\n    const handleMissingConfirm = async () => {'
);

// Update Counts
const countsInject = `    const absentCount = users.filter(u => logs[u.id]?.status === 'absent').length;
    const exemptedCount = users.filter(u => logs[u.id]?.status === 'exempted').length;
    const missingTotal = users.filter(u => logs[u.id]?.status === 'missing');
    // Students who are missing BUT have confirmed handbook are treated as Done
    const handbookDoneUsers = missingTotal.filter(u => logs[u.id]?.handbook_written);
    const handbookCount = handbookDoneUsers.length;
    // Only show students in Review if they are missing AND haven't written handbook
    const missingCount = missingTotal.filter(u => !logs[u.id]?.handbook_written).length;
    // Done = submitted + absent + handbook-confirmed + exempted
    const doneCount = submittedCount + absentCount + handbookCount + exemptedCount;`;

content = content.replace(
    /    const absentCount = users\.filter\(u => logs\[u\.id\]\?\.status === 'absent'\)\.length;\n    const missingTotal = users\.filter\(u => logs\[u\.id\]\?\.status === 'missing'\);\n    \/\/ Students who are missing BUT have confirmed handbook are treated as Done\n    const handbookDoneUsers = missingTotal\.filter\(u => logs\[u\.id\]\?\.handbook_written\);\n    const handbookCount = handbookDoneUsers\.length;\n    \/\/ Only show students in Review if they are missing AND haven't written handbook\n    const missingCount = missingTotal\.filter\(u => !logs\[u\.id\]\?\.handbook_written\)\.length;\n    \/\/ Done = submitted \+ absent \+ handbook-confirmed\n    const doneCount = submittedCount \+ absentCount \+ handbookCount;/,
    countsInject
);

// Update renderCard
const renderCardInject = `    const renderCard = (user: UserWithCoins) => {
        const log = logs[user.id] || { status: 'todo' };
        const isYellow = log.status === 'missing' && log.handbook_written;
        const isExempted = log.status === 'exempted';
        
        return (
            <div
                key={user.id}
                onClick={() => handleStudentClick(user)}
                className={\`
                    relative p-2 rounded-xl border shadow-sm flex items-center gap-2 w-[120px] cursor-pointer hover:shadow-md transition-all active:scale-95
                    \${log.status === 'todo' ? 'bg-white border-slate-200' : ''}
                    \${log.status === 'submitted' ? 'bg-green-50 border-green-200 text-green-800' : ''}
                    \${log.status === 'absent' ? 'bg-slate-100 border-slate-300 text-slate-500' : ''}
                    \${log.status === 'missing' && !isYellow ? 'bg-red-50 border-red-200 text-red-800' : ''}
                    \${isYellow ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : ''}
                    \${isExempted ? 'bg-blue-50 border-blue-300 text-blue-800' : ''}
                \`}
            >
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate leading-tight">
                        {user.display_name}({user.class_number || '-'})
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-tight opacity-70">
                        {log.status === 'missing' ? (isYellow ? 'Handbook' : 'Missing') : isExempted ? 'Exempted' : log.status}
                    </p>
                </div>
                {isExempted && (
                   <div className="absolute -top-2 -right-2 bg-blue-400 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                       豁免
                   </div>
                )}
            </div>
        );
    };`;

content = content.replace(
    /    const renderCard = \(user: UserWithCoins\) => {[\s\S]*?    };/,
    renderCardInject
);

// Update Done Column rendering
const doneColumnInject = `                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-2">
                            {/* submitted, absent, exempted, AND missing+handbook_written all count as Done */}
                            {users.filter(u =>
                                logs[u.id]?.status === 'submitted' ||
                                logs[u.id]?.status === 'absent' ||
                                logs[u.id]?.status === 'exempted' ||
                                (logs[u.id]?.status === 'missing' && logs[u.id]?.handbook_written)
                            ).map(renderCard)}
                        </div>`;

content = content.replace(
    /                        <div className="flex flex-col gap-2 overflow-y-auto max-h-\[360px\] pr-2\">\n                            {\/\* submitted, absent, AND missing\+handbook_written all count as Done \*\/}\n                            {users\.filter\(u =>\n                                logs\[u\.id\]\?\.status === 'submitted' \|\|\n                                logs\[u\.id\]\?\.status === 'absent' \|\|\n                                \(logs\[u\.id\]\?\.status === 'missing' && logs\[u\.id\]\?\.handbook_written\)\n                            \)\.map\(renderCard\)}\n                        <\/div>/,
    doneColumnInject
);

// Update ShowChoiceModal to include Exemption button
const choiceModalInject = `                            <button onClick={() => selectChoice('absent')} className="p-4 bg-slate-100 text-slate-600 rounded-xl font-bold border border-slate-200 hover:bg-slate-200 flex items-center gap-3">
                                <UserX /> 缺席 (Absent)
                            </button>

                            {logs[selectedStudent.id]?.status === 'exempted' ? (
                                <button onClick={() => processExemption(false)} className="mt-2 p-4 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-200 hover:bg-blue-100 flex items-center gap-3">
                                    <AlertCircle /> 解除豁免 (Remove Exemption)
                                </button>
                            ) : (
                                <button onClick={() => setShowExemptionModal(true)} className="mt-2 p-4 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-200 hover:bg-blue-100 flex items-center gap-3">
                                    <CheckCircle2 /> 豁免 (Exempted)
                                </button>
                            )}

                            {logs[selectedStudent.id]?.status === 'missing' && !logs[selectedStudent.id]?.handbook_written && (`;

content = content.replace(
    /                            <button onClick={\(\) => selectChoice\('absent'\)} className="p-4 bg-slate-100 text-slate-600 rounded-xl font-bold border border-slate-200 hover:bg-slate-200 flex items-center gap-3">\n                                <UserX \/> 缺席 \(Absent\)\n                            <\/button>\n\n                            {logs\[selectedStudent\.id\]\?\.status === 'missing' && !logs\[selectedStudent\.id\]\?\.handbook_written && \(/,
    choiceModalInject
);

// Append Exemption Modal to MODALS
const exemptionModalInject = `            {showExemptionModal && selectedStudent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-blue-600">豁免原因 (Exemption Reason)</h2>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {exemptionReasons.map(r => (
                                <button key={r} onClick={() => setSelectedExemptionReason(r)}
                                    className={\`px-3 py-1.5 rounded-lg border text-sm transition-colors \${selectedExemptionReason === r ? 'bg-blue-100 border-blue-500 text-blue-800 font-bold' : 'bg-white border-slate-200 text-slate-600'}\`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 mb-6">
                            <input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)} className="border border-slate-200 rounded-xl p-2 flex-1 text-sm focus:outline-none focus:border-blue-400" placeholder="New reason..." />
                            <button onClick={handleAddReason} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 rounded-xl font-bold text-sm transition-colors">Add</button>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowExemptionModal(false)} className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Cancel</button>
                            <button onClick={() => processExemption(true, selectedExemptionReason)} disabled={!selectedExemptionReason} className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 transition-colors">Confirm</button>
                        </div>
                    </div>
                </div>
            )}`;

content = content.replace(
    /            {showMissingFlow && selectedStudent && \(/,
    exemptionModalInject + '\n\n            {showMissingFlow && selectedStudent && ('
);

fs.writeFileSync(file, content);
console.log('MorningDutiesBoard.tsx updated successfully');
