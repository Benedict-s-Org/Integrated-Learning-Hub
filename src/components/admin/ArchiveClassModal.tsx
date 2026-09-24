import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Archive,
  Download,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  X,
  Loader2,
  Calendar,
  Users,
  Coins
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  getAcademicYearOptions,
  AcademicYearOption,
  fetchClassArchiveData,
  exportClassArchiveToExcel,
  exportClassArchiveToJSON,
  ClassArchivePayload
} from '@/utils/archiveClassExporter';

interface ArchiveClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  onSuccess?: () => void;
}

const MIGRATION_SQL_SCRIPT = `-- Migration: Add Archive Class Feature
-- Purpose: Support class archiving, student academic year records backup, and resetting coins to 0 with balancing audit records

-- 1. Alter classes table to add columns (in case table already existed previously without them)
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS academic_year TEXT NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_classes_is_archived ON public.classes(is_archived);

-- 3. Drop legacy function signatures if any
DROP FUNCTION IF EXISTS public.archive_class(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.archive_class(TEXT, UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.unarchive_class(TEXT);

-- 3. Create archive_class RPC
CREATE OR REPLACE FUNCTION public.archive_class(
    p_class_name TEXT,
    p_archived_by UUID DEFAULT NULL,
    p_academic_year TEXT DEFAULT NULL,
    p_auto_recreate BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_operator_id UUID;
    v_user_count INT := 0;
    v_student RECORD;
    v_archive_time TIMESTAMPTZ := NOW();
    v_year_clean TEXT;
    v_base_name TEXT;
    v_archived_name TEXT;
BEGIN
    v_operator_id := COALESCE(p_archived_by, auth.uid());
    v_year_clean := TRIM(COALESCE(NULLIF(p_academic_year, ''), TO_CHAR(v_archive_time, 'YYYY') || '-' || TO_CHAR(v_archive_time + INTERVAL '1 year', 'YYYY')));

    -- Extract base class name without pre-existing year tags (e.g. "3A(2526)" or "3A (2025-2026)" -> "3A")
    v_base_name := TRIM(REGEXP_REPLACE(p_class_name, '\s*\(\d{2,4}(?:[-/]?\d{2,4})?[^)]*\)$', ''));
    IF v_base_name = '' THEN
        v_base_name := TRIM(p_class_name);
    END IF;

    -- Form the standard archived name: e.g. "3A (2526)" or "3A (2025-2026)"
    v_archived_name := v_base_name || ' (' || v_year_clean || ')';

    IF v_operator_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = v_operator_id 
          AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can archive a class';
    END IF;

    FOR v_student IN (
        SELECT 
            u.id, 
            u.display_name, 
            COALESCE(urd.coins, 0) AS current_coins, 
            COALESCE(urd.virtual_coins, 0) AS current_virtual_coins
        FROM public.users u
        LEFT JOIN public.user_room_data urd ON urd.user_id = u.id
        WHERE u.class = p_class_name OR u.class = v_archived_name
    ) LOOP
        v_user_count := v_user_count + 1;

        IF v_student.current_coins != 0 THEN
            INSERT INTO public.student_records (
                student_id,
                type,
                message,
                coin_amount,
                created_by,
                is_virtual,
                created_at
            ) VALUES (
                v_student.id,
                'neutral',
                '學年班別封存：金幣重設歸零 (' || v_year_clean || ')',
                -v_student.current_coins,
                v_operator_id,
                FALSE,
                v_archive_time
            );
        END IF;

        IF v_student.current_virtual_coins != 0 THEN
            INSERT INTO public.student_records (
                student_id,
                type,
                message,
                coin_amount,
                created_by,
                is_virtual,
                created_at
            ) VALUES (
                v_student.id,
                'neutral',
                '學年班別封存：虛擬金幣重設歸零 (' || v_year_clean || ')',
                -v_student.current_virtual_coins,
                v_operator_id,
                TRUE,
                v_archive_time
            );
        END IF;

        UPDATE public.user_room_data
        SET coins = 0,
            virtual_coins = 0,
            daily_counts = '{}'::jsonb,
            morning_status = 'todo',
            updated_at = v_archive_time
        WHERE user_id = v_student.id;
    END LOOP;

    -- Update students' class to the clean archived year name
    UPDATE public.users
    SET class = v_archived_name
    WHERE class = p_class_name OR class = v_archived_name;

    -- In classes table:
    DELETE FROM public.classes WHERE name = v_archived_name;
    IF p_class_name <> v_base_name THEN
        DELETE FROM public.classes WHERE name = p_class_name;
    END IF;

    UPDATE public.classes
    SET name = v_archived_name,
        is_archived = TRUE,
        archived_at = v_archive_time,
        academic_year = v_year_clean
    WHERE name = p_class_name OR name = v_archived_name;

    IF NOT FOUND THEN
        INSERT INTO public.classes (name, is_archived, archived_at, academic_year)
        VALUES (v_archived_name, TRUE, v_archive_time, v_year_clean);
    END IF;

    -- Recreate the clean base class (e.g. "3A", never with the old year)
    IF p_auto_recreate THEN
        INSERT INTO public.classes (name, is_archived, academic_year)
        VALUES (v_base_name, FALSE, NULL)
        ON CONFLICT (name) DO UPDATE 
        SET is_archived = FALSE, archived_at = NULL;
    END IF;

    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object(
        'success', TRUE,
        'base_class', v_base_name,
        'archived_class', v_archived_name,
        'academic_year', v_year_clean,
        'archived_students_count', v_user_count,
        'auto_recreated', p_auto_recreate,
        'archived_at', v_archive_time
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create unarchive_class RPC
CREATE OR REPLACE FUNCTION public.unarchive_class(p_class_name TEXT)
RETURNS JSONB AS $$
BEGIN
    UPDATE public.classes
    SET is_archived = FALSE,
        archived_at = NULL
    WHERE name = p_class_name;

    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object(
        'success', TRUE,
        'class_name', p_class_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.archive_class(TEXT, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_class(TEXT) TO authenticated;

-- 6. Clean up existing duplicate / redundant class rows (e.g. "3A(2526)")
UPDATE public.users 
SET class = '3A (2526)' 
WHERE class = '3A(2526) (2025-2026)' OR class = '3A(2526)';

DELETE FROM public.classes WHERE name = '3A(2526) (2025-2026)';
DELETE FROM public.classes WHERE name = '3A(2526)';

INSERT INTO public.classes (name, is_archived, archived_at, academic_year)
VALUES ('3A (2526)', TRUE, NOW(), '2025-2026')
ON CONFLICT (name) DO UPDATE 
SET is_archived = TRUE, archived_at = NOW(), academic_year = '2025-2026';
`;

export function ArchiveClassModal({
  isOpen,
  onClose,
  className,
  onSuccess
}: ArchiveClassModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [academicOptions, setAcademicOptions] = useState<AcademicYearOption[]>([]);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>('current');
  const [confirmInput, setConfirmInput] = useState('');
  
  // Data state
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [totalCoins, setTotalCoins] = useState<number | null>(null);

  // Execution state
  const [autoRecreate, setAutoRecreate] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMissingRpc, setIsMissingRpc] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [archivedPayload, setArchivedPayload] = useState<ClassArchivePayload | null>(null);
  const [excelFilename, setExcelFilename] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setConfirmInput('');
      setErrorMessage(null);
      setIsMissingRpc(false);
      setCopiedSql(false);
      setArchivedPayload(null);
      setExcelFilename(null);
      setAutoRecreate(true);
      const options = getAcademicYearOptions();
      setAcademicOptions(options);
      setSelectedOptionKey(options[0]?.key || 'current');

      // Fetch quick preview count
      loadClassPreview();
    }
  }, [isOpen, className]);

  const loadClassPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const { data: users, error: userError } = await (supabase
        .from('users')
        .select('id')
        .eq('class', className) as any);

      if (userError) throw userError;

      const ids = (users || []).map((u: any) => u.id);
      setStudentCount(ids.length);

      if (ids.length > 0) {
        const { data: roomData, error: roomError } = await supabase
          .from('user_room_data')
          .select('coins')
          .in('user_id', ids.slice(0, 50));

        if (!roomError && roomData) {
          const sum = roomData.reduce((acc, curr) => acc + (curr.coins || 0), 0);
          setTotalCoins(sum);
        }
      } else {
        setTotalCoins(0);
      }
    } catch (err: any) {
      console.warn('Failed to load class preview:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  if (!isOpen) return null;

  const currentOption = academicOptions.find(o => o.key === selectedOptionKey) || academicOptions[0];
  const baseClassName = className.replace(/\s*\(\d{2,4}(?:[-/]?\d{2,4})?[^)]*\)$/, '').trim() || className;
  const targetArchivedName = `${baseClassName} (${currentOption?.yearTag || '學年'})`;

  const handleNextStep = () => {
    setErrorMessage(null);
    setStep(2);
  };

  const handleConfirmArchive = async () => {
    if (confirmInput.trim() !== className.trim()) {
      setErrorMessage(`請完整輸入班別名稱「${className}」`);
      return;
    }

    setIsArchiving(true);
    setErrorMessage(null);

    try {
      // 1. Fetch complete class archive data
      console.log(`[ArchiveClass] Fetching data for ${className}...`);
      const payload = await fetchClassArchiveData(
        className,
        currentOption,
        user?.user_metadata?.display_name || user?.email || 'Admin'
      );
      setArchivedPayload(payload);

      // 2. Export Excel (.xlsx) file immediately
      console.log(`[ArchiveClass] Generating and downloading Excel...`);
      const downloadedFile = exportClassArchiveToExcel(payload);
      setExcelFilename(downloadedFile);

      // 3. Call database RPC to archive class and reset student coins to 0
      console.log(`[ArchiveClass] Executing database archive_class RPC...`);
      const { data: rpcResult, error: rpcError } = await (supabase as any).rpc('archive_class', {
        p_class_name: className,
        p_archived_by: user?.id || null,
        p_academic_year: currentOption.yearTag || currentOption.label,
        p_auto_recreate: autoRecreate
      });

      if (rpcError) {
        console.error('[ArchiveClass] RPC error:', rpcError);
        const errorText = rpcError.message || '';
        const isNotFound = errorText.includes('archive_class') && (errorText.includes('schema cache') || (rpcError as any).code === 'PGRST202');
        if (isNotFound) {
          setIsMissingRpc(true);
          throw new Error('Supabase 資料庫尚未建立 archive_class 儲存程序 (RPC)。請至 Supabase Dashboard 的 SQL Editor 執行一次遷移腳本即可啟用。');
        }
        throw new Error(`班級封存資料庫操作失敗: ${errorText}`);
      }

      console.log('[ArchiveClass] Successfully archived class:', rpcResult);

      // 4. Move to success step
      setStep(3);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[ArchiveClass] Failed to archive:', err);
      const msg = err.message || '封存班別過程中發生未預期的錯誤';
      if (msg.includes('archive_class') && msg.includes('schema cache')) {
        setIsMissingRpc(true);
        setErrorMessage('Supabase 資料庫尚未建立 archive_class 儲存程序 (RPC)。請至 Supabase 控制台執行 SQL 遷移腳本即可啟用。');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsArchiving(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadJSON = () => {
    if (archivedPayload) {
      exportClassArchiveToJSON(archivedPayload);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5 text-slate-800">
            <div className={`p-2 rounded-xl ${step === 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              <Archive size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">封存班別：{className}</h3>
              <p className="text-xs text-slate-500">
                {step === 1 && '第 1 步：確認備份學年與封存範圍'}
                {step === 2 && '第 2 步：雙重安全驗證 (Double Confirm)'}
                {step === 3 && '封存完成'}
              </p>
            </div>
          </div>
          {step !== 2 && !isArchiving && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMessage && !isMissingRpc && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2 animate-in fade-in">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isMissingRpc && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5 text-amber-900">
                <AlertTriangle size={20} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Supabase 資料庫尚未建立 archive_class 儲存程序</div>
                  <div className="text-xs text-amber-800 mt-1 leading-relaxed">
                    本系統安全封存作業需要資料庫 Stored Procedure (RPC) 支援。備份 Excel 檔案稍早已順利自動下載至您的電腦，請執行一次 SQL 遷移以啟用資料庫端封存功能。
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white/90 border border-amber-200 rounded-lg text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>🛠️ 啟用步驟 (只需 1 分鐘)：</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
                  <li>點擊下方按鈕複製完整的 SQL 遷移腳本。</li>
                  <li>登入 Supabase 控制台 (Dashboard) 進入 <strong>SQL Editor</strong>。</li>
                  <li>建立 <strong>New query</strong> 貼上腳本並點擊 <strong>Run</strong>。</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
                    copiedSql
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {copiedSql ? <CheckCircle2 size={14} /> : <FileCode size={14} />}
                  {copiedSql ? '已複製 SQL 腳本到剪貼簿！' : '複製完整 SQL 遷移腳本'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Overview and Academic Year Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-amber-900 text-sm space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle size={16} /> 封存班別將執行以下學年結算作業：
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-amber-800/90 pl-1">
                  <li>自動匯出全班學生的 <strong>Excel 完整結餘與歷程紀錄 (.xlsx)</strong>。</li>
                  <li>原本班別將標記為「<strong>{className} ({currentOption?.yearTag || '學年'})</strong>」並移至已封存名冊。</li>
                  <li>該班學生帳號完整保留，學生金幣全數<strong>重設歸零 (Reset to 0)</strong>。</li>
                </ul>
              </div>

              {/* Stats Preview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Users size={18} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">班級學生人數</div>
                    <div className="text-base font-bold text-slate-800">
                      {isLoadingPreview ? <Loader2 size={16} className="animate-spin text-slate-400" /> : `${studentCount ?? '--'} 人`}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <Coins size={18} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">當前金幣總結餘</div>
                    <div className="text-base font-bold text-slate-800">
                      {isLoadingPreview ? <Loader2 size={16} className="animate-spin text-slate-400" /> : `${totalCoins?.toLocaleString() ?? '--'} 幣`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Year Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" />
                  欲匯出備份之學年紀錄範圍：
                </label>
                <div className="space-y-1.5">
                  {academicOptions.map(opt => (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedOptionKey === opt.key
                          ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="academicYear"
                        value={opt.key}
                        checked={selectedOptionKey === opt.key}
                        onChange={() => setSelectedOptionKey(opt.key)}
                        className="text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Auto Recreate Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 cursor-pointer hover:bg-indigo-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoRecreate}
                    onChange={e => setAutoRecreate(e.target.checked)}
                    className="mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs text-indigo-950 leading-relaxed">
                    <span className="font-bold text-indigo-900 block mb-0.5">
                      封存後立即為新學年重新開啟空白「{baseClassName}」班別（推薦）
                    </span>
                    <span className="text-indigo-700/90">
                      原本的班級將存檔為「{targetArchivedName}」，舊生金幣歸零並標記為該年度，原名「{baseClassName}」將立即以全新空班重開，方便新學年編班。
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Strict Double Confirmation */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-sm space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertTriangle size={18} className="text-red-600" />
                  極重要行政確認！
                </div>
                <p className="text-xs text-red-800/90 leading-relaxed">
                  您即將結算並封存班別「<strong className="underline">{className}</strong>」為「<strong className="underline">{targetArchivedName}</strong>」。<br />
                  確認後系統會自動下載 Excel 備份，將該班全體學生<strong>金幣歸零</strong>
                  {autoRecreate ? `，並為新學年重新開啟全新的空白「${baseClassName}」班別。` : '。'}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-sm font-semibold text-slate-700">
                  為避免誤觸，請在下方輸入班別名稱「<span className="text-red-600 font-mono font-bold">{className}</span>」以確認：
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder={`輸入 ${className}`}
                  disabled={isArchiving}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800 font-bold placeholder:font-normal"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && confirmInput.trim() === className.trim() && !isArchiving) {
                      handleConfirmArchive();
                    }
                  }}
                />
              </div>

              {isArchiving && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                  <Loader2 className="animate-spin text-blue-600 mx-auto" size={24} />
                  <p className="text-xs font-semibold text-slate-600">正在生成 Excel 備份活頁簿並重設金幣...</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Success Screen */}
          {step === 3 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-800">
                  {className} ({currentOption?.yearTag}) 封存成功！
                </h4>
                <p className="text-xs text-slate-500">
                  全班學生金幣已重設為 0。
                  {autoRecreate ? `系統已為新學年重新建立全新的空白「${className}」班別！` : `班別已存檔至已封存名冊。`}
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <FileSpreadsheet size={16} className="text-green-600" />
                  <span>已自動下載 Excel 備份檔：</span>
                </div>
                <div className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 truncate">
                  {excelFilename || `${className}_學年學生紀錄封存備份.xlsx`}
                </div>
                <p className="text-[11px] text-slate-400">
                  內含「學生結餘總覽」與「歷程明細」雙工作表，可隨時用 Excel 開啟查閱或供未來匯入使用。
                </p>
              </div>

              {/* Extra Companion JSON Download */}
              <div className="pt-1">
                <button
                  onClick={handleDownloadJSON}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <FileCode size={16} className="text-slate-500" />
                  額外下載 JSON 技術備份檔 (.json)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5"
              >
                下一步：安全驗證
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isArchiving}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50"
              >
                返回
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={confirmInput.trim() !== className.trim() || isArchiving}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
              >
                {isArchiving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    封存中...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    確定封存並下載 Excel 備份
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={onClose}
              className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
            >
              完成並關閉
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
