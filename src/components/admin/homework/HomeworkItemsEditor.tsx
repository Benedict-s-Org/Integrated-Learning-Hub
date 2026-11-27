import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { DEFAULT_SUB_OPTIONS, SUBJECT_NAMES } from '@/constants/rewardConfig';
import { PREFERRED_DEFAULT_CLASS, pickDefaultClass } from '@/constants/classDefaults';
import { useAuth } from '@/context/AuthContext';
import {
  buildAssignments,
  detailRecord,
  parseSubjectAssignments,
  toNameMap,
  type SubjectAssignmentMap,
} from '@/lib/homework/assignments';
import { supabase } from '@/lib/supabase';
import { fetchManagedClassIds, filterClassNameList } from '@/lib/staff/managedClasses';
import { getHKTodayString, getHKTomorrowString } from '@/utils/dateUtils';
import { isArchivedClassName } from '@/utils/archiveClassExporter';

const SUBJECT_ORDER = [
  SUBJECT_NAMES.CHINESE,
  SUBJECT_NAMES.ENGLISH,
  SUBJECT_NAMES.MATH,
  SUBJECT_NAMES.GENERAL,
  SUBJECT_NAMES.OTHER,
] as const;

const MISSING_HOMEWORK_TITLE = '完成班務（欠功課）';

type DayMode = 'today' | 'tomorrow';

function mergeCatalog(raw: Record<string, string[]> | null | undefined): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...DEFAULT_SUB_OPTIONS };
  if (!raw) return merged;
  for (const [subject, items] of Object.entries(raw)) {
    if (!Array.isArray(items)) continue;
    merged[subject] = items.map((item) => String(item).trim()).filter(Boolean);
  }
  for (const subject of SUBJECT_ORDER) {
    if (!merged[subject]) merged[subject] = [];
  }
  return merged;
}

export function HomeworkItemsEditor() {
  const { user, isAdmin, session } = useAuth();
  const [catalog, setCatalog] = useState<Record<string, string[]>>(mergeCatalog(null));
  const [activeSubject, setActiveSubject] = useState<string>(SUBJECT_NAMES.ENGLISH);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogNotice, setCatalogNotice] = useState('');

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState(PREFERRED_DEFAULT_CLASS);
  const [dayMode, setDayMode] = useState<DayMode>('today');
  const [setupSelected, setSetupSelected] = useState<Record<string, string[]>>({});
  const [setupDetails, setSetupDetails] = useState<Record<string, Record<string, string>>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsNotice, setSettingsNotice] = useState('');

  const targetDate = useMemo(
    () => (dayMode === 'today' ? getHKTodayString() : getHKTomorrowString()),
    [dayMode],
  );

  const persistCatalog = useCallback(async (next: Record<string, string[]>) => {
    setIsSavingCatalog(true);
    setCatalogError('');
    setCatalogNotice('');
    try {
      const { error } = await supabase
        .from('class_rewards' as any)
        .update({ sub_options: next } as any)
        .eq('title', MISSING_HOMEWORK_TITLE);
      if (error) throw error;
      setCatalog(next);
      setCatalogNotice('Homework items saved. Class Dashboard will use the updated list.');
    } catch (err: any) {
      console.error('Failed to save homework catalog:', err);
      setCatalogError(err?.message || 'Failed to save homework items.');
      throw err;
    } finally {
      setIsSavingCatalog(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError('');
    try {
      const { data, error } = await supabase
        .from('class_rewards' as any)
        .select('sub_options')
        .eq('title', MISSING_HOMEWORK_TITLE)
        .single() as any;
      if (error) throw error;
      setCatalog(mergeCatalog(data?.sub_options));
    } catch (err: any) {
      console.error('Failed to load homework catalog:', err);
      setCatalog(mergeCatalog(null));
      setCatalogError(err?.message || 'Failed to load homework items. Showing defaults.');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const { data, error } = await (supabase
        .from('users')
        .select('class') as any);
      if (error) throw error;
      let unique = Array.from(
        new Set(
          (data || [])
            .map((row: { class?: string | null }) => row.class)
            .filter((name: string | null | undefined): name is string => !!name && !isArchivedClassName(name)),
        ),
      ).sort((a, b) => a.localeCompare(b)) as string[];

      if (!isAdmin && user?.id) {
        const managed = await fetchManagedClassIds(user.id, session?.access_token, user.class);
        unique = filterClassNameList(unique, managed, false);
      }

      setClasses(unique);
      setSelectedClass((current) => (unique.includes(current) ? current : pickDefaultClass(unique)));
    } catch (err) {
      console.error('Failed to load classes for homework settings:', err);
    }
  }, [isAdmin, session?.access_token, user?.class, user?.id]);

  const loadClassSettings = useCallback(async (className: string, date: string) => {
    if (!className) {
      setSetupSelected({});
      setSetupDetails({});
      return;
    }
    setIsLoadingSettings(true);
    setSettingsError('');
    setSettingsNotice('');
    try {
      const { data, error } = await supabase
        .from('daily_homework')
        .select('assignments')
        .eq('date', date)
        .eq('class_name', className)
        .maybeSingle();
      if (error) throw error;
      const parsed = parseSubjectAssignments(data?.assignments);
      setSetupSelected(toNameMap(parsed));
      setSetupDetails(detailRecord(parsed));
    } catch (err: any) {
      console.error('Failed to load class homework settings:', err);
      setSetupSelected({});
      setSetupDetails({});
      setSettingsError(err?.message || 'Failed to load class homework settings.');
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    void loadClasses();
  }, [loadCatalog, loadClasses]);

  useEffect(() => {
    void loadClassSettings(selectedClass, targetDate);
  }, [loadClassSettings, selectedClass, targetDate]);

  const subjectItems = catalog[activeSubject] || [];

  const handleAddItem = async () => {
    const trimmed = newItemLabel.trim();
    if (!trimmed) return;
    if (subjectItems.includes(trimmed)) {
      setCatalogError(`"${trimmed}" already exists under ${activeSubject}.`);
      return;
    }
    const next = {
      ...catalog,
      [activeSubject]: [...subjectItems, trimmed],
    };
    try {
      await persistCatalog(next);
      setNewItemLabel('');
    } catch {
      /* error already set */
    }
  };

  const handleStartEdit = (item: string) => {
    setEditingItem(item);
    setEditingValue(item);
    setCatalogError('');
    setCatalogNotice('');
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditingValue('');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const trimmed = editingValue.trim();
    if (!trimmed || trimmed === editingItem) {
      handleCancelEdit();
      return;
    }
    if (subjectItems.includes(trimmed)) {
      setCatalogError(`"${trimmed}" already exists under ${activeSubject}.`);
      return;
    }
    const next = {
      ...catalog,
      [activeSubject]: subjectItems.map((item) => (item === editingItem ? trimmed : item)),
    };
    try {
      await persistCatalog(next);
      setSetupSelected((prev) => {
        const list = prev[activeSubject] || [];
        if (!list.includes(editingItem)) return prev;
        return {
          ...prev,
          [activeSubject]: list.map((name) => (name === editingItem ? trimmed : name)),
        };
      });
      setSetupDetails((prev) => {
        const details = prev[activeSubject];
        if (!details || !(editingItem in details)) return prev;
        const { [editingItem]: detail, ...rest } = details;
        return {
          ...prev,
          [activeSubject]: { ...rest, [trimmed]: detail },
        };
      });
      handleCancelEdit();
    } catch {
      /* error already set */
    }
  };

  const handleDeleteItem = async (item: string) => {
    if (!window.confirm(`Delete homework item "${item}" from ${activeSubject}?`)) return;
    const next = {
      ...catalog,
      [activeSubject]: subjectItems.filter((name) => name !== item),
    };
    try {
      await persistCatalog(next);
      setSetupSelected((prev) => {
        const list = (prev[activeSubject] || []).filter((name) => name !== item);
        const copy = { ...prev };
        if (list.length > 0) copy[activeSubject] = list;
        else delete copy[activeSubject];
        return copy;
      });
      setSetupDetails((prev) => {
        const details = prev[activeSubject];
        if (!details || !(item in details)) return prev;
        const { [item]: _removed, ...rest } = details;
        return { ...prev, [activeSubject]: rest };
      });
      if (editingItem === item) handleCancelEdit();
    } catch {
      /* error already set */
    }
  };

  const handleToggleSetupItem = (subject: string, item: string) => {
    setSetupSelected((prev) => {
      const current = prev[subject] || [];
      const updated = current.includes(item)
        ? current.filter((name) => name !== item)
        : [...current, item];
      const next = { ...prev };
      if (updated.length > 0) next[subject] = updated;
      else delete next[subject];
      return next;
    });
    setSettingsNotice('');
  };

  const handleToggleAllSubjectItems = (subject: string) => {
    const items = catalog[subject] || [];
    setSetupSelected((prev) => {
      const current = prev[subject] || [];
      const next = { ...prev };
      if (current.length === items.length && items.length > 0) delete next[subject];
      else next[subject] = [...items];
      return next;
    });
    setSettingsNotice('');
  };

  const handleSaveClassSettings = async () => {
    if (!selectedClass) {
      setSettingsError('Select a class first.');
      return;
    }
    const total = Object.values(setupSelected).reduce((sum, items) => sum + items.length, 0);
    if (total === 0) {
      setSettingsError('Select at least one homework item before saving.');
      return;
    }

    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsNotice('');
    try {
      const assignments: SubjectAssignmentMap = buildAssignments(setupSelected, setupDetails);
      const { error } = await supabase
        .from('daily_homework')
        .upsert(
          {
            date: targetDate,
            class_name: selectedClass,
            assignments,
          },
          { onConflict: 'date,class_name' },
        );
      if (error) throw error;
      setSettingsNotice(
        `${dayMode === 'today' ? "Today's" : "Tomorrow's"} homework settings saved for class ${selectedClass}.`,
      );
    } catch (err: any) {
      console.error('Failed to save class homework settings:', err);
      setSettingsError(err?.message || 'Failed to save class homework settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const busy = isSavingCatalog || isSavingSettings;

  return (
    <div className="space-y-6" data-ui="PANEL-HOMEWORK-ITEMS">
      <div className="rounded-[28px] border-2 border-slate-100 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-800">Homework Item Catalog</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Add or rename items used by Class Dashboard homework setup and Homework Record.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            disabled={isLoadingCatalog || busy}
            data-ui="BTN-REFRESH"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:border-slate-300 disabled:opacity-50"
          >
            {isLoadingCatalog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" data-ui="TAB-HOMEWORK-SUBJECT">
          {SUBJECT_ORDER.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => {
                setActiveSubject(subject);
                handleCancelEdit();
                setNewItemLabel('');
                setCatalogError('');
                setCatalogNotice('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-black transition-all ${
                activeSubject === subject
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'border-2 border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {subject}
              <span className="ml-2 text-[10px] opacity-70">{(catalog[subject] || []).length}</span>
            </button>
          ))}
        </div>

        <form
          data-ui="FORM-HOMEWORK-ITEM"
          className="mb-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAddItem();
          }}
        >
          <input
            data-ui="FIELD-HOMEWORK-ITEM"
            type="text"
            value={newItemLabel}
            onChange={(event) => setNewItemLabel(event.target.value)}
            placeholder={`New ${activeSubject} homework item`}
            className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={busy || !newItemLabel.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Item
          </button>
        </form>

        {catalogError && (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {catalogError}
          </p>
        )}
        {catalogNotice && (
          <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
            {catalogNotice}
          </p>
        )}

        <div data-ui="LIST-HOMEWORK-ITEMS" className="space-y-2">
          {isLoadingCatalog ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading items…
            </div>
          ) : subjectItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-400">
              No homework items for {activeSubject} yet. Add the first one above.
            </div>
          ) : (
            subjectItems.map((item) => (
              <div
                key={item}
                data-ui="CARD-HOMEWORK-ITEM"
                className="flex items-center gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50/70 px-3 py-2.5"
              >
                {editingItem === item ? (
                  <>
                    <input
                      data-ui="FIELD-HOMEWORK-ITEM"
                      type="text"
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleSaveEdit();
                        }
                        if (event.key === 'Escape') handleCancelEdit();
                      }}
                      className="min-w-0 flex-1 rounded-xl border-2 border-blue-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      disabled={busy}
                      className="rounded-xl bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
                      aria-label="Save item name"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={busy}
                      data-ui="BTN-CLOSE"
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                      aria-label="Cancel edit"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate px-1 text-sm font-black text-slate-700">{item}</span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      disabled={busy}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-blue-200 hover:text-blue-600 disabled:opacity-50"
                      aria-label={`Rename ${item}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteItem(item)}
                      disabled={busy}
                      className="rounded-xl border border-rose-100 bg-white p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                      aria-label={`Delete ${item}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-[28px] border-2 border-slate-100 bg-white p-5 shadow-sm md:p-6" data-ui="PANEL-HOMEWORK-SETTINGS">
        <div className="mb-5">
          <h2 className="text-lg font-black text-slate-800">Class Dashboard Homework Settings</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Edit the homework list already set for a class (same data Class Dashboard uses for today / tomorrow).
          </p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Class</span>
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              {classes.length === 0 && <option value="">No classes available</option>}
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Day</span>
            <div className="flex gap-2">
              {([
                { id: 'today', label: 'Today' },
                { id: 'tomorrow', label: 'Tomorrow' },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDayMode(option.id)}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-black transition-all ${
                    dayMode === option.id
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'border-2 border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-bold text-slate-400">Date: {targetDate}</p>
          </div>
        </div>

        {settingsError && (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {settingsError}
          </p>
        )}
        {settingsNotice && (
          <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
            {settingsNotice}
          </p>
        )}

        {isLoadingSettings ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading class settings…
          </div>
        ) : (
          <div className="space-y-4">
            {SUBJECT_ORDER.map((subject) => {
              const items = catalog[subject] || [];
              const selectedCount = setupSelected[subject]?.length || 0;
              return (
                <div
                  key={subject}
                  data-ui="CARD-HOMEWORK-SUBJECT"
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                      <span className="h-3 w-1.5 rounded-full bg-blue-600" />
                      {subject}
                      {selectedCount > 0 && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white">
                          {selectedCount} selected
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleAllSubjectItems(subject)}
                      disabled={items.length === 0 || busy}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-40"
                    >
                      {selectedCount === items.length && items.length > 0 ? 'Clear all' : 'Select all'}
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-xs font-medium italic text-slate-400">No catalog items for this subject.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                      {items.map((item) => {
                        const isChecked = setupSelected[subject]?.includes(item) ?? false;
                        return (
                          <div
                            key={item}
                            className={`min-w-0 rounded-xl border p-1.5 ${
                              isChecked ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleSetupItem(subject, item)}
                              className={`flex w-full items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-left text-[11px] font-bold transition-all ${
                                isChecked
                                  ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">{item}</span>
                              {isChecked && <Check className="h-3 w-3 shrink-0 text-white" />}
                            </button>
                            <input
                              type="text"
                              aria-label={`Pages, chapter, or range for ${item}`}
                              placeholder="Pages or range"
                              value={setupDetails[subject]?.[item] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setSetupDetails((prev) => ({
                                  ...prev,
                                  [subject]: {
                                    ...(prev[subject] || {}),
                                    [item]: value,
                                  },
                                }));
                                if (value.trim()) {
                                  setSetupSelected((prev) => {
                                    const current = prev[subject] || [];
                                    if (current.includes(item)) return prev;
                                    return { ...prev, [subject]: [...current, item] };
                                  });
                                }
                                setSettingsNotice('');
                              }}
                              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-blue-400"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSaveClassSettings()}
            disabled={busy || isLoadingSettings || !selectedClass}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Class Settings
          </button>
        </div>
      </div>
    </div>
  );
}
