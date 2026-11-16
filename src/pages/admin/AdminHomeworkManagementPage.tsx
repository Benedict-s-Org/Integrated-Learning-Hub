import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { EnglishHomeworkBoard } from '@/components/admin/homework/EnglishHomeworkBoard';
import { MissingHomeworkLedger } from '@/components/admin/homework/MissingHomeworkLedger';
import AdminHomeworkRecordPage from '@/pages/AdminHomeworkRecordPage';

const TABS = [
  { id: 'missing', label: 'Missing Homework' },
  { id: 'english', label: 'English Homework Tracker' },
  { id: 'record', label: 'Homework Record' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTab(value: string | null): value is TabId {
  if (value === 'settings') return false;
  return TABS.some((tab) => tab.id === value);
}

function resolveTab(value: string | null): TabId {
  if (value === 'settings' || value === 'record') return 'record';
  if (isTab(value)) return value;
  return 'missing';
}

export default function AdminHomeworkManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get('tab'));

  const selectTab = (next: TabId) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

  return (
    <AdminLayout title="Homework Management" icon={<ClipboardList className="h-6 w-6" />}>
      <div
        className={`flex w-full min-w-0 max-w-full flex-col overflow-x-hidden p-4 md:p-8 [contain:inline-size] ${
          tab === 'missing' ? 'h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] gap-4 overflow-hidden md:h-[calc(100dvh-6rem)] md:max-h-[calc(100dvh-6rem)]' : 'space-y-6'
        }`}
      >
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 pb-3">
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

        {tab === 'missing' && (
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <MissingHomeworkLedger />
          </div>
        )}
        {tab === 'english' && <EnglishHomeworkBoard />}
        {tab === 'record' && <AdminHomeworkRecordPage embedded />}
      </div>
    </AdminLayout>
  );
}
