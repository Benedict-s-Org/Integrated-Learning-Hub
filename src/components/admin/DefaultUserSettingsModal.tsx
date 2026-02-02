import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  Loader2, 
  Save,
  RotateCcw,
  User,
  Coins,
  Home,
  Package,
  Palette,
  MessageSquare,
  Wand2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FURNITURE_CATALOG } from '@/constants/furnitureCatalog';
import { HOUSE_LEVELS } from '@/constants/houseLevels';
import { BackgroundRemovalEditor } from '@/components/common/BackgroundRemovalEditor';

interface DefaultUserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsState {
  avatar_male: { url: string | null };
  avatar_female: { url: string | null };
  initial_coins: { value: number };
  initial_house_level: { value: number };
  initial_inventory: { items: string[] };
  default_floor: { id: string | null };
  default_wall: { id: string | null };
  welcome_message: { text: string };
}

const DEFAULT_SETTINGS: SettingsState = {
  avatar_male: { url: null },
  avatar_female: { url: null },
  initial_coins: { value: 0 },
  initial_house_level: { value: 0 },
  initial_inventory: { items: ["hk_stool", "hk_table", "hk_bed", "basement_stairs"] },
  default_floor: { id: null },
  default_wall: { id: null },
  welcome_message: { text: "歡迎來到記憶宮殿！" },
};

export function DefaultUserSettingsModal({ isOpen, onClose }: DefaultUserSettingsModalProps) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingMale, setUploadingMale] = useState(false);
  const [uploadingFemale, setUploadingFemale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Background removal states
  const [bgRemovalImage, setBgRemovalImage] = useState<string | null>(null);
  const [bgRemovalTarget, setBgRemovalTarget] = useState<'male' | 'female' | null>(null);
  
  const maleInputRef = useRef<HTMLInputElement>(null);
  const femaleInputRef = useRef<HTMLInputElement>(null);

  // Fetch current settings
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('default_user_settings')
        .select('setting_key, setting_value');
      
      if (error) throw error;
      
      if (data) {
        const loadedSettings = { ...DEFAULT_SETTINGS };
        data.forEach((row) => {
          const key = row.setting_key as keyof SettingsState;
          if (key in loadedSettings) {
            loadedSettings[key] = row.setting_value as SettingsState[typeof key];
          }
        });
        setSettings(loadedSettings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('無法載入設定');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Update each setting
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
      }));
      
      for (const update of updates) {
        const { error } = await supabase
          .from('default_user_settings')
          .update({ 
            setting_value: update.setting_value, 
            updated_at: update.updated_at 
          })
          .eq('setting_key', update.setting_key);
        
        if (error) throw error;
      }
      
      setSuccess('設定已儲存');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('儲存設定失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File, gender: 'male' | 'female') => {
    const isUploading = gender === 'male' ? setUploadingMale : setUploadingFemale;
    isUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `default-avatar-${gender}-${Date.now()}.${fileExt}`;
      const filePath = `defaults/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      setSettings(prev => ({
        ...prev,
        [gender === 'male' ? 'avatar_male' : 'avatar_female']: { url: publicUrl }
      }));
    } catch (err) {
      console.error('Upload error:', err);
      setError('上傳失敗');
    } finally {
      isUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, gender: 'male' | 'female') => {
    const file = e.target.files?.[0];
    if (file) {
      handleAvatarUpload(file, gender);
    }
    e.target.value = '';
  };

  const handleRemoveAvatar = (gender: 'male' | 'female') => {
    setSettings(prev => ({
      ...prev,
      [gender === 'male' ? 'avatar_male' : 'avatar_female']: { url: null }
    }));
  };

  const handleInventoryToggle = (itemId: string) => {
    setSettings(prev => {
      const items = prev.initial_inventory.items;
      const newItems = items.includes(itemId)
        ? items.filter(id => id !== itemId)
        : [...items, itemId];
      return {
        ...prev,
        initial_inventory: { items: newItems }
      };
    });
  };

  const handleResetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };
  
  const handleOpenBgRemoval = (gender: 'male' | 'female') => {
    const url = gender === 'male' ? settings.avatar_male.url : settings.avatar_female.url;
    if (url) {
      setBgRemovalImage(url);
      setBgRemovalTarget(gender);
    }
  };
  
  const handleBgRemovalApply = async (processedDataUrl: string) => {
    if (!bgRemovalTarget) return;
    
    const isUploading = bgRemovalTarget === 'male' ? setUploadingMale : setUploadingFemale;
    isUploading(true);
    
    try {
      // Convert data URL to blob
      const response = await fetch(processedDataUrl);
      const blob = await response.blob();
      
      const fileName = `default-avatar-${bgRemovalTarget}-${Date.now()}.png`;
      const filePath = `defaults/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { 
          upsert: true,
          contentType: 'image/png'
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      setSettings(prev => ({
        ...prev,
        [bgRemovalTarget === 'male' ? 'avatar_male' : 'avatar_female']: { url: publicUrl }
      }));
      
      setBgRemovalImage(null);
      setBgRemovalTarget(null);
    } catch (err) {
      console.error('Error uploading processed image:', err);
      setError('上傳處理後的圖片失敗');
    } finally {
      isUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            預設使用者設定
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : (
            <>
              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-lg bg-green-500/10 text-green-600 text-sm">
                  {success}
                </div>
              )}

              {/* Avatar Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <User className="w-4 h-4" />
                  <h3 className="font-medium">角色外觀</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Male Avatar */}
                  <div className="space-y-2">
                    <label className="text-sm text-[hsl(var(--muted-foreground))]">
                      預設 Avatar (男)
                    </label>
                    <div className="aspect-square rounded-lg border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center overflow-hidden bg-[hsl(var(--muted))]">
                      {settings.avatar_male.url ? (
                        <img 
                          src={settings.avatar_male.url} 
                          alt="Male avatar" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <User className="w-12 h-12 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={maleInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'male')}
                      />
                      <button
                        onClick={() => maleInputRef.current?.click()}
                        disabled={uploadingMale}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                      >
                        {uploadingMale ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        上傳
                      </button>
                      {settings.avatar_male.url && (
                        <>
                          <button
                            onClick={() => handleOpenBgRemoval('male')}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                            title="去背"
                          >
                            <Wand2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemoveAvatar('male')}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-lg border border-[hsl(var(--destructive))] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)]"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Female Avatar */}
                  <div className="space-y-2">
                    <label className="text-sm text-[hsl(var(--muted-foreground))]">
                      預設 Avatar (女)
                    </label>
                    <div className="aspect-square rounded-lg border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center overflow-hidden bg-[hsl(var(--muted))]">
                      {settings.avatar_female.url ? (
                        <img 
                          src={settings.avatar_female.url} 
                          alt="Female avatar" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <User className="w-12 h-12 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={femaleInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'female')}
                      />
                      <button
                        onClick={() => femaleInputRef.current?.click()}
                        disabled={uploadingFemale}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                      >
                        {uploadingFemale ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        上傳
                      </button>
                      {settings.avatar_female.url && (
                        <>
                          <button
                            onClick={() => handleOpenBgRemoval('female')}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                            title="去背"
                          >
                            <Wand2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemoveAvatar('female')}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-lg border border-[hsl(var(--destructive))] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)]"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Economic Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <Coins className="w-4 h-4" />
                  <h3 className="font-medium">經濟設定</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-[hsl(var(--muted-foreground))]">
                      初始金幣
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.initial_coins.value}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        initial_coins: { value: Math.max(0, parseInt(e.target.value) || 0) }
                      }))}
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[hsl(var(--muted-foreground))]">
                      房屋等級
                    </label>
                    <select
                      value={settings.initial_house_level.value}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        initial_house_level: { value: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                    >
                      {HOUSE_LEVELS.map((level) => (
                        <option key={level.level} value={level.level}>
                          {level.name} (Lv.{level.level})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Inventory Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <Package className="w-4 h-4" />
                  <h3 className="font-medium">初始家具</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {FURNITURE_CATALOG.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        settings.initial_inventory.items.includes(item.id)
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]'
                          : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={settings.initial_inventory.items.includes(item.id)}
                        onChange={() => handleInventoryToggle(item.id)}
                        className="rounded border-[hsl(var(--input))]"
                      />
                      <span className="text-sm text-[hsl(var(--foreground))] truncate">
                        {item.name}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Room Decoration Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <Palette className="w-4 h-4" />
                  <h3 className="font-medium">房間裝潢</h3>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  預設地板和牆壁材質可在「空間設計中心」上傳後選擇 ID 設定。
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-[hsl(var(--muted-foreground))]">
                      預設地板 ID
                    </label>
                    <input
                      type="text"
                      value={settings.default_floor.id || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        default_floor: { id: e.target.value || null }
                      }))}
                      placeholder="留空使用系統預設"
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[hsl(var(--muted-foreground))]">
                      預設牆壁 ID
                    </label>
                    <input
                      type="text"
                      value={settings.default_wall.id || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        default_wall: { id: e.target.value || null }
                      }))}
                      placeholder="留空使用系統預設"
                      className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                    />
                  </div>
                </div>
              </section>

              {/* Other Settings Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <MessageSquare className="w-4 h-4" />
                  <h3 className="font-medium">其他設定</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[hsl(var(--muted-foreground))]">
                    歡迎訊息
                  </label>
                  <input
                    type="text"
                    value={settings.welcome_message.text}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      welcome_message: { text: e.target.value }
                    }))}
                    placeholder="新用戶首次登入時顯示的訊息"
                    className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[hsl(var(--border))]">
          <button
            onClick={handleResetToDefaults}
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            重設為系統預設
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            儲存設定
          </button>
        </div>
      </div>
      
      {/* Background Removal Editor */}
      {bgRemovalImage && bgRemovalTarget && (
        <BackgroundRemovalEditor
          imageUrl={bgRemovalImage}
          isOpen={true}
          onClose={() => {
            setBgRemovalImage(null);
            setBgRemovalTarget(null);
          }}
          onApply={handleBgRemovalApply}
        />
      )}
    </div>
  );
}
