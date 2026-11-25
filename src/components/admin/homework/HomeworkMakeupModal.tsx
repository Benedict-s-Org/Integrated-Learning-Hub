import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Loader2, X } from 'lucide-react';
import { homeworkDb } from '@/lib/homework/client';
import { makeupKey, parseEnglishCheckLogId } from '@/lib/homework/missingLedger';
import {
  groupOutstandingByDate,
  type OutstandingHomeworkItem,
} from '@/lib/homework/outstandingHomework';

export type HomeworkMakeupModalProps = {
  open: boolean;
  studentId: string;
  studentName: string;
  className: string;
  items: OutstandingHomeworkItem[];
  onClose: () => void;
  onConfirmSuccess: () => void;
};

function formatListDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat('en-HK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function itemLabel(item: OutstandingHomeworkItem): string {
  return [item.subject, item.item, item.detail].filter(Boolean).join(' · ');
}

function selectionKey(item: OutstandingHomeworkItem): string {
  return makeupKey(item.logId, item.subject, item.item);
}

async function applyMakeupForItem(
  props: Pick<HomeworkMakeupModalProps, 'studentId' | 'className'>,
  item: OutstandingHomeworkItem,
): Promise<void> {
  const { error: checkError } = await homeworkDb.rpc('set_english_homework_check', {
    p_class: item.className || props.className,
    p_date: item.logDate,
    p_subject: item.subject,
    p_item: item.item,
    p_detail: item.detail,
    p_student_id: props.studentId,
    p_handed_in: true,
    p_needs_correction: false,
    p_is_complete: false,
    p_is_late: true,
  });
  if (checkError) throw checkError;

  if (parseEnglishCheckLogId(item.logId)) return;

  const { error: makeupError } = await homeworkDb.rpc('set_homework_makeup', {
    p_log_id: item.logId,
    p_subject: item.subject,
    p_item: item.item,
    p_is_made_up: true,
  });
  if (makeupError) throw makeupError;
}

export function HomeworkMakeupModal({
  open,
  studentId,
  studentName,
  className,
  items,
  onClose,
  onConfirmSuccess,
}: HomeworkMakeupModalProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const grouped = useMemo(() => groupOutstandingByDate(items), [items]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSelectedKeys(new Set(items.map(selectionKey)));
  }, [open, items]);

  if (!open) return null;

  const toggleItem = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedItems = items.filter((item) => selectedKeys.has(selectionKey(item)));
  const noneSelected = selectedItems.length === 0;

  const handleConfirm = async () => {
    if (noneSelected || isSaving) return;
    setIsSaving(true);
    setError('');

    const failures: string[] = [];
    for (const item of selectedItems) {
      try {
        await applyMakeupForItem({ studentId, className }, item);
      } catch (err) {
        console.error('Homework makeup failed for item', item, err);
        failures.push(itemLabel(item));
      }
    }

    setIsSaving(false);

    if (failures.length > 0) {
      const suffix =
        failures.length === selectedItems.length
          ? ' None of the selected items were saved.'
          : ` ${failures.length} of ${selectedItems.length} item(s) could not be saved.`;
      setError(`Could not save makeup for: ${failures.join('; ')}.${suffix}`);
      return;
    }

    onConfirmSuccess();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      data-ui="MODAL-HOMEWORK-MAKEUP"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50 p-6">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-black text-slate-800">
              <BookOpen className="text-orange-600" size={24} />
              Outstanding homework
            </h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
              {studentName} · {className}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            data-ui="BTN-CLOSE"
            className="rounded-full border border-slate-100 p-2 text-slate-400 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <p className="text-center text-sm font-semibold text-slate-400">No outstanding items.</p>
          ) : (
            <ul className="space-y-4" data-ui="LIST-HOMEWORK-OUTSTANDING">
              {grouped.map((group) => (
                <li key={group.date}>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-orange-700">
                    {formatListDate(group.date)}
                  </p>
                  <ul className="space-y-2">
                    {group.items.map((item) => {
                      const key = selectionKey(item);
                      const checked = selectedKeys.has(key);
                      const label = itemLabel(item);
                      return (
                        <li key={key}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors ${
                              checked
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600"
                              checked={checked}
                              disabled={isSaving}
                              onChange={() => toggleItem(key)}
                              aria-label={label}
                            />
                            <span className="min-w-0 text-sm font-bold leading-snug text-slate-800">
                              {label}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {noneSelected && items.length > 0 && (
            <p className="mt-4 text-center text-xs font-bold text-amber-700">No items selected</p>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-100 bg-slate-50 p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            data-ui="BTN-HOMEWORK-MAKEUP-CANCEL"
            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black uppercase tracking-widest text-slate-500 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || noneSelected || items.length === 0}
            data-ui="BTN-HOMEWORK-MAKEUP-CONFIRM"
            className="flex flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-orange-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-orange-200 transition-all hover:bg-orange-700 active:scale-95 disabled:scale-100 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Check size={18} />
            )}
            {isSaving ? 'Saving...' : `Confirm makeup (${selectedItems.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}