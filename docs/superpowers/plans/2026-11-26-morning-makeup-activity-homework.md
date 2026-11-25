# 朝早補交浮窗 + Activity Logs Homework Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 學生喺課室 MON 篤完今日交齊／欠之後，若有舊欠交就彈浮窗俾佢勾選補交並一次確認；User Analytics → Activity Logs 喺 Overview 同 Spelling 之間加 Homework tab，按日顯示交齊／欠、當日欠項、當日補交、以及以該日完結為準嘅累積欠交。

**Architecture:** 唔加新表。共用 `src/lib/homework/` helper 計「仍欠清單」同「按日日記」。寫入沿用 Missing Ledger 同一套 `set_homework_makeup` + `set_english_homework_check(p_is_late)`。MorningDutiesBoard（同 Class Dashboard `HomeworkModal` 若有同等交齊／欠出口）喺今日狀態儲存成功後再開 modal。Activity Logs 加 `TAB-ACTIVITY-HOMEWORK` 讀同一套 diary builder。

**Tech Stack:** React、Vitest、現有 `homeworkDb` / Supabase RPCs、`getHKTodayString`（Asia/Hong_Kong）

**Spec:** `docs/superpowers/specs/2026-11-26-morning-makeup-activity-homework-design.md`

## Global Constraints

- 所有新 UI 文案必須英文；科目／項目名跟資料庫原樣。
- 唔加每日快照表／新 RPC（除非現有 RPC 明顯唔夠用先另開 task）。
- 補交「日」= `marked_at` 轉 Asia/Hong_Kong 嘅 `YYYY-MM-DD`，**唔係** `homework_makeup_actions.log_date`（嗰個係原本欠交日）。
- 浮窗清單排除「今日先啱啱記低」嘅欠交；只顯示 `log_date < today`（HK）仍然未補嘅項目。
- `data-ui`：`MODAL-HOMEWORK-MAKEUP`、`LIST-HOMEWORK-OUTSTANDING`、`BTN-HOMEWORK-MAKEUP-CONFIRM`、`BTN-HOMEWORK-MAKEUP-CANCEL`、`TAB-ACTIVITY-HOMEWORK`、`LIST-HOMEWORK-DAILY`；完成後更新 `C:\AI\PersonalOS\docs\SYSTEM_GUIDE.md` 雙語表。
- Missing Ledger 行為保持可用，同 modal 寫入一致。

## 檔案地圖

| 檔案 | 職責 |
|------|------|
| Create: `src/lib/homework/outstandingHomework.ts` | 查／正規化某學生「仍欠」項目（跨日） |
| Create: `src/lib/homework/homeworkDiary.ts` | 由 duty／makeup／checks 砌按日日記 |
| Create: `src/test/homework/outstandingHomework.test.ts` | 仍欠規則單測 |
| Create: `src/test/homework/homeworkDiary.test.ts` | 日記／累積欠交單測 |
| Create: `src/components/admin/homework/HomeworkMakeupModal.tsx` | 學生勾選 + Confirm／Cancel 浮窗 |
| Modify: `src/components/admin/MorningDutiesBoard.tsx` | 今日交齊／欠成功後觸發仍欠查詢 → modal |
| Modify: `src/components/admin/HomeworkModal.tsx`（同 `ClassDashboardPage.tsx` 若需要） | 同等交齊／欠成功後同一 modal |
| Create: `src/components/UserAnalytics/ActivityHomeworkPanel.tsx` | Activity Logs Homework 內容 |
| Modify: `src/components/UserAnalytics/StudentActivityDetail.tsx` | Tab 順序插入 Homework |
| Modify: `C:\AI\PersonalOS\docs\SYSTEM_GUIDE.md` | 登記新 `data-ui` |

---

### Task 1: 仍欠清單 helper + 測試

**Files:**
- Create: `src/lib/homework/outstandingHomework.ts`
- Create: `src/test/homework/outstandingHomework.test.ts`

**Interfaces:**
- Produces:

```ts
export type OutstandingHomeworkItem = {
  logId: string;
  logDate: string; // original missing day YYYY-MM-DD
  className: string;
  studentId: string;
  subject: string;
  item: string;
  detail: string;
};

/** Pure: from already-loaded rows, exclude made-up / handed-in / today. */
export function filterOutstandingHomework(args: {
  todayIso: string;
  dutyLogs: Array<{
    id: string;
    log_date: string;
    class: string;
    student_id: string;
    status: string;
    missing_items: Record<string, string[]> | null;
  }>;
  makeupActions: Array<{
    log_id: string;
    subject: string;
    item: string;
    is_made_up: boolean;
  }>;
  handedInKeys: Set<string>; // prefer same key style as english checks: class|date|subject|item|studentId — document in file
}): OutstandingHomeworkItem[];

export function groupOutstandingByDate(
  items: OutstandingHomeworkItem[],
): Array<{ date: string; items: OutstandingHomeworkItem[] }>;
```

規則：
1. 只由 `status === 'missing'`（或 ledger 同等仍開住）嘅 past logs 展開 `missing_items`。
2. `log_date >= todayIso` 嘅全部唔入清單。
3. `is_made_up === true` 嘅 `(log_id, subject, item)` 唔入清單。
4. 已 `handed_in` 嘅 check 唔入清單。
5. `groupOutstandingByDate`：日期由舊到新。

- [ ] **Step 1: 寫失敗測試**（至少覆蓋：跨日累積、排除今日、排除已 makeup、排除 handed_in、分組順序）

```ts
import { describe, it, expect } from 'vitest';
import { filterOutstandingHomework, groupOutstandingByDate } from '@/lib/homework/outstandingHomework';

describe('filterOutstandingHomework', () => {
  it('keeps prior missing items and drops today / made-up / handed-in', () => {
    const items = filterOutstandingHomework({
      todayIso: '2026-11-26',
      dutyLogs: [
        {
          id: 'log-old',
          log_date: '2026-11-24',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 英文: ['Worksheet A', 'Worksheet B'] },
        },
        {
          id: 'log-today',
          log_date: '2026-11-26',
          class: '4A',
          student_id: 's1',
          status: 'missing',
          missing_items: { 英文: ['Today C'] },
        },
      ],
      makeupActions: [
        { log_id: 'log-old', subject: '英文', item: 'Worksheet B', is_made_up: true },
      ],
      handedInKeys: new Set(),
    });
    expect(items.map((i) => i.item)).toEqual(['Worksheet A']);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/test/homework/outstandingHomework.test.ts`  
Expected: FAIL（module／export 未存在）

- [ ] **Step 3: 實作 `outstandingHomework.ts` 令測試通過**（key 格式同檔案頂註解寫死，之後 Task 3／4 跟同一格式）

- [ ] **Step 4: 再跑測試**

Run: `npx vitest run src/test/homework/outstandingHomework.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**（只 commit 呢個 task 相關檔；訊息說明仍欠 filter 規則）

---

### Task 2: 按日 Homework diary helper + 測試

**Files:**
- Create: `src/lib/homework/homeworkDiary.ts`
- Create: `src/test/homework/homeworkDiary.test.ts`

**Interfaces:**
- Produces:

```ts
export type HomeworkDiaryDay = {
  date: string;
  morningStatus: 'submitted' | 'missing' | 'absent' | 'exempted' | 'late' | 'todo' | 'none';
  missingThatDay: Array<{ subject: string; item: string }>;
  madeUpThatDay: Array<{
    subject: string;
    item: string;
    originalLogDate: string;
  }>;
  cumulativeOutstanding: Array<{
    subject: string;
    item: string;
    originalLogDate: string;
    logId: string;
  }>;
};

export function buildHomeworkDiary(args: {
  dutyLogs: Array<{
    id: string;
    log_date: string;
    status: string;
    missing_items: Record<string, string[]> | null;
  }>;
  makeupActions: Array<{
    log_id: string;
    log_date: string; // original day
    subject: string;
    item: string;
    is_made_up: boolean;
    marked_at: string; // timestamptz ISO
  }>;
  /** Optional: handed-in events used to clear cumulative when ledger marked without makeup row */
  handIns?: Array<{
    logDate: string;
    subject: string;
    item: string;
    handedIn: boolean;
    isLate: boolean;
    updatedOnIso?: string; // if unknown, treat as logDate for historical replay only when safe
  }>;
}): HomeworkDiaryDay[];
```

規則（對齊 spec）：
1. 收集所有有 signal 嘅日期（duty `log_date`、makeup 嘅 HK `marked_at` 日）。
2. 每日：morningStatus 來自嗰日 duty；無則 `'none'`。
3. `missingThatDay` = 嗰日 duty 嘅 missing_items（交齊則空）。
4. `madeUpThatDay` = `is_made_up` 且 HK(marked_at) === D；帶 `originalLogDate = log_date`。
5. `cumulativeOutstanding` = 所有 `originalLogDate <= D` 曾經欠過、且未喺 `marked_at HK date <= D` 補交清嘅項目（Mon／Tue 例子必須通過）。
6. 回傳日期由新到舊（Activity Logs 預設）。

- [ ] **Step 1: 寫失敗測試（Mon 欠 A、Tue 補 A → Mon cumulative 仍有 A；Tue madeUp 有 A；Tue cumulative 無 A）**

```ts
it('keeps historical cumulative after later makeup', () => {
  const days = buildHomeworkDiary({
    dutyLogs: [
      { id: 'm', log_date: '2026-11-24', status: 'missing', missing_items: { 英文: ['A'] } },
      { id: 't', log_date: '2026-11-25', status: 'submitted', missing_items: null },
    ],
    makeupActions: [
      {
        log_id: 'm',
        log_date: '2026-11-24',
        subject: '英文',
        item: 'A',
        is_made_up: true,
        marked_at: '2026-11-25T01:00:00.000Z', // choose a stamp that is 2026-11-25 in HK
      },
    ],
  });
  const mon = days.find((d) => d.date === '2026-11-24')!;
  const tue = days.find((d) => d.date === '2026-11-25')!;
  expect(mon.cumulativeOutstanding.map((x) => x.item)).toContain('A');
  expect(tue.madeUpThatDay.map((x) => x.item)).toContain('A');
  expect(tue.cumulativeOutstanding.map((x) => x.item)).not.toContain('A');
});
```

- [ ] **Step 2: 跑測確認 FAIL → 實作 → PASS**

Run: `npx vitest run src/test/homework/homeworkDiary.test.ts`

- [ ] **Step 3: Commit**

---

### Task 3: `HomeworkMakeupModal` + 批次寫入

**Files:**
- Create: `src/components/admin/homework/HomeworkMakeupModal.tsx`

**Interfaces:**
- Consumes: `OutstandingHomeworkItem[]`、`studentName`、`onClose`、`onConfirmSuccess`
- Produces: 批次呼叫同 Missing ledger 一致嘅 RPC

```tsx
export type HomeworkMakeupModalProps = {
  open: boolean;
  studentId: string;
  studentName: string;
  className: string;
  items: OutstandingHomeworkItem[];
  onClose: () => void; // cancel: no writes
  onConfirmSuccess: () => void;
};
```

行為：
1. `data-ui="MODAL-HOMEWORK-MAKEUP"`；列表 `LIST-HOMEWORK-OUTSTANDING`；確認 `BTN-HOMEWORK-MAKEUP-CONFIRM`；取消 `BTN-HOMEWORK-MAKEUP-CANCEL`。
2. 多選；未 Confirm 唔寫庫。
3. Confirm：對每個選中項順序（或 `Promise.all` 但要可表面部分失敗）：
   - `homeworkDb.rpc('set_english_homework_check', { ..., p_handed_in: true, p_is_late: true, p_date: item.logDate, ... })`
   - `homeworkDb.rpc('set_homework_makeup', { p_log_id: item.logId, p_subject, p_item, p_is_made_up: true })`
4. 英文文案例如：`Outstanding homework`、`Confirm makeup`、`Cancel`、`No items selected`（若 Confirm 時無選中則唔呼叫 RPC、可 toast／disable）。
5. 失敗：英文 error；保留選取；唔 silently 當成功。

- [ ] **Step 1: 實作 modal 元件（跟現有 admin modal 視覺密度，唔另開設計系統）**
- [ ] **Step 2: 手動或輕量 component test（可選）——至少 typecheck／lint 該檔**
- [ ] **Step 3: Commit**

---

### Task 4: 接上 MorningDutiesBoard（同 Dashboard HomeworkModal）

**Files:**
- Modify: `src/components/admin/MorningDutiesBoard.tsx` — 喺 `saveLogStatus` 成功路徑（`submitted` 或已儲存嘅 `missing`）之後插入仍欠查詢 + 開 modal
- Modify: `src/components/admin/HomeworkModal.tsx`（及 `ClassDashboardPage.tsx` 若交齊／欠喺頁面層完成）— 同等 hook

流程（`saveLogStatus` 尾）：
1. `today = getHKTodayString()`。
2. 向 Supabase 拉呢個學生所有 `morning_duty_logs`（或 class 範圍再 filter）、其 `homework_makeup_actions`、相關 `english_homework_checks`。
3. `filterOutstandingHomework({ todayIso: today, ... })`。
4. 若 `items.length === 0`：唔開 modal（今日狀態已儲存）。
5. 若有：setState 開 `HomeworkMakeupModal`。
6. modal `onConfirmSuccess` → `fetchLogs` + `onStatusChange`。
7. **Absent／exempt 唔開補交 modal**（除非之後產品要求；今次只跟 spec 嘅交齊／欠）。

- [ ] **Step 1: 接線 MorningDutiesBoard**
- [ ] **Step 2: 接線 HomeworkModal／Class Dashboard 同等出口**
- [ ] **Step 3: 手動驗收清單（寫喺 PR／commit body）**  
  - 無舊欠：交齊／欠後無浮窗  
  - 有舊欠：浮窗出現且無今日新欠項  
  - 勾部分 Confirm：只有勾選變 makeup；其餘仍喺 Missing ledger  
  - Cancel：無 makeup 寫入  
- [ ] **Step 4: Commit**

---

### Task 5: Activity Logs → Homework tab

**Files:**
- Create: `src/components/UserAnalytics/ActivityHomeworkPanel.tsx`
- Modify: `src/components/UserAnalytics/StudentActivityDetail.tsx`

**Interfaces:**

```tsx
// ActivityHomeworkPanel
export type ActivityHomeworkPanelProps = {
  userId: string;
  className?: string; // student class if already known
};

// StudentActivityDetail TabType 擴展：
type TabType = 'overview' | 'homework' | 'spelling' | 'proofreading' | 'memorization' | 'spaced_repetition';
```

行為：
1. Tabs 陣列順序：Overview → Homework（`data-ui="TAB-ACTIVITY-HOMEWORK"`）→ Spelling → …
2. `ActivityHomeworkPanel` 載入 duty／makeup／checks → `buildHomeworkDiary` → `data-ui="LIST-HOMEWORK-DAILY"` 按日卡：
   - Morning: Submitted / Missing / No morning check-in / …
   - Missing that day: 列表或 `None`
   - Made up that day: 列表（顯示 original date）或 `None`
   - Still outstanding (end of day): cumulative 列表或 `None`
3. 全英文；載入失敗：tab 內英文 error empty state。
4. 唔改其他 practice tab 邏輯。

- [ ] **Step 1: 加 tab + panel 載入／渲染**
- [ ] **Step 2: 對照 Mon／Tue 例子用真實或 fixture 數據抽查**
- [ ] **Step 3: Commit**

---

### Task 6: SYSTEM_GUIDE `data-ui` 同步

**Files:**
- Modify: `C:\AI\PersonalOS\docs\SYSTEM_GUIDE.md`

- [ ] **Step 1: 喺雙語表加入 Task 3／5 六個 code（英文 code | 中文名 | 模組 | 用途）**
- [ ] **Step 2: Commit（PersonalOS repo 若分開就喺嗰邊 commit；唔好把無關 Learning Hub dirty files 一併塞入）**

---

## Spec 覆蓋自檢

| Spec 要求 | Task |
|-----------|------|
| 交齊／欠後有舊欠先彈窗；無則唔彈 | 4 |
| 學生多選 + Confirm 一次寫入；冇勾繼續欠 | 3–4 |
| 全部舊欠、排除今日新欠 | 1、4 |
| 沿用 makeup + late checks | 3 |
| Activity Logs Homework 喺 Overview 同 Spelling 之間 | 5 |
| 每日：交齊／欠、當日欠、當日補、累積欠（歷史唔改寫） | 2、5 |
| `marked_at` 作補交日 | 2、5 |
| `data-ui` + SYSTEM_GUIDE | 3、5、6 |
| Missing ledger 仍可用 | 3 共用 RPC；無改壞 ledger |

## 執行方式（等你選）

Plan 存喺：`docs/superpowers/plans/2026-11-26-morning-makeup-activity-homework.md`

1. **Subagent-Driven（建議）** — 每個 Task 開新 subagent，完成後 review 再下一個  
2. **Inline Execution** — 喺呢個對話用 executing-plans 逐 task 做

你想用邊種？回 `1` 或 `2`（或者直接講「開始做」當 Inline）。
