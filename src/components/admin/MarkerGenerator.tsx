import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { ArucoMarker } from './ArucoMarker';
import { Printer, ArrowLeft } from 'lucide-react';

interface Student {
    id: string;
    username: string;
    display_name: string | null;
    class: string | null;
    class_number: number | null;
}

export function MarkerGenerator({ onBack }: { onBack: () => void }) {
    const [classes, setClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        const { data } = await supabase.from('users').select('class').not('class', 'is', null);
        if (data) {
            const uniqueClasses = Array.from(new Set(data.map((d: any) => d.class))).sort();
            setClasses(uniqueClasses as string[]);
        }
    };

    const fetchStudents = async (className: string) => {
        setLoading(true);
        try {
            const { data: users } = await supabase
                .from('users')
                .select('id, username, class, display_name, class_number')
                .eq('class', className);

            if (users) {
                const merged = users.map((u: any) => ({
                    id: u.id,
                    username: u.username,
                    display_name: u.display_name,
                    class: u.class,
                    class_number: u.class_number
                })).sort((a, b) => {
                    if (a.class_number !== null && b.class_number !== null) {
                        return a.class_number - b.class_number;
                    }
                    if (a.class_number !== null) return -1;
                    if (b.class_number !== null) return 1;
                    const nameA = a.display_name || a.username;
                    const nameB = b.display_name || b.username;
                    return nameA.localeCompare(nameB);
                });

                setStudents(merged);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
        }
        setLoading(false);
    };

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const c = e.target.value;
        setSelectedClass(c);
        if (c) {
            fetchStudents(c);
        } else {
            setStudents([]);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const getMarkerId = (student: Student, index: number) => {
        if (student.class_number !== null && student.class_number < 1000 && student.class_number >= 0) {
            return student.class_number;
        }
        return (index + 1) % 1000;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 print:p-0 print:bg-white">
            <div className="max-w-6xl mx-auto print:hidden">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600">
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-3xl font-bold text-slate-800">ArUco Marker Generator</h1>
                    </div>
                    <button
                        onClick={handlePrint}
                        disabled={students.length === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all active:scale-95"
                    >
                        <Printer size={20} /> Print Markers
                    </button>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 max-w-xl">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Class</label>
                    <select
                        value={selectedClass}
                        onChange={handleClassChange}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                        <option value="">-- Select a Class --</option>
                        {classes.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                {loading && <div className="text-center text-slate-500 py-12 font-medium">Loading students...</div>}

                {!loading && selectedClass && students.length === 0 && (
                    <div className="text-center text-slate-500 py-12 font-medium">No students found in this class.</div>
                )}
            </div>

            {/* Print Layout: One student per page (A4) */}
            {students.length > 0 && (
                <div className="flex flex-col gap-8 print:block max-w-6xl mx-auto">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                            @media print {
                                @page {
                                    size: A4;
                                    margin: 0;
                                }
                                body {
                                    background: white;
                                }
                                .student-card {
                                    height: 297mm;
                                    width: 210mm;
                                    padding: 20mm;
                                    display: flex;
                                    flex-direction: column;
                                    justify-content: space-between;
                                    align-items: center;
                                    page-break-after: always;
                                    break-after: page;
                                    border: none !important;
                                    box-shadow: none !important;
                                }
                                .marker-container {
                                    width: 150mm !important;
                                    height: 150mm !important;
                                    margin-top: 10mm;
                                }
                                .labels-layer {
                                    font-size: 5rem !important;
                                }
                                .info-container {
                                    margin-bottom: 20mm;
                                    transform: scale(1.5);
                                }
                            }
                        `}} />
                    {students.map((student, index) => {
                        const markerId = getMarkerId(student, index);
                        return (
                            <div key={student.id} className="student-card bg-white border-2 border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-between relative aspect-[1/1.4] w-full max-w-2xl mx-auto shadow-sm print:m-0 print:max-w-none">
                                {/* ArUco Marker and Labels at the Top */}
                                <div className="w-full flex flex-col items-center pt-8">
                                    <div className="marker-container w-[80%] aspect-square relative flex items-center justify-center">
                                        {/* Edge Labels for Rotation */}
                                        <div className="labels-layer absolute -top-12 left-0 right-0 text-center text-4xl font-black text-slate-300 print:text-black">A</div>
                                        <div className="labels-layer absolute -right-12 top-0 bottom-0 flex items-center text-4xl font-black text-slate-300 print:text-black transform rotate-90">B</div>
                                        <div className="labels-layer absolute -bottom-12 left-0 right-0 text-center text-4xl font-black text-slate-300 print:text-black transform rotate-180">C</div>
                                        <div className="labels-layer absolute -left-12 top-0 bottom-0 flex items-center text-4xl font-black text-slate-300 print:text-black -rotate-90">D</div>

                                        <div className="w-full h-full pointer-events-none">
                                            <ArucoMarker id={markerId} />
                                        </div>
                                    </div>
                                </div>

                                {/* Student Info at the Bottom */}
                                <div className="info-container text-center w-full pb-12">
                                    <h2 className="text-4xl font-black text-slate-800 print:text-black mb-4">
                                        {student.display_name || student.username}
                                        <div className="flex flex-col gap-2">
                                            <p className="text-xl font-bold text-slate-500 print:text-black uppercase tracking-widest">
                                                Class: {student.class || 'N/A'}
                                            </p>
                                            <p className="text-xl font-bold text-slate-500 print:text-black uppercase tracking-widest">
                                                學號: {student.class_number || 'N/A'}
                                            </p>
                                        </div>
                                    </h2>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MarkerGenerator;
