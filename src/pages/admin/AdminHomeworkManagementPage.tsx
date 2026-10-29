import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { EnglishHomeworkBoard } from '@/components/admin/homework/EnglishHomeworkBoard';
import { MissingHomeworkLedger } from '@/components/admin/homework/MissingHomeworkLedger';
import AdminHomeworkRecordPage from '@/pages/AdminHomeworkRecordPage';

const TABS = [
  { id: 'missing', label: 'Missing records' },
  { id: 'english', label: 'English homework' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTab(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export default function AdminHomeworkManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: TabId = isTab(requested) ? requested : 'missing';

  const selectTab = (next: TabId) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

  return (
    <AdminLayout title="Homework Management" icon={<ClipboardList className="h-6 w-6" />}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`rounded-xl px-4 py-2 text-sm font-black ${tab === item.id ? 'bg-slate-800 text-white' : 'border-2 border-slate-200 bg-white text-slate-500'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'missing' && <MissingHomeworkLedger />}
        {tab === 'english' && <EnglishHomeworkBoard />}
        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-black text-slate-800">Homework settings</h2>
              <p className="mt-1 text-sm text-slate-500">
                The record form below is the previous homework record page. Use it to log a homework problem and award coins.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                <a className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700" href="/admin/homework-habit">Habit Tracker</a>
                <a className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700" href="/admin/homework-summary">Homework Summary</a>
                <a className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700" href="/admin/english-homework">Legacy English Tracker</a>
                <a className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700" href="/admin/homework-makeup">Missing Homework Makeup</a>
              </div>
            </div>
            <AdminHomeworkRecordPage embedded />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
