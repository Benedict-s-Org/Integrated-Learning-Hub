# Codebase Manifest — Index
<!-- Agent: Read this index first. Use line ranges to jump to relevant sections for details. -->
| Module | Summary | Lines |
|---|---|---|
| **Contexts & Auth** | `AuthContext`, `AppContext`, logic for roles, impersonation. | L24-L30 |
| **Routing & App Structure** | `App.tsx`, `UnifiedNavigation`, `AppState` navigation system. | L32-L38 |
| **Class Dashboard** | `ClassDashboardPage.tsx` - Main admin dashboard, student lists, rewards, morning duties. | L40-L47 |
| **Admin Users** | `AdminUsersPage.tsx` - User CRUD, bulk edits, QR codes, homework records. | L49-L53 |
| **Admin Progress** | `AdminProgressPage.tsx` - Detailed student stats, coin tracking, and accuracies. | L55-L59 |
| **Homework Records** | `AdminHomeworkRecordPage.tsx` - Bulk assignment statuses & rewards. | L61-L64 |
| **Super Admin** | `SuperAdminPanel.tsx` - Granular permission/role toggling, admin reassignment. | L66-L70 |
| **Unified Assignments** | `UnifiedAssignments.tsx` - Fetches/displays active student tasks. | L72-L75 |
| **Memory Palace** | `MemoryPalacePage.tsx` - Visual grid, furniture placement, memory attachments. | L77-L82 |
| **Phonics Ecosystem** | `PhonicsGameHub.tsx` - Minigames, levels, leaderboards, blending board. | L84-L88 |
| **Memorization / Saved** | `SavedContent.tsx` - Memorization text management & public link generation. | L90-L93 |
| **Coin Service** | `coinService.ts` - Central coin award/revert logic, calls RPCs. | L95-L99 |
| **Quiz System** | `InteractiveScanQuizPage.tsx` - Paper-based AR marker scanning quiz. | L101-L105 |
| **Spaced Repetition**| `SpacedRepetitionPage.tsx` & Algorithm - Question tracking, algorithm logic. | L107-L111 |
| **Core Utilities** | `roomGeometry.ts`, `importParsers.ts` - Isometric math and data ingestion. | L113-L116 |
| **Error Logger** | `errorLogger.ts` - Auto-logs development errors securely to DB. | L118-L121 |
| **DB & RPCs** | Core tables (`student_records`, `user_room_data`) and Postgres RPCs. | L123-L128 |

---

## Detailed Sections

### Contexts & Auth (L24-L30)
- **Files**: `src/context/AuthContext.tsx`, `src/context/AppContext.tsx`
- **Auth Features**:
  - `user`: Holds current `UserProfile` (role, name, permissions).
  - **Impersonation**: `isImpersonating` state. When true, `impersonatedAdminId` holds the original admin's ID, and `user` holds the impersonated student profile.
  - **View Mode**: `toggleViewMode` flips an admin between 'admin' and 'student' view without logging out.
- **App Data**: `AppContext` globally fetches and caches lists of `savedContents`, `spellingLists`, and `proofreadingPractices`.

### Routing & App Structure (L32-L38)
- **Files**: `src/App.tsx`, `src/components/UnifiedNavigation/UnifiedNavigation.tsx`
- **Routing Mechanism**: Does NOT use standard React Router `BrowserRouter` for inner navigation. Instead, it uses a custom state machine: `appState` (`AppState` interface).
- **Navigation Logic**: 
  - Hash URL parsing is used for public access content (`#/public/...`).
  - Access control is enforced inside `handlePageChange` and `useEffect` hooks in `App.tsx` (e.g., kicking non-admins out of restricted `page` states).
- **Global UI Wrappers**: `appState` conditionally renders pages inside the main `<main>` container, usually alongside `UnifiedNavigation` unless hidden (like full-screen scanners).

### Class Dashboard (L40-L47)
- **Path**: `src/pages/ClassDashboardPage.tsx`
- **Key State**:
  - `groupedUsers`: Users grouped by class name.
  - `selectedStudentIds`: Current selection for bulk actions.
  - `showMorningDuties`: Toggled to show morning checklist (default on between 7-9 AM HK time).
- **Core Dependencies**: `coinService` for rewards, `UniversalMessageToolbar` for broadcasts.
- **Gotchas**: Uses `useDocumentPiP` for picture-in-picture. `UserWithCoins` extended type has non-standard fields (`daily_real_earned`, `virtual_coins`) loaded via user_room_data view/RPCs. Guest mode uses token from URL parameter.

### Admin Users (L49-L53)
- **Path**: `src/pages/AdminUsersPage.tsx`
- **Purpose**: Manage all student and admin accounts.
- **Key Logic**: Generates QR tokens upon user creation. Homework records log directly via modal logic. Supports bulk awarding and batch reverting.
- **Gotchas**: Only Super Admins can manage other Admins. Relies heavily on Supabase `auth.users` combined with public `users` table logic implemented via Edge Functions.

### Admin Progress (L55-L59)
- **Path**: `src/pages/AdminProgressPage.tsx`
- **Concept**: The ultimate analytics view for teachers to monitor student activities.
- **Data Fetched**: Interrogates `user_room_data` and computes tracking data (house_level, coins, virtual_coins, proofreading_avg_accuracy, etc.).
- **Features**: Filter by class, sort by specific metrics (like coins earned, total time, active periods).

### Homework Records (L61-L64)
- **Path**: `src/pages/AdminHomeworkRecordPage.tsx`
- **Concept**: A bulk-marking tool. Admin selects multiple students and clicks specific assignment items ("ProblemOptions" like Dictation, Workbooks).
- **Mechanism**: Saves directly to `homework_records` table and optionally dispenses coins using `coinService`. Also triggers visual and audio success indicators via `playSuccessSound`.

### Super Admin (L66-L70)
- **Path**: `src/pages/SuperAdminPanel.tsx`
- **Concept**: The root tool for managing cross-admin data. 
- **Roles & Permissions**: Bulk-updates `role` ('admin' or 'user'). Overrides granular app permissions for specific sub-modules (`can_access_proofreading`, `can_access_spelling`). Can also re-assign multiple students from one admin to another via `managed_by_id`.
- **Security**: Hard-locked by `useSuperAdmin()` hook.

### Unified Assignments (L72-L75)
- **Path**: `src/components/UnifiedAssignments/UnifiedAssignments.tsx`
- **Concept**: Interrogates multiple tables (`proofreading_assignments`, `spelling_assignments`, etc.) to build a single "To-Do" list for students.
- **Mechanism**: Sorts by due date. Overdue items are flagged visually. If clicked, directly routes the `AppState` state machine into that specific module (Spelling, Proofreading, Memorization).

### Memory Palace (L77-L82)
- **Path**: `src/pages/MemoryPalacePage.tsx`
- **Concept**: An isometric virtual room where students spend coins to place furniture and attach "Memories" to them.
- **Key Hooks**: `useMemoryPalaceContext`, `useInventory`.
- **Interactions**: Clicking an entity triggers `handleEntityMemoryClick`, either opening existing notes or prompting to create one. Relies on `MemoryContentModal` for rendering the actual text/content attachments.
- **Related Pages**: `SpaceDesignCenter.tsx`, `AssetUploadCenter.tsx` for admin uploading of base furniture PNGs.

### Phonics Ecosystem (L84-L88)
- **Path**: `src/components/phonics/PhonicsGameHub.tsx`
- **Concept**: A gamified module specifically for learning English phonetics.
- **Components**: `SoundWall`, `BlendingBoard` (for dragging and combining phonetic sounds), and interactive quizzes (`PhonicsQuiz`).
- **Gamicifation**: Uses exact XP thresholds (`LEVEL_THRESHOLDS`) to award levels and achievement badges internally within the phonics module itself.

### Memorization / Saved (L90-L93)
- **Path**: `src/components/SavedContent/SavedContent.tsx`
- **Concept**: Allows Admins to create and manage text blocks for students to memorize.
- **Logic**: Can generate "Public Links" (`public_id`) which allow accessing the text without logging in. Uses `appState = { page: 'publicPractice' }` inside `App.tsx` to handle these.

### Coin Service (L95-L99)
- **Path**: `src/services/coinService.ts`
- **Mechanism**: The single source of truth for awarding points.
- **Virtual Coins**: Hard limit of 3 "Answering Questions" real rewards per day. Calls `increment_room_coins` RPC which handles the actual increment and auto-logs a transaction in `student_records`.
- **Revert System**: Tracks `_lastBatchId`. When reverting, updates `is_reverted = true` in `student_records` and deducts points. Keeps reverted records for 30 days.

### Quiz System (L101-L105)
- **Path**: `src/pages/InteractiveScanQuizPage.tsx`
- **Concept**: Uses a device camera to scan AR tags held by students.
- **Tech**: Custom injected dictionary `DICT_4X4_1000`. Analyzes marker rotation to determine the answer (A, B, C, D).
- **Gotchas**: Modifies `AR` global object. Performance sensitive in `processFrame`.

### Spaced Repetition (L107-L111)
- **Path**: `src/pages/SpacedRepetitionPage.tsx` & `src/utils/spacedRepetitionAlgorithm.ts`
- **Concept**: Uses an adaptation of SuperMemo-2 (SM-2) algorithm. 
- **DB Mapping**: Saves tracking data and computes `next_review_date`, `interval`, and `ease_factor`.
- **State Flow**: `SessionSummary` shows accuracy and metrics after completing a review round.

### Core Utilities (L113-L116)
- **Path**: `src/utils/roomGeometry.ts`, `src/utils/importParsers.ts`
- **Isometric Math**: `roomGeometry` handles conversion from 2D mouse coordinates to isometric grid tiles and calculates `zIndex` dynamically so avatars stand realistically behind or in front of furniture.
- **Data Ingestion**: `importParsers` processes bulk JSON formats for questions and memory data.

### Error Logger (L118-L121)
- **Path**: `src/services/errorLogger.ts`
- **Concept**: Development tool that parses exceptions and lint errors, sending them to the `dev_error_log` database table.
- **Security Check**: Strips patterns like API keys, Supabase tokens, passwords from error messages before saving.

### DB & RPCs (L123-L128)
- **coin_transactions / student_records**: Unifies all point changes. 
- **`increment_room_coins(user_id, amount, reason, ...)`**: High-availability Postgres RPC that ensures atomicity when adding coins and logging. Overcomes concurrent request race conditions.
- **`revert_student_record(record_id)`**: Backs out a previous transaction exactly. Supports bulk via `revert_student_records_batch`.
- **`award_dictation_bonus`**: Complex server-side logic assigning scale-based coins depending on dictation accuracy percentages.
- **Gotcha**: Auth search_path `pgcrypto` is in the `extensions` schema. Any auth-related DB function *must* have `search_path = public, extensions, pg_temp`.
