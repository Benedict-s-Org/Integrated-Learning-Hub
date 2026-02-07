# UI Design Panel - Implementation Plan

## Overview
Create an admin UI panel that allows real-time customization of the platform's color theme and style, with the ability to save and apply presets.

---

## Current System Analysis

### Existing Architecture
- **CSS Variables**: HSL-based colors defined in `src/index.css` (`:root` block)
- **Tailwind Config**: Maps CSS variables to Tailwind utility classes
- **Color Categories**:
  - Core: `background`, `foreground`, `card`, `popover`
  - Brand: `primary`, `secondary`, `accent`
  - UI: `muted`, `border`, `input`, `ring`, `destructive`
  - Special: `panel-bg`, `panel-border`, `city-*`

### Key Variables to Expose
```css
--primary: 15 85% 65%;          /* Main brand color */
--secondary: 35 70% 94%;        /* Secondary backgrounds */
--accent: 335 85% 75%;          /* Highlight/CTA color */
--background: 35 100% 99%;      /* Page background */
--foreground: 220 20% 10%;      /* Text color */
--border: 15 20% 90%;           /* Border color */
--radius: 1rem;                 /* Corner roundness */
```

---

## Feature Design

### 1. Theme Editor Panel
A dedicated admin page with sections for:

#### Color Controls
| Control | Type | CSS Variable |
|---------|------|--------------|
| Primary Color | Color Picker | `--primary` |
| Accent Color | Color Picker | `--accent` |
| Background | Color Picker | `--background` |
| Text Color | Color Picker | `--foreground` |
| Border Color | Color Picker | `--border` |

#### Style Controls
| Control | Type | CSS Variable |
|---------|------|--------------|
| Corner Radius | Slider (0-2rem) | `--radius` |
| Font Family | Dropdown | Body font |
| Dark Mode | Toggle | `.dark` class |

### 2. Live Preview
- Split-screen view with editor on left, preview on right
- Preview shows sample UI components in real-time
- Components: Buttons, cards, inputs, navigation

### 3. Theme Presets
Pre-built themes users can apply instantly:

| Preset | Style |
|--------|-------|
| 🍑 Peach (Default) | Warm, cute, current theme |
| 🌊 Ocean | Cool blues and teals |
| 🌲 Forest | Earthy greens and browns |
| 🌸 Sakura | Soft pinks and whites |
| 🌙 Midnight | Dark mode, purple accents |
| 🎨 Custom | User-defined |

### 4. Save & Sync
- Save custom themes to database
- Apply theme globally for all users (admin only)
- Allow user-specific theme preferences (optional)

---

## Database Schema

### New Table: `ui_themes`
```sql
CREATE TABLE ui_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,  -- Built-in presets
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Color values (HSL format: "H S% L%")
    color_primary TEXT NOT NULL,
    color_secondary TEXT NOT NULL,
    color_accent TEXT NOT NULL,
    color_background TEXT NOT NULL,
    color_foreground TEXT NOT NULL,
    color_border TEXT NOT NULL,
    color_muted TEXT,
    color_destructive TEXT,
    
    -- Style values
    border_radius TEXT DEFAULT '1rem',
    font_family TEXT DEFAULT 'Outfit',
    
    -- Dark mode variant
    dark_mode_colors JSONB
);
```

### New Table: `user_preferences`
```sql
-- Add column to existing users table OR create new table
ALTER TABLE users ADD COLUMN theme_id UUID REFERENCES ui_themes(id);
```

---

## Component Architecture

```
src/components/admin/
├── ThemeDesigner/
│   ├── ThemeDesigner.tsx       # Main container
│   ├── ColorPicker.tsx         # HSL color picker with preview
│   ├── StyleControls.tsx       # Radius, font controls
│   ├── ThemePreview.tsx        # Live preview panel
│   ├── PresetSelector.tsx      # Theme preset cards
│   └── ThemeActions.tsx        # Save, reset, apply buttons
│
└── hooks/
    └── useTheme.ts             # Context + persistence logic
```

---

## Implementation Steps

### Phase 1: Core Infrastructure (Day 1)
1. [ ] Create `useTheme` hook with CSS variable manipulation
2. [ ] Create `ThemeContext` provider
3. [ ] Add theme storage service (localStorage + Supabase)

### Phase 2: UI Components (Day 2)
4. [ ] Build `ColorPicker` component (HSL-based)
5. [ ] Build `StyleControls` component
6. [ ] Build `ThemePreview` component with sample elements

### Phase 3: Theme Editor Page (Day 3)
7. [ ] Create `ThemeDesigner` main component
8. [ ] Add to admin navigation
9. [ ] Implement live preview synchronization

### Phase 4: Presets & Persistence (Day 4)
10. [ ] Create database migration for `ui_themes`
11. [ ] Build preset theme cards
12. [ ] Implement save/load functionality
13. [ ] Add "Apply to Platform" admin action

### Phase 5: Polish (Day 5)
14. [ ] Add undo/redo for theme changes
15. [ ] Add export/import theme JSON
16. [ ] Implement user-specific theme preferences
17. [ ] Add accessibility contrast checker

---

## Technical Notes

### Applying Theme Changes
```typescript
// Update CSS variables dynamically
function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.colorPrimary);
    root.style.setProperty('--accent', theme.colorAccent);
    // ... etc
}
```

### HSL Color Format
Using HSL for easier manipulation:
- **H** (Hue): 0-360 degrees
- **S** (Saturation): 0-100%
- **L** (Lightness): 0-100%

Stored without `hsl()` wrapper for Tailwind compatibility:
```css
--primary: 15 85% 65%;  /* Not hsl(15, 85%, 65%) */
```

### Accessibility Considerations
- Minimum contrast ratio: 4.5:1 for normal text
- Warn users when contrast is too low
- Provide colorblind-friendly preset options

---

## Example Preset Themes

### 🍑 Peach (Current Default)
```css
--primary: 15 85% 65%;
--secondary: 35 70% 94%;
--accent: 335 85% 75%;
--background: 35 100% 99%;
```

### 🌊 Ocean
```css
--primary: 200 80% 50%;
--secondary: 190 60% 92%;
--accent: 170 70% 45%;
--background: 200 30% 98%;
```

### 🌸 Sakura
```css
--primary: 340 70% 75%;
--secondary: 350 50% 95%;
--accent: 320 60% 65%;
--background: 350 100% 99%;
```

### 🌙 Midnight
```css
--primary: 260 70% 65%;
--secondary: 250 30% 20%;
--accent: 280 80% 70%;
--background: 240 20% 8%;
--foreground: 0 0% 95%;
```

---

## Success Criteria
- [ ] Admin can change all major colors from UI
- [ ] Changes preview in real-time
- [ ] Themes can be saved and named
- [ ] One-click preset application
- [ ] Theme persists across page reloads
- [ ] Optional: Per-user theme preferences

---

## Estimated Effort
- **Total**: ~5 days
- **Priority**: Medium (enhancement, not critical)
- **Dependencies**: None (uses existing CSS variable system)
