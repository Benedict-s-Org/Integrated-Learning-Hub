# Codebase Manifest — Index
<!-- Agent: Read this index first. Use line ranges to jump to relevant sections for details. -->
| Module | Summary | Lines |
|---|---|---|
| **Contexts & Auth** | `AuthContext`, `AppContext`, logic for roles, impersonation. | L33-L40 |
| **Routing & App Structure** | `App.tsx`, `UnifiedNavigation` - Navigation permissions & custom routing. | L41-L52 |
| **Teacher Admin** | `UnifiedNavigation` - New dedicated category for teaching-related tools. | L53-L57 |
| **Class Dashboard** | `ClassDashboardPage.tsx` - Main admin dashboard & dynamic announcement bar. | L58-L68 |
| **Broadcast System** | `BroadcastQuickBar.tsx` - Dynamic, sticky messaging & notification management. | L62-L72 |
| **Admin Users** | `AdminUsersPage.tsx` - User CRUD, QR codes, & homework records. | L73-L78 |
| **Admin Progress** | `AdminProgressPage.tsx` - Student analytics & tracking. | L67-L72 |
| **Homework Records** | `AdminHomeworkRecordPage.tsx` - Bulk assignment marking & coin awards. | L73-L77 |
| **Super Admin** | `SuperAdminPanel.tsx` - Granular roles & student re-assignment. | L78-L83 |
| **Unified Assignments** | `UnifiedAssignments.tsx` - Automated student To-Do lists. | L84-L88 |
| **Memory Palace** | `MemoryPalacePage.tsx` - Isometric customization & memory attachments. | L89-L95 |
| **Phonics Ecosystem** | `PhonicsDashboard.tsx` - Unified tool for audio generation and Sound Wall management. | L96-L101 |
| **Memorization / Saved** | `SavedContent.tsx` - Difficulty-gated memorization texts. | L102-L108 |
| **Coin Service** | `coinService.ts` - Central coin reward & revert logic. | L109-L115 |
| **Quiz System** | `InteractiveScanQuizPage.tsx` - AR marker scanning group quizzes. | L116-L121 |
| **Spaced Repetition**| `SpacedRepetitionPage.tsx` - SM-2 adaptation & Notion AI elaboration. | L122-L128 |
| **Core Utilities** | `roomGeometry.ts`, `importParsers.ts` - Isometric math & data ingestion. | L129-L133 |
| **Error Logger** | `errorLogger.ts` - Development error logging system. | L134-L138 |
| **Timetable System** | `AdminTimetablePage.tsx` - Notion cycle sync & grid management. | L139-L147 |
| **DB & RPCs** | Core tables and atomic Postgres RPCs. | L148-L154 |
| **Spelling Practice**| `SpellingPractice.tsx` - Level-based word practice & SRS. | L155-L167 |
| **Reading / Notion** | `ReadingPracticeCreator.tsx` - Passage bulk cropping & Notion sync. | L168-L189 |
| **Google TTS** | `google-tts/index.ts` - Drive proxy architecture for reliable audio. | L190-L201 |
| **iPad Interactive** | `IPadInteractiveZone.tsx` - Pressure-sensitive handwriting training. | L218-L229 |
| **Exam Formatter** | `ExamFormatterPage.tsx` - WYSIWYG editor with Top Toolbar, Notion sync, & AI assistants. | L231-L245 |
| **Vocab Image Picker** | `VocabImagePicker.tsx` - License-safe image scraper & bulk downloader. | L273-L281 |
| **Cognitive Anagram** | `AnagramApp.tsx` - Notion-synced experiment & logging layer. | L290-L305 |
| **Token Optimization** | AI Agent efficiency rules (Targeted Edit, Lean Artifacts). | L283-L288 |
| **Reliability** | Development standards to prevent infinite loops and stalls. | L36-L42 |

---

## Reliability & Loop Prevention (L33-L42)

To ensure development remains fast and avoids "infinite loops" or stalled progress, the following standards are enforced (detailed in `safe-development.md#25`):
- **Direct Edits Over Scripts**: Favor surgical code replacements over temporary data-fetching or infrastructure scripts.
- **Fail-Fast & Pivot**: If an automated tool chain is interrupted or fails twice, pivot to a manual verification or a simpler editing strategy immediately.
- **UI Data Priority**: Always follow the "Researcher First" rule (detailed in `safe-development.md#27`): `CMS Content > Props > Constants`.
- **Documentation First**: Manifest updates prioritize human-readable documentation of architecture over building automated sync tools.

---

## Detailed Sections

### Contexts & Auth (L24-L30)
- **Files**: `src/context/AuthContext.tsx`, `src/context/AppContext.tsx`
- **Auth Features**:
  - `user`: Holds current `UserProfile` (role, name, permissions, including `spelling_level`, `memorization_level`, `reading_rearranging_level`, `reading_proofreading_level`, `proofreading_level`).
  - **Impersonation**: `isImpersonating` state. When true, `impersonatedAdminId` holds the original admin's ID, and `user` holds the impersonated student profile.
  - **View Mode**: `toggleViewMode` flips an admin between 'admin' and 'student' view without logging out.
- **App Data**: `AppContext` globally fetches and caches lists of `savedContents`, `spellingLists`, and `proofreadingPractices`.

### Routing & App Structure (L40-L47)
- **Files**: `src/App.tsx`, `src/components/UnifiedNavigation/UnifiedNavigation.tsx`, `src/pages/admin/NavigationManagementPage.tsx`
- **Routing Mechanism**: Does NOT use standard React Router `BrowserRouter` for inner navigation. Instead, it uses a custom state machine: `appState` (`AppState` interface).
- **Navigation Logic**: 
  - Hash URL parsing is used for public access content (`#/public/...`).
  - Access control is enforced inside `handlePageChange` and `useEffect` hooks in `App.tsx`.
- **Navigation Permissions**: `NavigationSettingsContext.tsx` manages per-user permission overrides stored in `users.navigation_permissions`. `NavigationManagementPage.tsx` allows admins to toggle visibility of items for specific students.
  - **Simplified Matrix View**: The `NavigationManagementPage` now features a **"Hide Unchecked"** toggle. When enabled, it dynamically hides columns (navigation items) that are completely inactive for the current set of filtered users. Cell-level checkboxes for unchecked items are also hidden until hover to provide a cleaner "labels-only" look for active permissions.
  - **New Category**: Added **"Teacher Administration Tool"** as a dedicated top-level section in `UnifiedNavigation` (visible to Staff/Admin), separating teaching resources from system-level admin tasks.
- **Admin Navigation Organization**: The "Admin" section in `UnifiedNavigation` is grouped into four logical sub-categories: **User & System**, **Teaching & Records**, **Creative Studio**, and **Tools & Utilities**. It uses the `NavSubHeader` component for visual separation.
- **Global UI Wrappers**: `appState` conditionally renders pages inside the main `<main>` container, usually alongside `UnifiedNavigation` unless hidden.

### Teacher Administration (L53-L61)
- **Concept**: A dedicated navigation space for teachers to manage educational resources.
- **Components**: `NavSection` in `UnifiedNavigation.tsx`.
- **Tools**:
  - **Vocab Image Picker**: Scrapes license-safe images for vocab lists.
  - **Phonics Dashboard**: Unified tool (`PhonicsDashboard.tsx`) for generating phoneme sounds and managing the Sound Wall. Features a **Generator** tab (SSML/IPA synthesis) and a **Manager** tab (Auto-Link cache & Manual Link modal).
  - **Exam Paper Formatter**: WYSIWYG editor for creating structured exam papers.

### Class Dashboard (L51-L61)
- **Path**: `src/pages/ClassDashboardPage.tsx`
- **Key State**:
  - `groupedUsers`: Users grouped by class name.
  - `selectedStudentIds`: Current selection for bulk actions.
  - `showMorningDuties`: Toggled to show morning checklist (default on between 7-9 AM HK time).
- **Core Components**: `BroadcastQuickBar` (sticky top-of-content), `UserGrid`, `AdminActionToolbar`.
- **Integrated Logic**: `BroadcastQuickBar` is positioned at the top of the `max-w-7xl` container and is `sticky top-0`. It only renders when there are active messages or students selected.
- **Gotchas**: Uses `useDocumentPiP` for picture-in-picture. `UserWithCoins` extended type has non-standard fields (`daily_real_earned`, `virtual_coins`) loaded via user_room_data view/RPCs. Guest mode uses token from URL parameter. **Default class is set to '3A'**.

### Broadcast & Notifications (L62-L72)
- **Files**: `src/components/admin/notifications/BroadcastQuickBar.tsx`, `src/pages/admin/BroadcastManagementPage.tsx`
- **Concept**: Centralized messaging system for classes and individual students.
- **Dynamic Behavior**: `BroadcastQuickBar` uses `sticky` positioning to avoid blocking fixed navigation elements. It returns `null` when no messages are active and no context (selected students) is present.
- **Management**: `BroadcastManagementPage.tsx` handles template creation (`custom_broadcasts`) and publishing instances (`active_announcements`) to specific classes or students.
- **Data Flow**: Settings are stored in `system_config` under `broadcast_v2_settings`. Real-time updates are handled via Supabase channel subscriptions in `BroadcastBoard.tsx`.

### Admin Users (L49-L53)
- **Path**: `src/pages/AdminUsersPage.tsx`
- **Purpose**: Manage all student and admin accounts.
- **Key Logic**: Generates QR tokens upon user creation. Homework records log directly via modal logic. Supports bulk awarding and batch reverting. **UserEditModal.tsx** now handles centralized learning level management.
- **Gotchas**: Only Super Admins can manage other Admins. Relies heavily on Supabase `auth.users` combined with public `users` table logic implemented via Edge Functions. **Default class filter is '3A'**.

### Admin Progress (L55-L59)
- **Path**: `src/pages/AdminProgressPage.tsx`
- **Concept**: The ultimate analytics view for teachers to monitor student activities.
- **Data Fetched**: Interrogates `user_room_data` and computes tracking data (house_level, coins, virtual_coins, proofreading_avg_accuracy, etc.).
- **Features**: Filter by class, sort by specific metrics (like coins earned, total time, active periods).

### Homework Records (L61-L64)
- **Path**: `src/pages/AdminHomeworkRecordPage.tsx`
- **Concept**: A bulk-marking tool. Admin selects multiple students and clicks specific assignment items ("ProblemOptions" like Dictation, Workbooks).
- **Mechanism**: Saves directly to `homework_records` table and optionally dispenses coins using `coinService`. Also triggers visual and audio success indicators via `playSuccessSound`. **Default class selection is '3A'**.

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

### Phonics Ecosystem (L127-L132)
- **Files**: `src/components/admin/PhonicsDashboard.tsx`, `src/components/phonics/PhonicsGameHub.tsx`
- **Concept**: A unified administrative dashboard and a student-facing gamified hub for learning English phonetics.
- **Admin Dashboard (`PhonicsDashboard.tsx`)**:
    - **Audio Generator**: Bulk synthesis of IPA-accurate sounds. Uses `PHONEME_TO_IPA` mapping for SSML.
    - **Unified Display**: Implements `displayPhoneme()` to ensure consistent `/phoneme/` notation across all views (Generator, Manager, Linking Modal).
    - **Sound Wall Manager**: Lists all `phonics_mappings`.
        - **Auto-Link**: Scans cache for missing audio based on phoneme text/SSML.
        - **Manual Link**: Modal for bulk-associating one audio file with multiple Sound Wall tiles.
    - **Storage Strategy**: Persistent storage of **Google Drive URLs** in the database. Optimizes DB performance compared to legacy Base64 embedding.
- **Audio Repository (`AudioManagementPage.tsx`)**:
    - **Central Hub**: Unified management of all Drive-stored audio for Phonics and Spelling.
    - **Repair Utility**: Logic to scan for legacy Base64 database entries and automatically reconnect them to physical Drive files by matching phoneme text.
    - **Manifest Export**: Capability to download a ZIP of all linked audio with a `manifest.json` and `index.csv`.
- **Student Hub (`PhonicsGameHub.tsx`)**:
    - **Components**: `SoundWall`, `BlendingBoard` (for dragging and combining phonetic sounds), and interactive quizzes (`PhonicsQuiz`).
- **Data & Security**:
    - **RLS Policy**: Fixed in `2026-04-02`. `phonics_mappings` now allows both `admin` and `class_staff` roles to manage records.
    - **Gamification**: Uses exact XP thresholds (`LEVEL_THRESHOLDS`) for levels and badges.

### Memorization / Saved (L90-L93)
- **Path**: `src/components/SavedContent/SavedContent.tsx`
- **Concept**: Allows Admins to create and manage text blocks for students to memorize.
- **Logic**: 
  - **Centralized Difficulty**: `MemorizationView.tsx` and `DictationView.tsx` enforce the student's `memorization_level` and hide selection buttons.
  - **Public Links**: Can generate `public_id` which allow accessing the text without logging in. Uses `appState = { page: 'publicPractice' }` inside `App.tsx` to handle these.

### Coin Service (L95-L99)
- **Path**: `src/services/coinService.ts`
- **Mechanism**: The single source of truth for awarding points.
- **Virtual Coins**: Hard limit of 3 "Answering Questions" real rewards per day. Calls `increment_room_coins` RPC which handles the actual increment and auto-logs a transaction in `student_records`.
- **Toilet Coins**: `deductToiletCoins(userId)` specialized logic to deduct 20 `toilet_coins` via `deduct_toilet_coins` RPC.
- **Revert System**: Tracks `_lastBatchId`. When reverting, updates `is_reverted = true` in `student_records` and deducts points. Keeps reverted records for 30 days.
- **Progress Synchronization**: Added in `2026-03-24`. The `rebuild_user_balances` RPC now aggregates reward coins from `spelling_practice_results`, `proofreading_practice_results`, and `reading_student_responses` to ensure balances accurately reflect actual student work.
- **Automated Awarding**: Frontend hooks in `SpellingPractice.tsx`, `ReadingChallenge.tsx`, and `ProofreadingPractice.tsx` now automatically trigger coin awards (via `mark_assignment_complete` or manual `increment_room_coins`) upon completion.

### Quiz System (L101-L105)
- **Path**: `src/pages/InteractiveScanQuizPage.tsx`
- **Concept**: Uses a device camera to scan AR tags held by students.
- **Tech**: Custom injected dictionary `DICT_4X4_1000`. Analyzes marker rotation to determine the answer (A, B, C, D).
- **Gotchas**: Modifies `AR` global object. Performance sensitive in `processFrame`.

### Spaced Repetition (L118-L123)
- **Path**: `src/pages/SpacedRepetitionPage.tsx` & `src/utils/spacedRepetitionAlgorithm.ts`
- **Concept**: Uses an adaptation of SuperMemo-2 (SM-2) algorithm. 
- **DB Mapping**: Saves tracking data and computes `next_review_date`, `interval`, and `ease_factor`. Includes `notion_page_id` to link back to source content.
- **Notion AI Elaboration**: "Elaborate" button in `QuestionCard.tsx` writes a help prompt directly to the source Notion page's `Explanation` property, triggering Notion AI for the teacher.
- **State Flow**: `SessionSummary` shows accuracy and metrics after completing a review round.

### Core Utilities (L113-L116)
- **Path**: `src/utils/roomGeometry.ts`, `src/utils/importParsers.ts`
- **Isometric Math**: `roomGeometry` handles conversion from 2D mouse coordinates to isometric grid tiles and calculates `zIndex` dynamically so avatars stand realistically behind or in front of furniture.
- **Data Ingestion**: `importParsers` processes bulk JSON formats for questions and memory data.

### Error Logger (L118-L121)
- **Path**: `src/services/errorLogger.ts`
- **Concept**: Development tool that parses exceptions and lint errors, sending them to the `dev_error_log` database table.
- **Security Check**: Strips patterns like API keys, Supabase tokens, passwords from error messages before saving.

### Timetable & Cycle System (L123-L128)
- **Path**: `src/pages/AdminTimetablePage.tsx`, `src/components/admin/TimetableBoard.tsx`
- **Concept**: Integrates school cycle data from Notion with customized class schedules.
- **Mechanism**:
  - **Notion Sync**: Edge Function `notion-api/get-cycle-day` fetches today's Cycle Day (1-6) and Cycle Number from a Notion database.
  - **Admin Table**: A comprehensive grid-based editor for Lessons 1-7 (Cycle-based) and Lessons 8-9 (Weekday-based).
  - **Dashboard Board**: Interactive board on the class dashboard that displays the current day's routine (English Reading, Recess, Lunch) and lesson subjects.
- **Database**: `class_timetables` stores subjects by `(class_name, lesson_number, day_index)`.

### DB & RPCs (L130-L135)
- **coin_transactions / student_records**: Unifies all point changes. 
- **`increment_room_coins(user_id, amount, reason, ...)`**: High-availability Postgres RPC that ensures atomicity when adding coins and logging. Overcomes concurrent request race conditions.
- **`rebuild_user_balances(p_user_id)`**: Completely reconstructs a user's balance by summing all manual records AND practice results (Spelling, Reading, Proofreading). Resolves desynchronization between display coins and progress.
- **`mark_assignment_complete(assignment_id, type)`**: Unified completion RPC that updates status AND awards appropriate `reward_coins` to the student, creating an auditable `student_record`.
- **`revert_student_record(record_id)`**: Backs out a previous transaction exactly. Supports bulk via `revert_student_records_batch`.
- **`award_dictation_bonus`**: Complex server-side logic assigning scale-based coins depending on dictation accuracy percentages.
- **Gotcha**: Auth search_path `pgcrypto` is in the `extensions` schema. Any auth-related DB function *must* have `search_path = public, extensions, pg_temp`.

### Spelling Practice (L151-L161)
- **Path**: `src/components/SpellingPractice/SpellingPractice.tsx`
- **Concept**: A pronunciation-based spelling game with levels (Letter clicking vs Typing).
- **Features**:
  - **Centralized Difficulty**: Difficulty is enforced from the student's profile (`spelling_level`); selection buttons are hidden in `SavedPractices.tsx` and the practice session.
  - **Level Switching**: Updated to allow Level 1 students to toggle between "Letter Click" (Level 1) and "Typing" (Level 2) modes.
  - **Dynamic Word Counts**: Users choose 10, 20, 40, or All words before starting (via `SavedPractices.tsx` prep-modal).
  - **Shuffling**: Words are randomized before the limit is applied.
  - **SRS Integration**: Connects to SM-2 algorithm via `SpellingSrsContext` for daily reviews.
  - **Accent Management**: Admins can select accents/voices via `AccentSelector`; hidden from students to prevent distraction.
- **Components**: `SpellingInput` (Creation), `SpellingPreview` (Admin verify), `SavedPractices` (The Hub/Review center).
  - **Preview Functionality**: `SpellingPreview.tsx` implements robust "Play All" logic using `useRef` to avoid async state closure issues and supports immediate stopping.

### Reading Practice & Notion Sync (L160-L178)
- **Files**: `src/components/ReadingPractice/`, `src/components/admin/ReadingNotionImporter.tsx`, `src/components/admin/ReadingPracticeCreator.tsx`, `src/components/admin/PassageCropCreator.tsx`
- **Concept**: Fetches reading materials from Notion and converts them into interactive "Speed Reading", "Proofreading", or "Advanced (Full Typing)" tests.
- **Mechanism**:
  - **Unified Creator**: `ReadingPracticeCreator.tsx` acts as the single entry point. It lists Notion database items (via `reading-api`) AND allows local PDF uploads.
  - **3-Way Mode Selection**: Supports **Unscramble**, **Proofreading**, and **Advanced** modes. It filters questions based on a `Mode` column in Notion.
  - **Importer**: `ReadingNotionImporter.tsx` processes Notion blocks into JSON structures stored in `reading_practices`.
  - **Passage Bulk Cropper**: `PassageCropCreator.tsx` enables staging crops for multiple days from PDFs.
    - **Dynamic Scaling**: "Fit-to-Width" logic ensures the PDF is fully viewable.
    - **Notion Integration**: Fetches Day-Page mappings to automate navigation.
    - **PDF Selector**: Searchable dropdown in the header allows manual selection of any PDF fetched from Notion, overriding the default day-mapping.
    - **Staging Queue**: Allows saving all crops at once to `reading_questions`.
    - **Bulk Select & Action Bar**: Added in `ReadingManagementPage.tsx` for passage crops. Allows batch assigning categories and bulk deletion with a sticky selection bar and "Select All" functionality.
- **Interaction Logic**:
  - **ReadingChallenge.tsx**: Supports three UI modes:
    - **Unscramble**: Draggable word tiles.
    - **Proofreading**: Identifying and correcting errors.
    - **Advanced**: Full text input area requiring verbatim typing of the target sentence.
  - **Level Enforcement**: Enforces `reading_rearranging_level` and `reading_proofreading_level` from student profile; mode is determined by the assignment's `interaction_type`.
- **Auth Protocol**: **CRITICAL**: All `supabase.functions.invoke` calls MUST pass explicit `Authorization` and `apikey` headers using the user's `session.access_token`.
- **Gotchas**: Uses `notion-api` and `reading-api` Edge Functions. `full-typing` requires exact string match (case-insensitive, normalized spaces).

### Google TTS & Drive Caching
- **Path**: `supabase/functions/google-tts/index.ts`
- **Concept**: "Generate-once, cache forever" architecture using Google Drive as persistent storage.
- **Mechanism**:
  - **Cache Key**: 4-column uniqueness on `(text, accent, voice_name, speaking_rate)` in `tts_cache`.
  - **Drive Storage**: MP3s are stored in **Google Shared Drive** (standard Folders have 0 quota for Service Accounts).
  - **Shared Drive Setup**: The `GOOGLE_DRIVE_FOLDER_ID` must be inside a Shared Drive, and the Service Account email must be added as a **Contributor**.
  - **Proxy Strategy (Fixed Playback)**: To bypass organizational restrictions that block public Drive links (`NotSupportedError`), the Edge Function **proxies** the audio. 
    - **`proxy_download` Action**: Takes a `fileId`, downloads from Drive internally, and returns content as **Base64** (`audioContent`).
  - **SSML Pass-through**: Added in `2026-03-31`. Detects `<speak>` tags for raw IPA synthesis.
  - **Overwrite Support**: Added in `2026-03-31`.
- **Frontend Utilities (`voiceManager.ts`)**:
  - `fetchCloudAudio`: Returns Base64 for standard spelling/reading views.
  - `fetchCloudAudioRich`: Returns both `audioUrl` (Drive) and `audioContent` (Base64). 
  - **`resolveAudioUrl(url)`**: Multi-source playback resolver. If URL is Drive link, calls `proxy_download` and caches the resulting Base64 locally. Ensures reliable playback of persistent Drive files.
- **Gotchas**: Requires `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`, and `GOOGLE_TTS_API_KEY` secrets. Ensures `supportsAllDrives=true` and `supportsTeamDrives=true` are set on all Drive API calls.

### iPad Interactive Zone (L218-L229)
- **Files**: `src/pages/IPadInteractiveZone.tsx`, `src/components/ipad/`
- **Concept**: Specialized handwriting and rhythm training for iPad/Apple Pencil users.
- **Features**:
  - **Pressure Sensitivity**: Uses `PointerEvent.pressure` for real-time feedback.
  - **Finger Training**: `FingerTraining.tsx` provides direct pressure control exercises with visual color-coded feedback (Blue/Green/Red).
  - **Cursive Rhythm Practice**: `CursivePlayer.tsx` and `RhythmEngine.ts` implement a gamified tracing system.
    - **Pressure Gate**: Guide mascot (Cat) pauses if the student's pressure is too light.
    - **Scoring**: Rhythm-based judgements (Perfect/Miss) and "Gentle Writer" bonuses.
  - **Admin Recorder**: `ExerciseRecorder.tsx` allows admins to demonstrate paths with "Magnetic Snapping" to template ink.
- **Data**: Exercises stored in `cursive_exercises`; student attempts and "Gentle" stats in `cursive_attempts`.

### Exam Paper Formatter (L231-L245)
- **Path**: `src/modules/exam-formatter/`
...
- **Components**: `Canvas`, `Toolbar`, `Sidebar`, `Inspector`, `BlockRenderer`, `NotionImportModal`.

### Vocab Image Picker (L259-L270)
- **Path**: `src/components/admin/VocabImagePicker.tsx`
- **Concept**: A tool for teachers to scrape license-safe images (CC0/PD) for vocabulary lists.
- **Mechanism**: 
  - **Edge Function Proxy**: Uses `image-search` Edge Function to search Wikimedia Commons and Openverse.
  - **Strict Licensing**: Filters for only CC0 and Public Domain licenses.
  - **Download Proxy**: Proxies actual image bytes through the Edge Function to bypass CORS during ZIP generation.
  - **Bulk Download**: Uses `jszip` to package selected images with a `selections.json` manifest.
- **Workflow**: Paste vocab list -> Search -> Select -> Download ZIP.

### Token Optimization (L246-L257)
- **Problem**: High context/token usage due to large file reads and verbose artifacts.
- **Rules**:
  1. **Targeted Edit**: Use `grep_search` and `multi_replace_file_content` for surgical changes. Avoid full file reads when possible.
  2. **Lean Artifacts**: Skip `implementation_plan.md` for routine fixes. Only use for complex refactors.
  3. **Context Reset**: Start a **New Chat** if the context becomes sluggish; work is saved in migrations/files.

---

- **Cognitive Anagram & Notion Logging (L290-L305)**
  - **Files**: `src/modules/anagram/AnagramApp.tsx`, `src/modules/anagram/services/notionLogger.ts`, `src/modules/anagram/components/PredictionScreen.tsx`
  - **UIReliability**: Enforces Section 1 (Task Identification) and Section 2 (Prediction Guidance) separation with explicit icon-based headers.
  - **DataPriority**: UI prioritizes `cmsContent` to ensure researcher edits in the Admin Panel are never overridden by hardcoded defaults.
  - **Logging**: Automated data collection to Notion for both Runs and Responses.

