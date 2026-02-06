# Plan: Merge City Editor and Region Editor

## Objective
Consolidate `CityEditorModal` and `DistrictEditorModal` into a unified `MapEditor` system. This will reduce code duplication, ensure consistent UI/UX, and make it easier to add new editor features in the future.

## Strategy
We will extract the common "Editor Shell" (Modal, Layout, Sidebar, Header) into reusable components, while keeping the domain-specific logic (Data fetching, State management, Canvas rendering) in specific adapter components.

## New Component Structure

### 1. `MapEditorShell` (New Component)
A generic layout component that handles:
-   Modal overlay and animation
-   Header layout (Title, Save/Close buttons, Custom actions slot)
-   Sidebar layout (Tabs navigation, Panel content area)
-   Main content area (The wrapper for the Map canvas)

**Props:**
```typescript
interface MapEditorShellProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  
  // Header
  headerActions?: React.ReactNode; // For user/region selectors, Reset buttons
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSave?: () => void;
  
  // Sidebar
  tabs: EditorTab[]; // { id: string, label: string, icon: Icon }
  activeTabId: string;
  onTabChange: (id: string) => void;
  sidebarContent: React.ReactNode; // The content of the active sidebar panel
  
  // Main Content
  children: React.ReactNode; // The Map component
}
```

### 2. Refactored `CityEditorModal`
Will become a wrapper around `MapEditorShell`.
-   **State**: Uses `useAdminCityLayout`.
-   **Render**: Passes `AdminCityMap` as children to the Shell.
-   **Sidebar**: Renders the specific panels (Buildings, Decorations, Style) based on the active tab.

### 3. Refactored `DistrictEditorModal`
Will become a wrapper around `MapEditorShell`.
-   **State**: Uses `useAdminRegionLayout`.
-   **Render**: Passes `AdminRegionMap` as children to the Shell.
-   **Sidebar**: Renders the specific panels (Facilities, Regions, Settings) based on the active tab.

## Implementation Steps

### Phase 1: Create the Shell
1.  Create `src/components/map-editor/MapEditorShell.tsx`.
2.  Extract the CSS/Tailwind classes from `CityEditorModal` (since it looks like the source of truth for the design).
3.  Implement the standard layout.

### Phase 2: Create Reusable UI Parts
1.  **`EditorPanel`**: Standard wrapper for sidebar panel content (Title, content container).
2.  **`AssetGrid`**: Reusable grid for selecting assets (used in both Building list and Map Assets).
3.  **`PropertyField`**: Standard label + input wrapper.

### Phase 3: Refactor CityEditorModal
1.  Replace the internal layout of `CityEditorModal` with `MapEditorShell`.
2.  Ensure all functionality (User selection, AI Generator, Transforms) works as before.
3.  Verify "Save" and "Reset" flows.

### Phase 4: Refactor DistrictEditorModal
1.  Replace the internal layout of `DistrictEditorModal` with `MapEditorShell`.
2.  Ensure Region selection and Facility management works as before.

## Benefits
-   **Single Source of Truth**: UI updates (e.g., changing the sidebar color or header height) only need to happen in one place.
-   **Shared Features**: Features like "AI Generator" or "Background Removal" can be more easily enabled for both editors if moved to the Shell or common panels.
-   **Cleaner Code**: The specific editor files will become much smaller, focusing only on business logic.
