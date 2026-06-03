import { useState, useEffect } from 'react';
import {
    History,
    RotateCcw,
    Trash2,
    Search,
    Check,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Grid,
    List,
    Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { coinService } from '@/services/coinService';
import * as XLSX from 'xlsx';

// Simple native date formatter
const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);
};

// HK timezone date parts helper
const getHKDateParts = (date: Date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
    const month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
    const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);
    return { year, month, day };
};

const getDaysInMonth = (year: number, month: number): number => {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

const getHKDayOfWeek = (year: number, month: number, day: number): string => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
};

const getBroughtForwardLabel = (year: number, month: number) => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevDays = getDaysInMonth(prevYear, prevMonth);
    const date = new Date(Date.UTC(prevYear, prevMonth - 1, prevDays));
    const monthStr = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    return `Brought Forward (up to ${monthStr} ${prevDays})`;
};

const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
];

const YEARS = [2025, 2026, 2027];

type TabType = 'active' | 'reverted';

interface LogEntry {
    id: string;
    student_id: string;
    message: string;
    type: 'positive' | 'neutral' | 'negative';
    coin_amount: number;
    created_at: string;
    assigned_at: string | null;
    is_reverted: boolean;
    reverted_at: string | null;
    is_virtual: boolean;
    student: {
        display_name: string;
        username: string;
    } | null;
}

interface ProgressLogProps {
    onClose?: () => void;
    isFullPage?: boolean;
    hideHeader?: boolean;
}

export function ProgressLog({ onClose, isFullPage = false, hideHeader = false }: ProgressLogProps) {
    const [viewMode, setViewMode] = useState<'list' | 'table'>('table');
    const [activeTab, setActiveTab] = useState<TabType>('active');
    const [entries, setEntries] = useState<LogEntry[]>([]);
    
    const [students, setStudents] = useState<any[]>([]);
    const [classesList, setClassesList] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<number>(() => {
        const hkDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
        return parseInt(hkDateStr.split('-')[1], 10);
    });
    const [selectedYear, setSelectedYear] = useState<number>(() => {
        const hkDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
        return parseInt(hkDateStr.split('-')[0], 10);
    });

    const [broughtForwardBalances, setBroughtForwardBalances] = useState<Record<string, number>>({});
    const [dailyGridData, setDailyGridData] = useState<Record<number, Record<string, { change: number, entries: LogEntry[] }>>>({});
    const [runningBalances, setRunningBalances] = useState<Record<number, Record<string, number>>>({});

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerData, setDrawerData] = useState<{ student: any, dateStr: string, entries: LogEntry[] } | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load: Fetch classes
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const { data: classesData } = await supabase
                    .from('classes' as any)
                    .select('name')
                    .order('name');
                
                if (classesData && classesData.length > 0) {
                    const names = classesData.map((c: any) => c.name).filter(Boolean);
                    setClassesList(names);
                    if (names.length > 0) {
                        setSelectedClass(names[0]);
                    }
                } else {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('class')
                        .eq('role', 'user');
                    if (usersData) {
                        const names = Array.from(new Set(usersData.map((u: any) => u.class).filter(Boolean))).sort() as string[];
                        setClassesList(names);
                        if (names.length > 0) {
                            setSelectedClass(names[0]);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching classes:', err);
            }
        };
        fetchClasses();
        coinService.cleanupOldRecords();
    }, []);

    // Toggle Mode or Active/Reverted Tabs load
    useEffect(() => {
        if (viewMode === 'list') {
            fetchEntries();
        } else {
            fetchTableData();
        }
    }, [viewMode, activeTab]);

    // Filters load for table
    useEffect(() => {
        if (viewMode === 'table') {
            fetchTableData();
        }
    }, [selectedClass, selectedMonth, selectedYear]);

    const fetchEntries = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('student_records')
                .select(`
                    *,
                    student:users!student_records_student_id_fkey (
                        display_name,
                        username
                    )
                `)
                .eq('is_reverted', activeTab === 'reverted')
                .or('coin_amount.neq.0,message.ilike.%Toilet/Break%,assigned_at.not.is.null')
                .order(activeTab === 'active' ? 'created_at' : 'reverted_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setEntries(data as any || []);
        } catch (err: any) {
            console.error('Error fetching log entries:', err.message);
            setError(err.message || 'Failed to fetch log entries');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTableData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            let studentsQuery = supabase
                .from('users')
                .select('id, username, display_name, class, class_number')
                .eq('role', 'user');
            
            if (selectedClass !== 'all') {
                studentsQuery = studentsQuery.eq('class', selectedClass);
            }
            
            const { data: studentsData, error: studentsError } = await studentsQuery;
            if (studentsError) throw studentsError;
            
            const currentStudents = (studentsData || []).sort((a, b) => {
                return (a.class_number || 0) - (b.class_number || 0);
            });
            setStudents(currentStudents);
            
            if (currentStudents.length === 0) {
                setBroughtForwardBalances({});
                setDailyGridData({});
                setRunningBalances({});
                setIsLoading(false);
                return;
            }
            
            const studentIds = currentStudents.map(s => s.id);
            const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
            
            // End of selected month at 23:59:59.999 in HK timezone (UTC+8) -> 15:59:59.999 UTC
            const endOfMonthHK = new Date(Date.UTC(selectedYear, selectedMonth - 1, daysInMonth, 15, 59, 59, 999));
            const endOfMonthISO = endOfMonthHK.toISOString();
            
            const { data: records, error: recordsError } = await supabase
                .from('student_records')
                .select('*')
                .in('student_id', studentIds)
                .eq('is_reverted', false)
                .or(`created_at.lte.${endOfMonthISO},assigned_at.lte.${endOfMonthISO}`);
                
            if (recordsError) throw recordsError;
            
            const bfBalances: Record<string, number> = {};
            studentIds.forEach(id => {
                bfBalances[id] = 0;
            });
            
            const dailyGrid: Record<number, Record<string, { change: number, entries: LogEntry[] }>> = {};
            for (let d = 1; d <= daysInMonth; d++) {
                dailyGrid[d] = {};
                studentIds.forEach(id => {
                    dailyGrid[d][id] = { change: 0, entries: [] };
                });
            }
            
            (records || []).forEach((record: any) => {
                const dateVal = record.assigned_at ? new Date(record.assigned_at) : new Date(record.created_at);
                const { year: rYear, month: rMonth, day: rDay } = getHKDateParts(dateVal);
                const sId = record.student_id;
                
                if (rYear < selectedYear || (rYear === selectedYear && rMonth < selectedMonth)) {
                    bfBalances[sId] = (bfBalances[sId] || 0) + (record.coin_amount || 0);
                }
                else if (rYear === selectedYear && rMonth === selectedMonth) {
                    if (rDay >= 1 && rDay <= daysInMonth) {
                        if (!dailyGrid[rDay][sId]) {
                            dailyGrid[rDay][sId] = { change: 0, entries: [] };
                        }
                        dailyGrid[rDay][sId].change += (record.coin_amount || 0);
                        dailyGrid[rDay][sId].entries.push(record as LogEntry);
                    }
                }
            });
            
            const runBalances: Record<number, Record<string, number>> = {};
            const tempBalances = { ...bfBalances };
            
            for (let d = 1; d <= daysInMonth; d++) {
                runBalances[d] = {};
                studentIds.forEach(id => {
                    const dayChange = dailyGrid[d]?.[id]?.change || 0;
                    tempBalances[id] = (tempBalances[id] || 0) + dayChange;
                    runBalances[d][id] = tempBalances[id];
                });
            }
            
            setBroughtForwardBalances(bfBalances);
            setDailyGridData(dailyGrid);
            setRunningBalances(runBalances);
            
        } catch (err: any) {
            console.error('Error fetching table data:', err);
            setError(err.message || 'Failed to fetch table data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevert = async (id: string) => {
        if (!confirm('Are you sure you want to revert this record? Student balance will be updated.')) return;

        setIsActionLoading(true);
        const result = await coinService.revertRecord(id);
        if (result.success) {
            fetchEntries();
        } else {
            alert('Failed to revert record.');
        }
        setIsActionLoading(false);
    };

    const handleBulkRevert = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Revert ${selectedIds.length} records?`)) return;

        setIsActionLoading(true);
        const result = await coinService.bulkRevertRecords(selectedIds);
        if (result.success) {
            setSelectedIds([]);
            fetchEntries();
        } else {
            alert('Failed to revert some records.');
        }
        setIsActionLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Permanently delete this reverted record? This cannot be undone.')) return;

        setIsActionLoading(true);
        const { error } = await supabase
            .from('student_records')
            .delete()
            .eq('id', id);

        if (!error) {
            fetchEntries();
        } else {
            alert('Failed to delete record.');
        }
        setIsActionLoading(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleCellClick = (student: any, day: number, dayEntries: LogEntry[]) => {
        const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || '';
        setDrawerData({
            student,
            dateStr: `${monthName} ${day}, ${selectedYear}`,
            entries: dayEntries
        });
        setDrawerOpen(true);
    };

    const handleDrawerRevert = async (id: string) => {
        if (!confirm('Are you sure you want to revert this record? Student balance will be updated.')) return;
        
        setIsActionLoading(true);
        const result = await coinService.revertRecord(id);
        if (result.success) {
            await fetchTableData();
            if (drawerData) {
                const updatedEntries = drawerData.entries.filter(e => e.id !== id);
                if (updatedEntries.length === 0) {
                    setDrawerOpen(false);
                    setDrawerData(null);
                } else {
                    setDrawerData({
                        ...drawerData,
                        entries: updatedEntries
                    });
                }
            }
        } else {
            alert('Failed to revert record.');
        }
        setIsActionLoading(false);
    };

    const handleExportExcel = () => {
        if (filteredStudents.length === 0) {
            alert('No student records to export.');
            return;
        }
        try {
            const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
            const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth.toString();
            
            // --- Sheet 1: Daily Net Changes ---
            const changesHeaders = ['Date', ...filteredStudents.map(s => `${s.display_name} (#${s.class_number || ''})`)];
            const changesRows: any[][] = [];
            
            // Brought Forward Row
            const bfRow = [`Brought Forward (up to ${monthName})`];
            filteredStudents.forEach(s => {
                bfRow.push(broughtForwardBalances[s.id] || 0);
            });
            changesRows.push(bfRow);
            
            // Daily Rows
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${selectedMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const dayOfWeek = getHKDayOfWeek(selectedYear, selectedMonth, d);
                const row = [`${dateStr} (${dayOfWeek})`];
                filteredStudents.forEach(s => {
                    row.push(dailyGridData[d]?.[s.id]?.change || 0);
                });
                changesRows.push(row);
            }
            
            const wsChanges = XLSX.utils.aoa_to_sheet([changesHeaders, ...changesRows]);
            
            // --- Sheet 2: Daily Running Balances ---
            const runningHeaders = ['Date', ...filteredStudents.map(s => `${s.display_name} (#${s.class_number || ''})`)];
            const runningRows: any[][] = [];
            
            // Brought Forward Row
            const bfRunningRow = [`Brought Forward (up to ${monthName})`];
            filteredStudents.forEach(s => {
                bfRunningRow.push(broughtForwardBalances[s.id] || 0);
            });
            runningRows.push(bfRunningRow);
            
            // Daily Rows
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${selectedMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const dayOfWeek = getHKDayOfWeek(selectedYear, selectedMonth, d);
                const row = [`${dateStr} (${dayOfWeek})`];
                filteredStudents.forEach(s => {
                    const runBal = runningBalances[d]?.[s.id] ?? (broughtForwardBalances[s.id] || 0);
                    row.push(runBal);
                });
                runningRows.push(row);
            }
            
            const wsRunning = XLSX.utils.aoa_to_sheet([runningHeaders, ...runningRows]);
            
            // Create workbook and append sheets
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsChanges, 'Daily Net Changes');
            XLSX.utils.book_append_sheet(wb, wsRunning, 'Daily Running Balances');
            
            // Write and download file
            const filename = `Progress_Log_${selectedClass}_${selectedYear}_${selectedMonth}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (err: any) {
            console.error('Error exporting to Excel:', err);
            alert('Failed to export to Excel: ' + err.message);
        }
    };

    const filteredEntries = entries.filter(entry =>
        entry.student?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredStudents = students.filter(student =>
        (student.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.username || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

    const containerClasses = isFullPage 
        ? "flex flex-col h-full w-full bg-white relative overflow-hidden"
        : "flex flex-col max-h-[85vh] w-full bg-white relative overflow-hidden";

    return (
        <div className={containerClasses}>
            {/* Header */}
            {!hideHeader && (
                <div className={`p-8 border-b border-slate-100 flex justify-between items-center bg-white ${!isFullPage ? 'rounded-t-[2.5rem]' : ''}`}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                            <History className="text-white" size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                Progress Log
                            </h3>
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                Rewards & Consequences History
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 border border-slate-100 shadow-sm active:scale-95"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    )}
                </div>
            )}

            {/* Tabs & Search Area */}
            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5
                                ${viewMode === 'list'
                                    ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <List size={14} />
                            List View
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5
                                ${viewMode === 'table'
                                    ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <Grid size={14} />
                            Table View
                        </button>
                    </div>

                    {/* Dynamic Filters depending on mode */}
                    {viewMode === 'list' ? (
                        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`px-6 py-2 rounded-xl text-xs font-black transition-all
                                    ${activeTab === 'active'
                                        ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200'
                                        : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Active Log
                            </button>
                            <button
                                onClick={() => setActiveTab('reverted')}
                                className={`px-6 py-2 rounded-xl text-xs font-black transition-all
                                    ${activeTab === 'reverted'
                                        ? 'bg-white text-orange-600 shadow-md ring-1 ring-slate-200'
                                        : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Reverted Record
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Class Filter */}
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="all">All Classes</option>
                                {classesList.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>

                            {/* Month Filter */}
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                {MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>

                            {/* Year Filter */}
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                {YEARS.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>

                            {/* Export Excel Button */}
                            <button
                                onClick={handleExportExcel}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm shadow-green-100"
                                title="Export to Excel"
                            >
                                <Download size={14} />
                                Export Excel
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder={viewMode === 'list' ? "Search by student or record..." : "Search students by name..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>

                    {viewMode === 'list' && selectedIds.length > 0 && activeTab === 'active' && (
                        <button
                            onClick={handleBulkRevert}
                            disabled={isActionLoading}
                            className="px-6 py-3.5 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-100 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isActionLoading ? <Loader2 className="animate-spin" size={20} /> : <RotateCcw size={20} />}
                            Bulk Revert ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading records...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-4">
                        <AlertCircle size={64} strokeWidth={1} />
                        <div className="text-center">
                            <p className="font-black">DATABASE ERROR</p>
                            <p className="text-xs opacity-70 mt-1">{error}</p>
                        </div>
                        <button 
                            onClick={() => viewMode === 'list' ? fetchEntries() : fetchTableData()}
                            className="mt-2 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                ) : viewMode === 'list' ? (
                    /* Original List View */
                    filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-300 gap-4">
                            <History size={64} strokeWidth={1} />
                            <p className="font-bold italic">No records found matching your search.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredEntries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`p-4 rounded-3xl border-2 transition-all flex items-center gap-4 group
                                        ${entry.is_reverted
                                            ? 'bg-slate-50/50 border-slate-100'
                                            : selectedIds.includes(entry.id)
                                                ? 'bg-blue-50 border-blue-200 shadow-sm'
                                                : entry.type === 'neutral'
                                                    ? 'bg-slate-50/10 border-slate-100 hover:border-slate-200 hover:bg-slate-50/40'
                                                    : 'bg-white border-transparent hover:border-slate-100 hover:bg-slate-50/30'}`}
                                >
                                    {activeTab === 'active' && (
                                        <button
                                            onClick={() => toggleSelect(entry.id)}
                                            className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all
                                                ${selectedIds.includes(entry.id)
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-slate-200 group-hover:border-blue-300'}`}
                                        >
                                            {selectedIds.includes(entry.id) && <Check size={18} />}
                                        </button>
                                    )}

                                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="min-w-[140px]">
                                            <p className="font-black text-slate-800 text-lg leading-tight">
                                                {entry.student?.display_name || 'Unknown'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                {entry.assigned_at 
                                                    ? new Date(entry.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : formatDate(entry.is_reverted ? entry.reverted_at! : entry.created_at)}
                                            </p>
                                        </div>

                                        <div className="flex-1">
                                            <p className="font-bold text-slate-600 text-sm">
                                                {entry.message}
                                                {entry.is_virtual && (
                                                    <span className="ml-2 px-2 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-black uppercase rounded-lg border border-purple-100">
                                                        Virtual
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className={`min-w-[70px] text-right font-black text-xl
                                                ${entry.type === 'positive' ? 'text-green-500' : entry.type === 'neutral' ? 'text-slate-400' : 'text-red-500'}`}>
                                                {entry.coin_amount > 0 ? '+' : ''}{entry.coin_amount ?? 0}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {activeTab === 'active' ? (
                                                    <button
                                                        onClick={() => handleRevert(entry.id)}
                                                        disabled={isActionLoading}
                                                        className="p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-2xl transition-all active:scale-90"
                                                        title="Revert Record"
                                                    >
                                                        <RotateCcw size={20} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleDelete(entry.id)}
                                                        disabled={isActionLoading}
                                                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                                                        title="Delete Permanently"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    /* Table View */
                    filteredStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-300 gap-4">
                            <History size={64} strokeWidth={1} />
                            <p className="font-bold italic">No students found matching your filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-auto max-h-[calc(85vh-200px)] border border-slate-100 rounded-[2rem] shadow-inner custom-scrollbar relative">
                            <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="sticky top-0 left-0 z-30 w-[140px] bg-slate-100 border-b-2 border-r-2 border-slate-200 p-4 font-black text-xs text-slate-500 uppercase tracking-widest">
                                            Date
                                        </th>
                                        {filteredStudents.map(student => (
                                            <th key={student.id} className="sticky top-0 z-20 w-[160px] bg-slate-100 border-b-2 border-r border-slate-200 p-4 font-black text-sm text-slate-700 text-center truncate">
                                                <div>{student.display_name}</div>
                                                <div className="text-[10px] text-slate-400 font-normal tracking-wide">
                                                    #{student.class_number || 'N/A'} @{student.username}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Brought Forward Row */}
                                    <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <td className="sticky left-0 z-10 bg-slate-50 border-r-2 border-b border-slate-200 p-4 font-black text-[10px] text-slate-500 uppercase tracking-wider leading-relaxed">
                                            {getBroughtForwardLabel(selectedYear, selectedMonth)}
                                        </td>
                                        {filteredStudents.map(student => {
                                            const bfVal = broughtForwardBalances[student.id] || 0;
                                            return (
                                                <td key={student.id} className="border-b border-r border-slate-100 p-4 text-center font-black bg-slate-50/20">
                                                    <span className={`px-3 py-1 rounded-xl text-sm font-black
                                                        ${bfVal > 0 
                                                            ? 'text-green-600 bg-green-50' 
                                                            : bfVal < 0 
                                                                ? 'text-red-600 bg-red-50' 
                                                                : 'text-slate-400 bg-slate-50'}`}>
                                                        {bfVal > 0 ? '+' : ''}{bfVal}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    {/* Daily Rows */}
                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                        const day = i + 1;
                                        const dayOfWeek = getHKDayOfWeek(selectedYear, selectedMonth, day);
                                        const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
                                        return (
                                            <tr key={day} className={`hover:bg-slate-50/80 transition-colors ${isWeekend ? 'bg-slate-50/20' : ''}`}>
                                                <td className={`sticky left-0 z-10 border-r-2 border-b border-slate-200 p-4 font-bold text-sm text-slate-500 ${isWeekend ? 'bg-slate-50' : 'bg-white'}`}>
                                                    <span className={isWeekend ? 'text-slate-400' : 'text-slate-700'}>
                                                        {selectedMonth.toString().padStart(2, '0')}-{day.toString().padStart(2, '0')}
                                                    </span>
                                                    <span className={`ml-2 text-xs font-normal ${dayOfWeek === 'Sun' ? 'text-red-500' : dayOfWeek === 'Sat' ? 'text-blue-500' : 'text-slate-400'}`}>
                                                        ({dayOfWeek})
                                                    </span>
                                                </td>
                                                {filteredStudents.map(student => {
                                                    const dayData = dailyGridData[day]?.[student.id] || { change: 0, entries: [] };
                                                    const runBal = runningBalances[day]?.[student.id] ?? (broughtForwardBalances[student.id] || 0);
                                                    const hasEntries = dayData.entries.length > 0;
                                                    return (
                                                        <td 
                                                            key={student.id} 
                                                            onClick={() => hasEntries && handleCellClick(student, day, dayData.entries)}
                                                            className={`border-b border-r border-slate-100 p-3 text-center transition-all ${hasEntries ? 'cursor-pointer hover:bg-blue-50/40' : ''}`}
                                                        >
                                                            {hasEntries ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black inline-flex items-center gap-1 shadow-sm
                                                                        ${dayData.change > 0 
                                                                            ? 'bg-green-100 text-green-700 border border-green-200' 
                                                                            : dayData.change < 0 
                                                                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                                                                : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                                        {dayData.change > 0 ? '+' : ''}{dayData.change}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-bold">
                                                                        Bal: {runBal}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center min-h-[36px]">
                                                                    <span className="text-slate-200 font-bold">-</span>
                                                                    <span className="text-[9px] text-slate-300 font-normal">
                                                                        {runBal}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Side Drawer for cell records detail */}
            {drawerOpen && drawerData && (
                <div className="fixed inset-0 z-[120] flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h4 className="text-lg font-black text-slate-800">
                                    {drawerData.student.display_name}
                                </h4>
                                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                                    {drawerData.dateStr} Records
                                </p>
                            </div>
                            <button 
                                onClick={() => { setDrawerOpen(false); setDrawerData(null); }}
                                className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 border border-slate-200 shadow-sm active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        {/* List of Entries */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {drawerData.entries.map((entry) => (
                                <div key={entry.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col gap-3 group relative">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-700">
                                                {entry.message}
                                                {entry.is_virtual && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-black uppercase rounded border border-purple-100">
                                                        Virtual
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                                {new Date(entry.assigned_at || entry.created_at).toLocaleTimeString('en-US', {
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </p>
                                        </div>
                                        <div className={`font-black text-lg ${entry.coin_amount > 0 ? 'text-green-500' : entry.coin_amount < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {entry.coin_amount > 0 ? '+' : ''}{entry.coin_amount}
                                        </div>
                                    </div>

                                    <div className="flex justify-end border-t border-slate-100/60 pt-2.5">
                                        <button
                                            onClick={() => handleDrawerRevert(entry.id)}
                                            disabled={isActionLoading}
                                            className="px-3.5 py-1.5 text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <RotateCcw size={14} />
                                            Revert
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50/30 border-t border-slate-100 text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider">
                            Total change: {drawerData.entries.reduce((sum, e) => sum + e.coin_amount, 0)} coins
                        </div>
                    </div>
                </div>
            )}

            {/* Tips/Summary Footer */}
            <div className={`p-6 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest ${!isFullPage ? 'rounded-b-[2.5rem]' : ''}`}>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 grayscale opacity-50">
                        <CheckCircle2 size={14} className="text-green-500" /> Positive
                    </span>
                    <span className="flex items-center gap-1.5 grayscale opacity-50">
                        <AlertCircle size={14} className="text-red-500" /> Negative
                    </span>
                </div>
                {viewMode === 'list' && activeTab === 'reverted' && (
                    <p className="text-orange-600/60 flex items-center gap-2 italic">
                        <Loader2 size={12} className="animate-spin" /> Records older than 30 days are auto-deleted
                    </p>
                )}
                {viewMode === 'table' && (
                    <p className="text-slate-400 flex items-center gap-2 italic text-[10px]">
                        Click cells to view detailed logs and revert transactions
                    </p>
                )}
            </div>
        </div>
    );
}
