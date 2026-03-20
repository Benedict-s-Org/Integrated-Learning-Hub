import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { NavigationSettings, UserProfile } from '@/types';

const DEFAULT_SETTINGS: NavigationSettings = {
  learning: [
    {id: "classDashboard", label: "Class Dashboard", visible: true},
    {id: "new", label: "Paragraph Memorization", visible: true},
    {id: "proofreading", label: "Proofreading Exercise", visible: true},
    {id: "spelling", label: "Spelling Practice", visible: true},
    {id: "spacedRepetition", label: "Spaced Repetition", visible: true},
    {id: "readingComprehension", label: "Reading Practice", visible: true},
    {id: "wordSnake", label: "iPad Interactive Zone", visible: true},
    {id: "learningHub", label: "My Learning Community", visible: true},
    {id: "notionHub", label: "Notion Hub", visible: true},
    {id: "phonics", label: "Phonics Sound Wall", visible: true},
    {id: "interactiveScanner", label: "QR Up!", visible: true}
  ],
  progress: [
    {id: "progress", label: "Progress", visible: true},
    {id: "assignments", label: "Assignments", visible: true},
    {id: "saved", label: "Saved Content", visible: true}
  ],
  admin: [
    {id: "adminUsers", label: "Admin Panel", visible: true},
    {id: "adminAnalytics", label: "Analytics Dashboard (Beta)", visible: true},
    {id: "superAdmin", label: "Super Admin Panel", visible: true},
    {id: "homeworkRecord", label: "Homework Record", visible: true},
    {id: "timetable", label: "Timetable Management", visible: true},
    {id: "broadcast", label: "Broadcast Management", visible: true},
    {id: "assignmentManagement", label: "Assignment Management", visible: true},
    {id: "readingManagement", label: "Reading Practice Management", visible: true},
    {id: "interactiveScannerAdmin", label: "Interactive Scanner", visible: true},
    {id: "markerGenerator", label: "Marker Generator", visible: true},
    {id: "legacyScanner", label: "Legacy QR Scanner", visible: true},
    {id: "furnitureStudio", label: "Furniture Studio", visible: true},
    {id: "assetUploader", label: "Asset Uploader", visible: true},
    {id: "furnitureEditor", label: "Furniture Editor", visible: true},
    {id: "spaceDesign", label: "Space Design Center", visible: true},
    {id: "mapEditor", label: "Map Editor", visible: true},
    {id: "aiIllustrator", label: "AI Illustrator (Flowith)", visible: true},
    {id: "multiFormatUpload", label: "Multi-format Upload", visible: true},
    {id: "uiBuilder", label: "UI Builder", visible: true},
    {id: "themeDesigner", label: "Theme Designer", visible: true},
    {id: "avatarBuilderStudio", label: "Avatar Builder Studio", visible: true},
    {id: "avatarAssetManager", label: "Avatar Asset Manager", visible: true},
    {id: "legacyDashboard", label: "Legacy Dashboard", visible: true},
    {id: "groupCompetition", label: "Group Competition (6-Lane)", visible: true},
    {id: "database", label: "Database", visible: true},
    {id: "userProgress", label: "User Progress", visible: true},
    {id: "mobileTest", label: "Mobile Test", visible: true}
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
  const { user } = useAuth();
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
            setSettings(parsed);
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
              setSettings(parsed);
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
    if (!isAdmin) return;
    try {
      const { error } = await (supabase
        .from('users' as any)
        .update({ navigation_permissions: permissions } as any) as any)
        .eq('id', userId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating user permissions:', err);
      throw err;
    }
  }, [isAdmin]);

  const isItemVisible = useCallback((itemId: string, userOverride?: UserProfile | null): boolean => {
    // 1. Check user-specific permissions first
    const targetUser = userOverride || user;
    if (targetUser?.navigation_permissions && targetUser.navigation_permissions[itemId] !== undefined) {
      return targetUser.navigation_permissions[itemId];
    }

    // 2. Fallback to global settings
    for (const section of Object.values(settings)) {
      const item = section.find((i: any) => i.id === itemId);
      if (item) return item.visible;
    }
    return true; // Default to visible if not found
  }, [settings, user]);

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
