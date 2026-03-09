// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CalendarDays, Save, RefreshCw, BookOpen, UserCheck, Coffee, Utensils, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type TimetableData = Record<string, string>; // key: "lessonNum_dayIndex"

export default function AdminTimetablePage() {
    const [classes, setClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('3A');
    const [timetable, setTimetable] = useState<TimetableData>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchTimetable();
        }
    }, [selectedClass]);

    const fetchClasses = async () => {
        const { data } = await (supabase.from('users' as any) as any).select('class').not('class', 'is', null);
        if (data) {
            const uniqueClasses = Array.from(new Set(data.map((d: any) => d.class))).sort();
            setClasses(uniqueClasses as string[]);
            if (uniqueClasses.includes('3A')) {
                setSelectedClass('3A');
            } else if (uniqueClasses.length > 0) {
                setSelectedClass(uniqueClasses[0] as string);
            }
        }
    };

    const fetchTimetable = async () => {
        setIsLoading(true);
        const { data, error } = await (supabase.from('class_timetables' as any) as any)
            .select('*')
            .eq('class_name', selectedClass);

        if (error) {
            console.error(error);
            setIsLoading(false);
            return;
        }

        const newTimetable: TimetableData = {};
        if (data) {
            data.forEach((row: any) => {
                newTimetable[`${row.lesson_number}_${row.day_index}`] = row.subject;
            });
        }
        setTimetable(newTimetable);
        setIsLoading(false);
    };

    const handleChange = (lessonNum: number, dayIndex: number, value: string) => {
        setTimetable(prev => ({
            ...prev,
            [`${lessonNum}_${dayIndex}`]: value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const upsertData = Object.entries(timetable)
            .filter(([_, subject]) => subject?.trim() !== '')
            .map(([key, subject]) => {
                const [lessonNum, dayIndex] = key.split('_').map(Number);
                return {
                    class_name: selectedClass,
                    lesson_number: lessonNum,
                    day_index: dayIndex,
                    subject: subject.trim()
                };
            });

        // We should also handle deletions if a field was cleared, but for now simple upsert is safer.
        // To handle deletions properly, we'd need to know which ones were cleared.

        const { error } = await (supabase.from('class_timetables' as any) as any)
            .upsert(upsertData, { onConflict: 'class_name, lesson_number, day_index' });

        if (error) {
            alert('Error saving timetable: ' + error.message);
        } else {
            alert('Timetable saved successfully!');
            fetchTimetable();
        }
        setIsSaving(false);
    };

    const renderHeader = (days: string[]) => (
        <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider w-32 border-r border-slate-200">Time / Period</th>
                {days.map((day, i) => (
                    <th key={i} className="px-4 py-3 text-center text-xs font-black text-slate-600 uppercase tracking-wider border-r border-slate-200">
                        {day}
                    </th>
                ))}
            </tr>
        </thead>
    );

    const renderRoutineRow = (time: string, label: string, icon: React.ReactNode, colSpan: number, className = "bg-slate-50/50") => (
        <tr className={`border-b border-slate-100 ${className}`}>
            <td className="px-4 py-2 border-r border-slate-200 bg-slate-50">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 tabular-nums">{time}</span>
                </div>
            </td>
            <td colSpan={colSpan} className="px-4 py-2 text-center border-r border-slate-200">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                    {icon}
                    <span>{label}</span>
                </div>
            </td>
        </tr>
    );

    const LessonRow = ({ num, time, daysCount }: { num: number, time: string, daysCount: number }) => (
        <tr className="border-b border-slate-200 hover:bg-blue-50/30 transition-colors">
            <td className="px-4 py-2 border-r border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg shrink-0">
                        {num}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 tabular-nums">{time}</span>
                </div>
            </td>
            {Array.from({ length: daysCount }).map((_, i) => {
                const dayIdx = i + 1;
                return (
                    <td key={dayIdx} className="p-0 border-r border-slate-200">
                        <input
                            type="text"
                            value={timetable[`${num}_${dayIdx}`] || ''}
                            onChange={(e) => handleChange(num, dayIdx, e.target.value)}
                            placeholder="-"
                            className="w-full px-3 py-3 text-sm font-black text-slate-700 bg-transparent border-none outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 text-center placeholder:text-slate-300"
                        />
                    </td>
                );
            })}
        </tr>
    );

    return (
        <AdminLayout title="Timetable Management" icon={<CalendarDays className="w-6 h-6" />}>
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">

                {/* Control Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                            <CalendarDays size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Timetable Grid</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Selected Class:</label>
                                <select
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border-none outline-none ring-1 ring-blue-100 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={fetchTimetable}
                            disabled={isLoading || isSaving}
                            className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading || isSaving}
                            className="flex-1 md:flex-none px-8 py-3 rounded-2xl font-black text-sm bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                        >
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'Save All Changes'}
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <RefreshCw size={40} className="text-blue-500 animate-spin" />
                        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Loading Grid...</p>
                    </div>
                ) : (
                    <div className="space-y-12 animate-in fade-in duration-700">

                        {/* Session 1: Cycle Based (L1-L7) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-2 h-8 bg-blue-500 rounded-full" />
                                <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">Morning Session (Cycle-Based)</h3>
                            </div>

                            <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl bg-white">
                                <table className="w-full border-collapse">
                                    {renderHeader(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6'])}
                                    <tbody>
                                        {renderRoutineRow("08:10-08:25", "英文早讀", <BookOpen size={14} />, 6)}
                                        {renderRoutineRow("08:25-08:45", "班務", <UserCheck size={14} />, 6, "bg-white")}
                                        <LessonRow num={1} time="08:45-09:15" daysCount={6} />
                                        <LessonRow num={2} time="09:15-09:45" daysCount={6} />
                                        {renderRoutineRow("09:45-10:05", "小息一", <Coffee size={14} />, 6, "bg-yellow-50/30")}
                                        <LessonRow num={3} time="10:05-10:35" daysCount={6} />
                                        <LessonRow num={4} time="10:35-11:05" daysCount={6} />
                                        {renderRoutineRow("11:05-11:15", "小息二", <Coffee size={14} />, 6, "bg-yellow-50/30")}
                                        <LessonRow num={5} time="11:15-11:45" daysCount={6} />
                                        <LessonRow num={6} time="11:45-12:15" daysCount={6} />
                                        <LessonRow num={7} time="12:15-12:45" daysCount={6} />
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Session 2: Weekday Based (L8-L9) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-2 h-8 bg-orange-500 rounded-full" />
                                <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">Afternoon Session (Weekday-Based)</h3>
                            </div>

                            <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl bg-white">
                                <table className="w-full border-collapse">
                                    {renderHeader(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                                    <tbody>
                                        {renderRoutineRow("12:45-13:45", "午膳 / 午間活動時段 (Mon-Thu)", <Utensils size={14} />, 5, "bg-orange-50/30")}
                                        <LessonRow num={8} time="13:45-14:45 (M) / 14:00-14:30 (T-Th)" daysCount={5} />
                                        <LessonRow num={9} time="14:30-15:00 (T-Th)" daysCount={5} />
                                        {renderRoutineRow("15:00-15:10", "班務 / 放學 (13:30 Friday)", <LogOut size={14} />, 5, "bg-red-50/30")}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* Sticky Mobile Save FAB */}
            <div className="fixed bottom-8 right-8 z-40 md:hidden">
                <button
                    onClick={handleSave}
                    disabled={isLoading || isSaving}
                    className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
                >
                    <Save size={24} />
                </button>
            </div>
        </AdminLayout>
    );
}
