import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { NavigationSettings, UserProfile } from '@/types';

const DEFAULT_SETTINGS: NavigationSettings = {
  learning: [
    {id: "classDashboard", label: "Class Dashboard", visible: false},
    {id: "new", label: "Paragraph Memorization", visible: false},
    {id: "proofreading", label: "Proofreading Exercise", visible: false},
    {id: "spelling", label: "Spelling Practice", visible: false},
    {id: "spacedRepetition", label: "Spaced Repetition", visible: false},
    {id: "readingComprehension", label: "Reading Practice", visible: false},
    {id: "wordSnake", label: "iPad Interactive Zone", visible: false},
    {id: "learningHub", label: "Learning Hub", visible: false},
    {id: "notionHub", label: "Notion Hub", visible: false},
    {id: "phonics", label: "Sound Wall", visible: false},
    {id: "interactiveScanner", label: "QR Up!", visible: false}
  ],
  progress: [
    {id: "progress", label: "Progress", visible: false},
    {id: "assignments", label: "Assignments", visible: false},
    {id: "saved", label: "Saved Content", visible: false}
  ],
  admin: [
    {id: "adminUsers", label: "Admin Panel", visible: false},
    {id: "adminAnalytics", label: "Analytics Dashboard (Beta)", visible: false},
    {id: "superAdmin", label: "Super Admin Panel", visible: false},
    {id: "homeworkRecord", label: "Homework Record", visible: false},
    {id: "timetable", label: "Timetable Management", visible: false},
    {id: "broadcast", label: "Broadcast Management", visible: false},
    {id: "progressLog", label: "Progress Log (Coin History)", visible: false},
    {id: "assignmentManagement", label: "Assignment Management", visible: false},
    {id: "readingManagement", label: "Reading Practice Management", visible: false},
    {id: "interactiveScannerAdmin", label: "Interactive Scanner", visible: false},
    {id: "markerGenerator", label: "Marker Generator", visible: false},
    {id: "legacyScanner", label: "Legacy QR Scanner", visible: false},
    {id: "furnitureStudio", label: "Furniture Studio", visible: false},
    {id: "assetUploader", label: "Asset Uploader", visible: false},
    {id: "furnitureEditor", label: "Furniture Editor", visible: false},
    {id: "spaceDesign", label: "Space Design Center", visible: false},
    {id: "mapEditor", label: "Map Editor", visible: false},
    {id: "aiIllustrator", label: "AI Illustrator (Flowith)", visible: false},
    {id: "multiFormatUpload", label: "Multi-format Upload", visible: false},
    {id: "uiBuilder", label: "UI Builder", visible: false},
    {id: "themeDesigner", label: "Theme Designer", visible: false},
    {id: "avatarBuilderStudio", label: "Avatar Builder Studio", visible: false},
    {id: "avatarAssetManager", label: "Avatar Asset Manager", visible: false},
    {id: "legacyDashboard", label: "Legacy Dashboard", visible: false},
    {id: "groupCompetition", label: "Group Competition (6-Lane)", visible: false},
    {id: "database", label: "Database", visible: false},
    {id: "userProgress", label: "User Progress", visible: false},
    {id: "mobileTest", label: "Mobile Test", visible: false}
  ],
  teacher: [
    {id: "teacherPlaceholder", label: "(Add new tools here)", visible: true}
  ]
};

interface NavigationSettingsContextType {
  settings: NavigationSettings;
  updateSettings: (section: keyof NavigationSettings, itemId: string, visible: boolean) => void;
  saveSettings: () => Promise<void>;
  resetSettings: () => Promise<void>;
  isItemVisible: (itemId: string, userOverride?: UserProfile | null) => boolean;
  updateUserPermissions: (userId: string, permissions: Record<string, boolean>) => Promise<void>;
}

const NavigationSettingsContext = createContext<NavigationSettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => { },
  saveSettings: async () => { },
  resetSettings: async () => { },
  isItemVisible: () => true,
  updateUserPermissions: async () => { },
});

export const useNavigationSettings = () => useContext(NavigationSettingsContext);

export const NavigationSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<NavigationSettings>(DEFAULT_SETTINGS);
  const { user, session, profileLoaded } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await (supabase
          .from('system_config' as any)
          .select('value')
          .eq('key', 'navigation_settings') as any)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            console.error('Error fetching navigation settings:', error);
          }
          return;
        }

        if (data && (data as any).value) {
          try {
            const parsed = JSON.parse((data as any).value);
            // Merge with defaults to ensure new sections/items are included
            setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          } catch (e) {
            console.error('Error parsing navigation settings JSON:', e);
          }
        }
      } catch (err) {
        console.error('Error in fetchSettings:', err);
      }
    };

    fetchSettings();
  }, []);

  // Subscribe to real-time changes
  useEffect(() => {
    const subscription = supabase
      .channel('public:system_config_nav')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_config',
          filter: "key=eq.navigation_settings",
        },
        (payload: any) => {
          const newValue = payload.new.value;
          if (newValue) {
            try {
              const parsed = JSON.parse(newValue);
              // Merge with defaults to ensure new sections/items are included
              setSettings({ ...DEFAULT_SETTINGS, ...parsed });
            } catch (e) {
              console.error('Error parsing navigation settings update:', e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const updateSettings = useCallback((section: keyof NavigationSettings, itemId: string, visible: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [section]: prev[section].map((item) =>
        item.id === itemId ? { ...item, visible } : item
      ),
    }));
  }, []);

  const saveSettings = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { error } = await (supabase
        .from('system_config' as any)
        .update({ value: JSON.stringify(settings) }) as any)
        .eq('key', 'navigation_settings');

      if (error) throw error;
    } catch (err) {
      console.error('Error saving navigation settings:', err);
      throw err;
    }
  }, [settings, isAdmin]);

  const resetSettings = useCallback(async () => {
    if (!isAdmin) return;
    setSettings(DEFAULT_SETTINGS);
    try {
      const { error } = await (supabase
        .from('system_config' as any)
        .update({ value: JSON.stringify(DEFAULT_SETTINGS) }) as any)
        .eq('key', 'navigation_settings');

      if (error) throw error;
    } catch (err) {
      console.error('Error resetting navigation settings:', err);
    }
  }, [isAdmin]);

  const updateUserPermissions = useCallback(async (userId: string, permissions: Record<string, boolean>) => {
    if (!user || user.role !== 'admin') return;
    try {
      const anonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
      const { data, error } = await supabase.functions.invoke('user-management/update-user', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: {
          action: 'update-user',
          adminUserId: user.id,
          userId,
          navigation_permissions: permissions
        }
      });

      if (error) throw error;
      console.log(`[NavigationSettings] Successfully updated permissions for ${userId} via Edge Function`);
    } catch (err) {
      console.error('[NavigationSettings] Error updating user permissions via Edge Function:', err);
      throw err;
    }
  }, [user, session]);

  const isItemVisible = useCallback((itemId: string, userOverride?: UserProfile | null): boolean => {
    // 1. Get the target user context
    const targetUser = userOverride || user;

    // 2. Admins ALWAYS see everything (unless we are specifically overriding with a non-admin user)
    if (targetUser?.role === 'admin') {
      return true;
    }

    // 3. Check user-specific permissions for students/staff
    let result: boolean | undefined = undefined;
    const perms = targetUser?.navigation_permissions || (targetUser as any)?.navigation_permissions;

    if (perms) {
      if (Array.isArray(perms)) {
        // Handle array of strings format
        result = perms.includes(itemId);
      } else if (typeof perms === 'object') {
        // Handle boolean map format
        result = perms[itemId];
      }
    }

    // 4. Fallback to global settings if no explicit user permission found
    if (result === undefined) {
      for (const section of Object.values(settings)) {
        const item = section.find((i: any) => i.id === itemId);
        if (item) {
          result = item.visible;
          break;
        }
      }
    }

    // Final fallback: If not found in user perms OR global settings, default to false for safety
    if (result === undefined) result = false;

    if (itemId !== 'adminUsers') { // Skip noise from admin panel checks
      const color = result ? 'color: #10b981' : 'color: #ef4444';
      console.log(`%c[Navigation] ID: ${itemId}, User: ${targetUser?.username || 'Guest'}, Role: ${targetUser?.role || 'none'}, Visible: ${result}`, `font-weight: bold; ${color}`);
    }
    
    return result;
  }, [settings, user, profileLoaded]);

  return (
    <NavigationSettingsContext.Provider value={{ 
      settings, 
      updateSettings, 
      saveSettings, 
      resetSettings, 
      isItemVisible,
      updateUserPermissions
    }}>
      {children}
    </NavigationSettingsContext.Provider>
  );
};
