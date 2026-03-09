import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, Clock, BookOpen, UserCheck, Coffee, Utensils, LogOut, Loader2, Activity } from 'lucide-react';
import { getHKDayOfWeek } from '@/utils/dateUtils';

interface TimetableEntry {
    lesson_number: number;
    subject: string;
}

interface TimetableBoardProps {
    className?: string; // Target class, e.g., "3A"
}

interface CycleData {
    found: boolean;
    cycleNumber: string;
    cycleDay: string;
    title: string;
    date: string;
}

export const TimetableBoard: React.FC<TimetableBoardProps> = ({ className = '3A' }) => {
    const [cycleData, setCycleData] = useState<CycleData | null>(null);
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const dayOfWeek = getHKDayOfWeek();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Cycle Day from Notion via Edge Function
                const { data: notionRes, error: notionErr } = await supabase.functions.invoke('notion-api/get-cycle-day', {
                    body: {}
                });

                if (notionErr) {
                    console.error('Error fetching cycle data:', notionErr);
                } else {
                    setCycleData(notionRes);
                }

                // 2. Fetch Timetable Entries from Supabase
                // We need both cycle-based (Lesson 1-7) and weekday-based (Lesson 8-9)
                const cycleDayStr = notionRes?.cycleDay || '';
                const cycleIndex = cycleDayStr.includes('1') ? 1 :
                    cycleDayStr.includes('2') ? 2 :
                        cycleDayStr.includes('3') ? 3 :
                            cycleDayStr.includes('4') ? 4 :
                                cycleDayStr.includes('5') ? 5 :
                                    cycleDayStr.includes('6') ? 6 : 0;

                const weekdayIndex = dayOfWeek === 'Monday' ? 1 :
                    dayOfWeek === 'Tuesday' ? 2 :
                        dayOfWeek === 'Wednesday' ? 3 :
                            dayOfWeek === 'Thursday' ? 4 :
                                dayOfWeek === 'Friday' ? 5 : 0;

                const { data: timetableData, error: timetableErr } = await (supabase.from('class_timetables' as any) as any)
                    .select('lesson_number, subject, day_index')
                    .eq('class_name', className);

                if (timetableErr) {
                    console.error('Error fetching timetable:', timetableErr);
                } else if (timetableData) {
                    // Filter: L1-7 matching cycleIndex, L8-9 matching weekdayIndex
                    const relevantEntries = (timetableData as any[]).filter(entry => {
                        if (entry.lesson_number <= 7) return entry.day_index === cycleIndex;
                        if (entry.lesson_number >= 8) return entry.day_index === weekdayIndex;
                        return false;
                    });
                    setTimetable(relevantEntries);
                }
            } catch (err) {
                console.error('Failed to load timetable data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [className, dayOfWeek]);

    const getSubject = (lesson: number) => {
        return timetable.find(t => t.lesson_number === lesson)?.subject || '-';
    };

    if (loading) {
        return (
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center min-h-[200px]">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <p className="text-sm font-medium text-slate-500">Loading Timetable...</p>
                </div>
            </div>
        );
    }

    const isFriday = dayOfWeek === 'Friday';
    const isTueToThu = ['Tuesday', 'Wednesday', 'Thursday'].includes(dayOfWeek);

    return (
        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-3xl border border-slate-200 shadow-sm w-full max-w-4xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl shadow-inner">
                        <CalendarDays size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Timetable ({className})</h2>
                        <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">{dayOfWeek}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {cycleData?.found ? (
                        <div className="flex flex-col items-end">
                            <div className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-sm font-black shadow-md">
                                {cycleData.cycleDay}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                Cycle {cycleData.cycleNumber} • {cycleData.title.split(' ')[0]}
                            </p>
                        </div>
                    ) : (
                        <div className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold border border-slate-200">
                            No Cycle Data
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Morning Schedule (Cycle Based) */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                        <Clock size={14} className="text-blue-500" />
                        Morning Session
                    </h3>

                    <div className="space-y-2">
                        <TimeSlot time="08:10-08:25" label="英文早讀" icon={<BookOpen size={14} />} />
                        <TimeSlot time="08:25-08:45" label="班務" icon={<UserCheck size={14} />} />
                        <LessonSlot num={1} time="08:45-09:15" subject={getSubject(1)} />
                        <LessonSlot num={2} time="09:15-09:45" subject={getSubject(2)} />
                        <TimeSlot time="09:45-10:05" label="小息一" icon={<Coffee size={14} />} isRecess />
                        <LessonSlot num={3} time="10:05-10:35" subject={getSubject(3)} />
                        <LessonSlot num={4} time="10:35-11:05" subject={getSubject(4)} />
                        <TimeSlot time="11:05-11:15" label="小息二" icon={<Coffee size={14} />} isRecess />
                        <LessonSlot num={5} time="11:15-11:45" subject={getSubject(5)} />
                        <LessonSlot num={6} time="11:45-12:15" subject={getSubject(6)} />
                        <LessonSlot num={7} time="12:15-12:45" subject={getSubject(7)} />
                    </div>
                </div>

                {/* Afternoon Schedule (Weekday Based) */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                        <Utensils size={14} className="text-orange-500" />
                        Afternoon Session
                    </h3>

                    <div className="space-y-2">
                        {isFriday ? (
                            <>
                                <TimeSlot time="12:45-13:30" label="午膳及班務" icon={<Utensils size={14} />} isLunch />
                                <TimeSlot time="13:30-14:45" label="多元學習課/週會" icon={<Activity size={14} />} isSpecial />
                                <TimeSlot time="14:45-15:00" label="班務" icon={<UserCheck size={14} />} />
                                <TimeSlot time="15:00" label="放學" icon={<LogOut size={14} />} isDismissal />
                            </>
                        ) : dayOfWeek === 'Monday' ? (
                            <>
                                <TimeSlot time="12:45-13:45" label="午膳" icon={<Utensils size={14} />} isLunch />
                                <TimeSlot time="13:45-14:15" label="閱讀及班務" icon={<BookOpen size={14} />} />
                                <LessonSlot num={8} time="14:15-14:45" subject={getSubject(8)} />
                                <LessonSlot num={9} time="14:45-15:15" subject={getSubject(9)} />
                                <TimeSlot time="15:15-15:35" label="功課及班務" icon={<UserCheck size={14} />} />
                                <TimeSlot time="15:35-15:40" label="收拾及放學" icon={<LogOut size={14} />} isDismissal />
                            </>
                        ) : isTueToThu ? (
                            <>
                                <TimeSlot time="12:45-13:45" label="午膳" icon={<Utensils size={14} />} isLunch />
                                <TimeSlot time="13:45-14:00" label={dayOfWeek === 'Tuesday' ? '英文閱讀' : '廣播及班務'} icon={dayOfWeek === 'Tuesday' ? <BookOpen size={14} /> : <Activity size={14} />} />
                                <LessonSlot num={8} time="14:00-14:30" subject={getSubject(8)} />
                                <LessonSlot num={9} time="14:30-15:00" subject={getSubject(9)} />
                                <TimeSlot time="15:00-15:10" label="班務" icon={<UserCheck size={14} />} />
                                <TimeSlot time="15:10" label="放學" icon={<LogOut size={14} />} isDismissal />
                            </>
                        ) : (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-sm font-medium text-slate-400">Weekend / No school</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TimeSlot: React.FC<{
    time: string;
    label: string;
    icon?: React.ReactNode;
    isRecess?: boolean;
    isLunch?: boolean;
    isDismissal?: boolean;
    isSpecial?: boolean;
}> = ({ time, label, icon, isRecess, isLunch, isDismissal, isSpecial }) => (
    <div className={`
        flex items-center gap-3 p-2 px-3 rounded-xl border transition-all
        ${isRecess ? 'bg-yellow-50/50 border-yellow-100 text-yellow-700' :
            isLunch ? 'bg-orange-50 border-orange-100 text-orange-700 font-bold' :
                isDismissal ? 'bg-red-50 border-red-100 text-red-700 font-black' :
                    isSpecial ? 'bg-purple-50 border-purple-100 text-purple-700 font-bold' :
                        'bg-slate-50/50 border-slate-100 text-slate-600'}
    `}>
        <span className="text-[10px] font-black w-20 shrink-0 tabular-nums opacity-60">{time}</span>
        <div className="flex items-center gap-2 flex-grow min-w-0">
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="text-xs font-bold truncate">{label}</span>
        </div>
    </div>
);

const LessonSlot: React.FC<{ num: number; time: string; subject: string }> = ({ num, time, subject }) => (
    <div className="flex items-center gap-3 p-2 px-3 rounded-xl border bg-white border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
        <span className="text-[10px] font-black w-20 shrink-0 tabular-nums text-slate-400 group-hover:text-blue-400 transition-colors">{time}</span>
        <div className="flex items-center gap-2 flex-grow min-w-0">
            <span className="flex items-center justify-center w-5 h-5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg shrink-0">
                {num}
            </span>
            <span className="text-sm font-black text-slate-700 truncate">{subject}</span>
        </div>
    </div>
);
