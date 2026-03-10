import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, X, Check, Save, LayoutTemplate, ListOrdered, CalendarDays, Loader2, RefreshCw, Zap, AlertTriangle, CheckCircle2, Trash2, Users, Play } from 'lucide-react';
import { SpacedRepetitionSet } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSpacedRepetition } from '../../context/SpacedRepetitionContext';

interface StudyPlanModalProps {
    onClose: () => void;
    onStartStudyPlan: (setIds: string[]) => void;
}

export function StudyPlanModal({ onClose, onStartStudyPlan }: StudyPlanModalProps) {
    const { user, isAdmin } = useAuth();
    const { sets, assignedSets, studyPlanTemplates, activeStudyPlanAssignment, createStudyPlanTemplate, fetchStudyPlansAndAssignments, fetchAllStudents, assignStudyPlan, deleteStudyPlanTemplate } = useSpacedRepetition();

    const [activeTab, setActiveTab] = useState<'planner' | 'saved'>(isAdmin ? 'planner' : 'saved');

    // Planner State
    const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
    const [planTitle, setPlanTitle] = useState<string>('');
    const [targetDate, setTargetDate] = useState<string>('');
    const [strategy, setStrategy] = useState<'balanced' | 'sequential'>('balanced');

    // Assignment State (Admin Tab 2)
    const [assigningPlanId, setAssigningPlanId] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    const [isCalculating, setIsCalculating] = useState(false);
    const [masteredCount, setMasteredCount] = useState(0);
    const [seenCount, setSeenCount] = useState(0);
    const [reviewTodayCount, setReviewTodayCount] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);

    const viewingTemplate = useMemo(() =>
        studyPlanTemplates.find(t => t.id === viewingTemplateId),
        [viewingTemplateId, studyPlanTemplates]
    );

    const allAvailableSets = [...sets, ...assignedSets].reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, [] as SpacedRepetitionSet[]);

    useEffect(() => {
        fetchStudyPlansAndAssignments();
    }, []);

    useEffect(() => {
        const loadStudents = async () => {
            if (isAdmin && activeTab === 'saved') {
                const studs = await fetchAllStudents();
                setStudents(studs);
            }
        };
        loadStudents();
    }, [isAdmin, activeTab]);

    useEffect(() => {
        if (!isAdmin) {
            setActiveTab('saved');
        }

        // Default target date to 30 days from now
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        setTargetDate(thirtyDays.toISOString().split('T')[0]);
    }, [isAdmin]);

    // Recalculate stats when selection changes
    useEffect(() => {
        async function fetchStats() {
            // If viewing assigned plan, use its sets
            const setsToCount = activeTab === 'saved'
                ? (viewingTemplate ? viewingTemplate.set_ids : activeStudyPlanAssignment?.plan?.set_ids || [])
                : selectedSetIds;

            const effectiveTargetDate = activeTab === 'saved'
                ? (viewingTemplate ? viewingTemplate.target_date : activeStudyPlanAssignment?.plan?.target_date || '')
                : targetDate;

            if (!user || setsToCount.length === 0) {
                setMasteredCount(0);
                setSeenCount(0);
                setReviewTodayCount(0);
                return;
            }
            setIsCalculating(true);
            try {
                // Determine Plan ID context
                let planContextId = 'custom';
                if (activeTab === 'saved') {
                    if (viewingTemplate) planContextId = `template_${viewingTemplate.id}`;
                    else if (activeStudyPlanAssignment) planContextId = `assignment_${activeStudyPlanAssignment.id}`;
                } else {
                    // For custom plans, hash the sets + target date to know when the context changes
                    const sortedSets = [...setsToCount].sort().join(',');
                    planContextId = `custom_${sortedSets}_${effectiveTargetDate}`;
                }

                // Get user's local "today" as YYYY-MM-DD
                const today = new Date();
                const snapshotDate = today.toLocaleDateString('en-CA'); // e.g. "2024-03-11" based on local timezone, avoiding ISO shift

                // 1. Try to fetch today's snapshot
                const { data: snapshotData, error: snapshotError } = await (supabase as any)
                    .from('spaced_repetition_daily_snapshots')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('plan_id', planContextId)
                    .eq('snapshot_date', snapshotDate)
                    .limit(1)
                    .maybeSingle();

                if (snapshotData && !snapshotError) {
                    // Use snapshot
                    setMasteredCount(snapshotData.mastered_count);
                    setSeenCount(snapshotData.unseen_count > 0 ? (snapshotData.total_count - snapshotData.unseen_count) : 0); // we store unseen, need to derive seen back
                    // Actually, let's just use the exact returned metrics
                    setSeenCount(snapshotData.total_count - snapshotData.unseen_count);
                    setReviewTodayCount(snapshotData.review_today_count);

                    // We must still calculate "total" to ensure UI has the right base. 
                    // Technically we know total from snapshotData.total_count, but total_questions is computed synchronously in useMemo anyway.
                    // So we only need to restore seen, reviewToday, mastered.
                    setIsCalculating(false);
                    return;
                }

                // 2. If no snapshot for today, calculate fresh metrics
                let calculatedMastered = 0;
                let calculatedSeen = 0;
                let calculatedReviewToday = 0;

                const { count: mastered, error: masteredError } = await (supabase as any)
                    .from('spaced_repetition_schedules')
                    .select('id, spaced_repetition_questions!inner(set_id)', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .in('spaced_repetition_questions.set_id', setsToCount)
                    .gte('ease_factor', 3.0)
                    .gte('interval_days', 21);

                if (!masteredError && mastered !== null) calculatedMastered = mastered;

                const { count: seen, error: seenError } = await (supabase as any)
                    .from('spaced_repetition_schedules')
                    .select('id, spaced_repetition_questions!inner(set_id)', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .in('spaced_repetition_questions.set_id', setsToCount);

                if (!seenError && seen !== null) calculatedSeen = seen;

                const endOfToday = new Date();
                endOfToday.setHours(23, 59, 59, 999);

                const { count: reviewToday, error: reviewError } = await (supabase as any)
                    .from('spaced_repetition_schedules')
                    .select('id, spaced_repetition_questions!inner(set_id)', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .in('spaced_repetition_questions.set_id', setsToCount)
                    .lte('next_review_date', endOfToday.toISOString());

                if (!reviewError && reviewToday !== null) calculatedReviewToday = reviewToday;

                // Sync UI state
                setMasteredCount(calculatedMastered);
                setSeenCount(calculatedSeen);
                setReviewTodayCount(calculatedReviewToday);

                // 3. We need total_count to save the snapshot
                // We'll calculate total here just for the DB upsert
                const allAvailable = [...sets, ...assignedSets];
                const totalCount = allAvailable
                    .filter(s => setsToCount.includes(s.id))
                    .reduce((sum, s) => sum + (s.total_questions || 0), 0);

                const unseenCount = Math.max(0, totalCount - calculatedSeen);

                // Save snapshot
                await (supabase as any).from('spaced_repetition_daily_snapshots').upsert({
                    user_id: user.id,
                    plan_id: planContextId,
                    snapshot_date: snapshotDate,
                    unseen_count: unseenCount,
                    review_today_count: calculatedReviewToday,
                    total_count: totalCount,
                    mastered_count: calculatedMastered,
                    computed_at: new Date().toISOString()
                }, { onConflict: 'user_id, plan_id, snapshot_date' });

            } catch (err) {
                console.error('Failed to fetch plan stats:', err);
            } finally {
                setIsCalculating(false);
            }
        }
        fetchStats();
    }, [selectedSetIds, activeTab, activeStudyPlanAssignment, user, viewingTemplate, targetDate, sets, assignedSets]);

    const toggleSet = (id: string) => {
        setSelectedSetIds(prev =>
            prev.includes(id) ? prev.filter(setId => setId !== id) : [...prev, id]
        );
    };

    // Calculation logic uses either planner state or active assignment state
    const effectiveSetIds = activeTab === 'saved'
        ? (viewingTemplate ? viewingTemplate.set_ids : activeStudyPlanAssignment?.plan?.set_ids || [])
        : selectedSetIds;

    const effectiveTargetDate = activeTab === 'saved'
        ? (viewingTemplate ? viewingTemplate.target_date : activeStudyPlanAssignment?.plan?.target_date || '')
        : targetDate;

    const effectiveStrategy = activeTab === 'saved'
        ? (viewingTemplate ? viewingTemplate.strategy : activeStudyPlanAssignment?.plan?.strategy || 'balanced')
        : strategy;

    const totalQuestionsInSelected = useMemo(() => {
        return allAvailableSets
            .filter(s => effectiveSetIds.includes(s.id))
            .reduce((sum, s) => sum + (s.total_questions || 0), 0);
    }, [effectiveSetIds, allAvailableSets]);

    // Computed metrics
    const newUnseenCount = Math.max(0, totalQuestionsInSelected - seenCount);
    const remainingQuestions = Math.max(0, totalQuestionsInSelected - masteredCount);

    const daysRemaining = useMemo(() => {
        if (!effectiveTargetDate) return 0;
        const target = new Date(effectiveTargetDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }, [effectiveTargetDate]);

    const dailyNewTarget = daysRemaining > 0 ? Math.ceil(remainingQuestions / daysRemaining) : 0;

    // Generate simulated schedule
    const simulatedSchedule = useMemo(() => {
        if (daysRemaining <= 0 || newUnseenCount === 0) return [];

        const schedule = [];
        let unseenLeftToDistribute = newUnseenCount;
        const selectedSets = allAvailableSets.filter(s => effectiveSetIds.includes(s.id));
        const dailyUnseenTarget = daysRemaining > 0 ? Math.ceil(newUnseenCount / daysRemaining) : 0;

        // Base reviews simulation starting from what's due today
        let cumulativeReviewsPool = reviewTodayCount;

        for (let i = 0; i < daysRemaining; i++) {
            const currentDayDate = new Date();
            currentDayDate.setDate(currentDayDate.getDate() + i);

            // Calculate this day's new (unseen) cards
            let dayNewCards = Math.min(dailyUnseenTarget, unseenLeftToDistribute);

            // Strategy simulation for UI text just determines which sets are studied
            let setsNamesString = "";
            if (effectiveStrategy === 'balanced') {
                setsNamesString = selectedSets.length > 2
                    ? `${selectedSets.length} sets (Balanced)`
                    : selectedSets.map(s => s.title).join(', ');
            } else {
                // Sequential approximation 
                const setsPerDay = Math.max(1, selectedSets.length / daysRemaining);
                const currentSetIndex = Math.min(Math.floor(i * setsPerDay), selectedSets.length - 1);
                setsNamesString = selectedSets[currentSetIndex]?.title || 'Various Sets';
            }

            // Estimate reviews (Reviews due today for first day, then simulated)
            let estimatedReviews = i === 0 ? reviewTodayCount : Math.floor(cumulativeReviewsPool * 0.3);

            cumulativeReviewsPool += dayNewCards;
            unseenLeftToDistribute -= dayNewCards;

            schedule.push({
                dayNumber: i + 1,
                dateStr: currentDayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                setsString: setsNamesString,
                newCards: dayNewCards,
                reviews: estimatedReviews,
                total: dayNewCards + estimatedReviews
            });
        }
        return schedule;
    }, [daysRemaining, remainingQuestions, dailyNewTarget, effectiveStrategy, allAvailableSets, effectiveSetIds, newUnseenCount, reviewTodayCount]);

    const handleSaveTemplate = async () => {
        if (!isAdmin || selectedSetIds.length === 0 || daysRemaining <= 0 || !planTitle.trim()) return;
        setIsSaving(true);
        const success = await createStudyPlanTemplate(planTitle, selectedSetIds, new Date(targetDate).toISOString(), strategy);
        setIsSaving(false);
        if (success) {
            setPlanTitle('');
            setSelectedSetIds([]);
            setActiveTab('saved');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        await deleteStudyPlanTemplate(id);
    };

    const handleAssignPlan = async () => {
        if (!assigningPlanId || selectedStudentIds.length === 0) return;
        setIsAssigning(true);
        const success = await assignStudyPlan(assigningPlanId, selectedStudentIds);
        setIsAssigning(false);
        if (success) {
            setAssigningPlanId(null);
            setSelectedStudentIds([]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
            <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 font-display">Study Schedule Planner</h2>
                            <p className="text-sm text-gray-500">
                                {activeTab === 'saved' && !isAdmin ? 'Your assigned study plan' : 'Set a mastery date and we will build your schedule'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
                    {/* Tabs */}
                    {isAdmin && (
                        <div className="flex border-b border-gray-200 bg-white px-6 shrink-0">
                            <button
                                onClick={() => setActiveTab('planner')}
                                className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'planner'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } flex items-center gap-2`}
                            >
                                <LayoutTemplate className="w-4 h-4" />
                                Create Template
                            </button>
                            <button
                                onClick={() => setActiveTab('saved')}
                                className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'saved'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } flex items-center gap-2`}
                            >
                                <Save className="w-4 h-4" />
                                View & Assign Plans
                            </button>
                        </div>
                    )}

                    <div className="flex-1 p-6">
                        <div className="max-w-3xl mx-auto space-y-8">

                            {/* --- PLANNER TAB --- */}
                            {activeTab === 'planner' && isAdmin && (
                                <>
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">1</span>
                                            Template Setup
                                        </h3>

                                        <div className="mb-6">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Plan Name</label>
                                            <input
                                                type="text"
                                                value={planTitle}
                                                onChange={(e) => setPlanTitle(e.target.value)}
                                                placeholder="e.g. Primary 4 Math Finals Prep"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                            />
                                        </div>

                                        {allAvailableSets.length === 0 ? (
                                            <p className="text-sm text-gray-500 italic">No sets available. Create sets before generating a plan.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                                                {allAvailableSets.map(set => {
                                                    const isSelected = selectedSetIds.includes(set.id);
                                                    return (
                                                        <button
                                                            key={set.id}
                                                            onClick={() => toggleSet(set.id)}
                                                            className={`flex items-start text-left p-3 rounded-xl border-2 transition-all ${isSelected
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-100 bg-white hover:border-blue-200'
                                                                }`}
                                                        >
                                                            <div className={`p-1 rounded-full mr-3 flex-shrink-0 mt-0.5 ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-transparent'}`}>
                                                                <Check className="w-3 h-3" />
                                                            </div>
                                                            <div>
                                                                <p className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>{set.title}</p>
                                                                <p className="text-xs text-gray-500 mt-0.5">{set.total_questions} total cards</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 2: Target & Strategy */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">2</span>
                                            Configuration
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Mastery Target Date</label>
                                                <input
                                                    type="date"
                                                    value={targetDate}
                                                    onChange={(e) => setTargetDate(e.target.value)}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-70 disabled:bg-gray-50"
                                                />
                                                <p className="text-xs text-gray-500 mt-2">
                                                    {daysRemaining > 0
                                                        ? `${daysRemaining} days remaining from today.`
                                                        : 'Please select a future date.'}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Study Strategy</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => setStrategy('balanced')}
                                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${strategy === 'balanced'
                                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                            : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200'
                                                            } disabled:opacity-70`}
                                                    >
                                                        <LayoutTemplate className="w-5 h-5 mb-1" />
                                                        <span className="text-xs font-bold">Balanced</span>
                                                        <span className="text-[10px] mt-0.5 text-center px-1 font-medium opacity-80">All sets daily</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setStrategy('sequential')}
                                                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${strategy === 'sequential'
                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                            : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-200'
                                                            } disabled:opacity-70`}
                                                    >
                                                        <ListOrdered className="w-5 h-5 mb-1" />
                                                        <span className="text-xs font-bold">Sequential</span>
                                                        <span className="text-[10px] mt-0.5 text-center px-1 font-medium opacity-80">One set at a time</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3: Visualization */}
                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">3</span>
                                                    Schedule Snapshot
                                                </h3>
                                                {isCalculating && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                                    <p className="text-xs text-gray-500 font-medium whitespace-nowrap">Total Cards</p>
                                                    <p className="text-xl font-bold text-gray-900 mt-1">{totalQuestionsInSelected}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                                    <p className="text-xs text-gray-500 font-medium whitespace-nowrap">New (Unseen)</p>
                                                    <p className="text-xl font-bold text-blue-600 mt-1">{newUnseenCount}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                                    <p className="text-xs text-gray-500 font-medium whitespace-nowrap">Remaining/Mastered</p>
                                                    <p className="text-xl font-bold text-gray-900 mt-1">{remainingQuestions} <span className="text-sm font-medium text-green-600">/ {masteredCount}</span></p>
                                                </div>
                                                <div className="bg-blue-600 p-3 rounded-xl border border-blue-700 shadow-sm text-white relative overflow-hidden">
                                                    <p className="text-xs text-blue-200 font-medium whitespace-nowrap relative z-10">Review Today</p>
                                                    <p className="text-2xl font-black mt-1 relative z-10">{reviewTodayCount}</p>
                                                    <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-2 translate-y-2">
                                                        <Zap className="w-12 h-12" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto max-h-[400px]">
                                            {selectedSetIds.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                                                    <CalendarDays className="w-12 h-12 opacity-20 mb-3" />
                                                    <p>Select sets to generate your schedule.</p>
                                                </div>
                                            ) : daysRemaining <= 0 ? (
                                                <div className="p-12 text-center text-amber-600 flex flex-col items-center">
                                                    <AlertTriangle className="w-12 h-12 opacity-40 mb-3" />
                                                    <p>Please select a valid future date to see your schedule.</p>
                                                </div>
                                            ) : remainingQuestions === 0 && newUnseenCount === 0 && reviewTodayCount === 0 ? (
                                                <div className="p-12 text-center text-green-600 flex flex-col items-center">
                                                    <CheckCircle2 className="w-12 h-12 opacity-60 mb-3" />
                                                    <p className="font-bold text-lg">You've mastered all cards in these sets!</p>
                                                    <p className="text-sm mt-1">No new cards to study. Choose other sets to continue.</p>
                                                </div>
                                            ) : (
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 z-10 shadow-sm">
                                                        <tr>
                                                            <th className="px-6 py-4 font-bold text-gray-600">Date</th>
                                                            <th className="px-6 py-4 font-bold text-gray-600">Focus Sets</th>
                                                            <th className="px-6 py-4 font-bold text-gray-600">New (Unseen)</th>
                                                            <th className="px-6 py-4 font-bold text-gray-600 text-purple-600">Review Due</th>
                                                            <th className="px-6 py-4 font-bold text-gray-900 border-l border-gray-200 bg-gray-100">Total Load</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {simulatedSchedule.map((day, idx) => (
                                                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                                                <td className="px-6 py-4">
                                                                    <div className="font-semibold text-gray-900">{day.dateStr}</div>
                                                                    <div className="text-[10px] text-gray-400 font-medium uppercase mt-0.5 tracking-wider">Day {day.dayNumber}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={day.setsString}>{day.setsString}</td>
                                                                <td className="px-6 py-4">
                                                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-bold">
                                                                        +{day.newCards}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-purple-600 font-medium">{day.reviews} {idx === 0 && <span className="text-xs opacity-60">(Actual)</span>}</td>
                                                                <td className="px-6 py-4 border-l border-gray-100 bg-gray-50/30">
                                                                    <span className="font-black text-gray-900">{day.total}</span> cards
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* --- SAVED / ASSIGNED TAB --- */}
                            {activeTab === 'saved' && (
                                <>
                                    {isAdmin ? (
                                        // Admin View: Manage Templates & Assign
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xl font-bold border-b border-gray-200 pb-2 flex items-center gap-2">
                                                    <LayoutTemplate className="w-5 h-5 text-blue-600" />
                                                    Saved Plan Templates
                                                </h3>
                                            </div>

                                            {studyPlanTemplates.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
                                                    <LayoutTemplate className="w-12 h-12 opacity-20 mb-3 mx-auto" />
                                                    <p>No study plan templates created yet.</p>
                                                </div>
                                            ) : (
                                                <div className="grid gap-4">
                                                    {studyPlanTemplates.map(template => (
                                                        <div key={template.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div>
                                                                <h4 className="font-bold text-lg text-gray-900">{template.title}</h4>
                                                                <p className="text-sm text-gray-500 mt-1">
                                                                    {template.set_ids.length} Sets • Target: {new Date(template.target_date).toLocaleDateString()} • {template.strategy}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => setViewingTemplateId(viewingTemplateId === template.id ? null : template.id)}
                                                                    className={`px-4 py-2 border font-semibold rounded-lg transition-colors flex items-center gap-2 ${viewingTemplateId === template.id
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                                                                        }`}
                                                                >
                                                                    <LayoutTemplate className="w-4 h-4" /> {viewingTemplateId === template.id ? 'Hide Details' : 'Details'}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        onStartStudyPlan(template.set_ids);
                                                                        onClose();
                                                                    }}
                                                                    className="px-4 py-2 bg-green-50 text-green-700 font-semibold rounded-lg hover:bg-green-100 transition-colors flex items-center gap-2"
                                                                    title="Practice this plan"
                                                                >
                                                                    <Play className="w-4 h-4" /> Practice
                                                                </button>
                                                                <button
                                                                    onClick={() => setAssigningPlanId(template.id)}
                                                                    className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                                                                >
                                                                    <Users className="w-4 h-4" /> Assign
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTemplate(template.id)}
                                                                    className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 font-semibold rounded-lg transition-colors flex items-center"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            {/* Inline Template Details View */}
                                                            {viewingTemplateId === template.id && (
                                                                <div className="w-full mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                    <div className="mb-4">
                                                                        <h5 className="font-bold text-sm text-gray-700 mb-2">Included Question Sets:</h5>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {allAvailableSets
                                                                                .filter(s => template.set_ids.includes(s.id))
                                                                                .map(s => (
                                                                                    <span key={s.id} className="px-2 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                                                                                        {s.title} ({s.total_questions} cards)
                                                                                    </span>
                                                                                ))
                                                                            }
                                                                        </div>
                                                                    </div>

                                                                    {/* Reuse Step 3 Snapshot Visualization */}
                                                                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                                                        <div className="p-4 border-b border-gray-200">
                                                                            <h5 className="font-bold text-sm text-gray-800">Plan Projection</h5>
                                                                        </div>
                                                                        <div className="grid grid-cols-3 gap-2 p-3">
                                                                            <div className="bg-white p-2 rounded-lg border border-gray-100">
                                                                                <p className="text-[10px] text-gray-500 font-bold uppercase">New (Unseen)</p>
                                                                                <p className="text-sm font-black text-blue-600">{newUnseenCount}/{totalQuestionsInSelected}</p>
                                                                            </div>
                                                                            <div className="bg-white p-2 rounded-lg border border-gray-100">
                                                                                <p className="text-[10px] text-gray-500 font-bold uppercase">Days Left</p>
                                                                                <p className="text-sm font-black text-gray-700">{daysRemaining}</p>
                                                                            </div>
                                                                            <div className="bg-blue-600 p-2 rounded-lg text-white">
                                                                                <p className="text-[10px] text-blue-200 font-bold uppercase">Review Today</p>
                                                                                <p className="text-sm font-black">{reviewTodayCount}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="max-h-40 overflow-y-auto overflow-x-hidden p-3 pt-0">
                                                                            <table className="w-full text-[10px] text-left">
                                                                                <thead className="bg-gray-100 sticky top-0">
                                                                                    <tr>
                                                                                        <th className="p-1 px-2 font-bold text-gray-600">Date</th>
                                                                                        <th className="p-1 px-2 font-bold text-gray-600">Unseen</th>
                                                                                        <th className="p-1 px-2 font-bold text-purple-600">Review</th>
                                                                                        <th className="p-1 px-2 font-bold text-gray-900">Total</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100">
                                                                                    {simulatedSchedule.slice(0, 14).map((day, idx) => (
                                                                                        <tr key={idx}>
                                                                                            <td className="p-1 px-2 text-gray-600">{day.dateStr}</td>
                                                                                            <td className="p-1 px-2 font-bold text-blue-600">+{day.newCards}</td>
                                                                                            <td className="p-1 px-2 font-medium text-purple-600">{day.reviews}</td>
                                                                                            <td className="p-1 px-2 font-black text-gray-900">{day.total}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                    {simulatedSchedule.length > 14 && (
                                                                                        <tr>
                                                                                            <td colSpan={3} className="p-1 px-2 text-center text-gray-400 italic">... and {simulatedSchedule.length - 14} more days</td>
                                                                                        </tr>
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Inline Assignment UI */}
                                                            {assigningPlanId === template.id && (
                                                                <div className="w-full mt-4 pt-4 border-t border-gray-100 shrink-0">
                                                                    <h5 className="font-semibold text-sm mb-3">Assign to Students</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto mb-4 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                                        {students.map(student => (
                                                                            <label key={student.id} className="flex items-center gap-2 p-2 hover:bg-white rounded border border-transparent hover:border-gray-200 cursor-pointer transition-colors">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedStudentIds.includes(student.id)}
                                                                                    onChange={(e) => {
                                                                                        if (e.target.checked) setSelectedStudentIds(prev => [...prev, student.id]);
                                                                                        else setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                                                                                    }}
                                                                                    className="rounded text-blue-600"
                                                                                />
                                                                                <span className="text-sm font-medium">{student.display_name || student.username}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                    <div className="flex justify-end gap-2">
                                                                        <button onClick={() => { setAssigningPlanId(null); setSelectedStudentIds([]); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                                                        <button
                                                                            disabled={selectedStudentIds.length === 0 || isAssigning}
                                                                            onClick={handleAssignPlan}
                                                                            className="px-4 py-1.5 text-sm bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50"
                                                                        >
                                                                            {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // Student View: My Active Plan
                                        <div className="space-y-6">
                                            <h3 className="text-xl font-bold border-b border-gray-200 pb-2 flex items-center gap-2">
                                                <CalendarDays className="w-5 h-5 text-blue-600" />
                                                My Active Study Plan
                                            </h3>

                                            {!activeStudyPlanAssignment || !activeStudyPlanAssignment.plan ? (
                                                <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
                                                    <CheckCircle2 className="w-12 h-12 opacity-20 mb-3 mx-auto text-green-500" />
                                                    <p className="font-bold text-lg text-gray-700">You don't have an active study plan.</p>
                                                    <p className="text-sm mt-1">Your teacher will assign a plan to you when it's time!</p>
                                                </div>
                                            ) : (
                                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>
                                                    <div className="relative z-10">
                                                        <h4 className="font-black text-2xl text-gray-900 mb-2">{activeStudyPlanAssignment.plan.title}</h4>

                                                        <div className="flex flex-wrap gap-4 mb-4">
                                                            <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Target Date</p>
                                                                <p className="font-bold text-gray-900">{new Date(activeStudyPlanAssignment.plan.target_date).toLocaleDateString()}</p>
                                                            </div>
                                                            <div className="bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                                                                <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">Strategy</p>
                                                                <p className="font-bold text-gray-900 capitalize">{activeStudyPlanAssignment.plan.strategy}</p>
                                                            </div>
                                                        </div>

                                                        <div className="mb-6">
                                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Question Sets</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {allAvailableSets
                                                                    .filter(s => activeStudyPlanAssignment.plan!.set_ids.includes(s.id))
                                                                    .map(s => (
                                                                        <div key={s.id} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                                            {s.title}
                                                                        </div>
                                                                    ))
                                                                }
                                                            </div>
                                                        </div>

                                                        {/* Re-using the Visualization logic created earlier since it reacts to effectiveSetIds */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 mb-8 border-t border-gray-100 pt-6">
                                                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm">
                                                                <p className="text-xs text-gray-500 font-medium whitespace-nowrap">Total Cards</p>
                                                                <p className="text-xl font-bold text-gray-900 mt-1">{totalQuestionsInSelected}</p>
                                                            </div>
                                                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm">
                                                                <p className="text-xs text-gray-500 font-medium whitespace-nowrap">New (Unseen)</p>
                                                                <p className="text-xl font-bold text-blue-600 mt-1">{newUnseenCount}</p>
                                                            </div>
                                                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm">
                                                                <p className="text-xs text-gray-500 font-medium whitespace-nowrap">Remaining/Mastered</p>
                                                                <p className="text-xl font-bold text-gray-900 mt-1">{remainingQuestions} <span className="text-sm font-medium text-green-600">/ {masteredCount}</span></p>
                                                            </div>
                                                            <div className="bg-blue-600 p-3 rounded-xl border border-blue-700 shadow-sm text-white relative overflow-hidden">
                                                                <p className="text-xs text-blue-200 font-medium whitespace-nowrap relative z-10">Review Today</p>
                                                                <p className="text-2xl font-black mt-1 relative z-10">{reviewTodayCount}</p>
                                                                <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-2 translate-y-2">
                                                                    <Zap className="w-12 h-12" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => {
                                                                onStartStudyPlan(activeStudyPlanAssignment.plan!.set_ids);
                                                                onClose();
                                                            }}
                                                            disabled={remainingQuestions === 0 && newUnseenCount === 0 && reviewTodayCount === 0}
                                                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-black text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                                                        >
                                                            <Play className="w-6 h-6" />
                                                            {remainingQuestions === 0 && newUnseenCount === 0 && reviewTodayCount === 0 ? 'Plan Mastered!' : "Start Today's Session"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer actions */}
                    {activeTab === 'planner' && isAdmin && (
                        <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
                            <p className="text-xs text-gray-500 font-medium italic">
                                {daysRemaining > 0 && selectedSetIds.length > 0 && remainingQuestions > 0 ? (
                                    "Template will dynamically adjust daily targets for assigned students."
                                ) : ""}
                            </p>
                            <button
                                onClick={handleSaveTemplate}
                                disabled={isSaving || selectedSetIds.length === 0 || daysRemaining <= 0 || !planTitle.trim()}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Template
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
