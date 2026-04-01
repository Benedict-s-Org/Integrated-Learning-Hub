import React, { useState, useRef } from "react";
import { X, Loader2, Upload, Trash2, User, Mail, Lock, Image, Wand2, Shield, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundRemovalEditor } from "@/components/common/BackgroundRemovalEditor";
import { dataUrlToFile } from "@/utils/imageProcessing";
import { useAuth } from "@/context/AuthContext";

interface UserWithProfile {
  id: string;
  email: string;
  auth_email?: string;
  display_name: string | null;
  avatar_url?: string | null;
  created_at: string;
  is_admin: boolean;
  class_number: number | null;
  class_name?: string | null;
  spelling_level?: number;
  reading_rearranging_level?: number;
  reading_proofreading_level?: number;
  memorization_level?: number;
  proofreading_level?: number;
  ecas?: string[];
  accent_preference?: string;
  voice_preference?: {
    voiceName: string;
    voiceLang: string;
    voiceURI: string;
  } | null;
}

interface UserEditModalProps {
  user: UserWithProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  adminUserId: string;
}

export function UserEditModal({ user, isOpen, onClose, onSuccess, adminUserId }: UserEditModalProps) {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null);
  const [role, setRole] = useState<'admin' | 'class_staff' | 'user'>(
    (user as any).role || (user.is_admin ? 'admin' : 'user')
  );
  const [className, setClassName] = useState(user.class_name || "");
  const [classNumber, setClassNumber] = useState<string>(user.class_number?.toString() || "");
  const [ecas, setEcas] = useState<string[]>(user.ecas || []);
  const [availableActivities, setAvailableActivities] = useState<{ id: string, name: string }[]>([]);
  const [availableClasses, setAvailableClasses] = useState<{ id: string, name: string }[]>([]);
  const [managedClasses, setManagedClasses] = useState<string[]>([]);
  const [spellingLevel, setSpellingLevel] = useState<number>(user.spelling_level || 1);
  const [readingRearrangingLevel, setReadingRearrangingLevel] = useState<number>(user.reading_rearranging_level || 1);
  const [readingProofreadingLevel, setReadingProofreadingLevel] = useState<number>(user.reading_proofreading_level || 1);
  const [memorizationLevel, setMemorizationLevel] = useState<number>(user.memorization_level || 1);
  const [proofreadingLevel, setProofreadingLevel] = useState<number>(user.proofreading_level || 1);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        // Fetch activities
        const { data: activities } = await (supabase as any).from('activities').select('id, name').order('name');
        if (activities) setAvailableActivities(activities);

        // Fetch all available classes
        const { data: classes } = await (supabase as any).from('classes').select('id, name').order('name');
        if (classes) setAvailableClasses(classes as { id: string, name: string }[]);

        // Fetch staff assignments if they are class_staff
        if (role === 'class_staff') {
          setIsLoadingAssignments(true);
          try {
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const { data } = await supabase.functions.invoke('user-management/get-staff-assignments', {
              headers: {
                'Authorization': `Bearer ${session?.access_token || anonKey}`,
                'apikey': anonKey
              },
              body: { userId: user.id }
            });
            if (data?.assignments) {
              setManagedClasses(data.assignments);
            }
          } catch (err) {
            console.error("Failed to fetch staff assignments:", err);
          } finally {
            setIsLoadingAssignments(false);
          }
        }
      };
      fetchData();
    }
  }, [isOpen]); // Only fetch on open. If role changes during edit, classes are already available.

  if (!isOpen) return null;

  const toggleEca = (activityName: string) => {
    setEcas(prev =>
      prev.includes(activityName)
        ? prev.filter(name => name !== activityName)
        : [...prev, activityName]
    );
  };

  const toggleManagedClass = (className: string) => {
    setManagedClasses(prev =>
      prev.includes(className)
        ? prev.filter(name => name !== className)
        : [...prev, className]
    );
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("請選擇圖片文件");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("圖片大小不能超過 2MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = fileName;

      // Delete old avatar if exists
      await supabase.storage.from("avatars").remove([filePath]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add timestamp to prevent caching
      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newAvatarUrl);

      // --- NEW: GOOGLE DRIVE SYNC ---
      const { syncAssetToDrive } = await import('@/utils/googleDriveSync');
      syncAssetToDrive(newAvatarUrl, fileName, 'Learning_Community/users/profile_pictures', {
        category: 'profile_picture',
        context: 'users',
        originalName: file.name,
        word: user.display_name || user.email || user.id
      }).catch(err => console.warn('Profile picture Drive sync failed:', err));
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "上傳失敗");
      setAvatarPreview(user.avatar_url || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploading(true);
    setError(null);

    try {
      // Delete from storage
      const fileName = `${user.id}`;
      await supabase.storage.from("avatars").remove([`${fileName}.png`, `${fileName}.jpg`, `${fileName}.jpeg`, `${fileName}.webp`]);

      setAvatarUrl("");
      setAvatarPreview(null);
    } catch (err: any) {
      console.error("Remove error:", err);
      setError(err.message || "移除失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleBgRemovalApply = async (processedDataUrl: string) => {
    setIsUploading(true);
    setError(null);
    setShowBgRemoval(false);

    try {
      // Convert data URL to File
      const file = dataUrlToFile(processedDataUrl, `${user.id}_processed.png`);
      const filePath = `${user.id}.png`;

      // Delete old avatar if exists
      await supabase.storage.from("avatars").remove([filePath]);

      // Upload processed image
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newAvatarUrl);
      setAvatarPreview(processedDataUrl);

      // --- NEW: GOOGLE DRIVE SYNC ---
      const { syncAssetToDrive } = await import('@/utils/googleDriveSync');
      syncAssetToDrive(newAvatarUrl, filePath, 'Learning_Community/users/profile_pictures', {
        category: 'profile_picture',
        context: 'users',
        originalName: 'processed_avatar.png',
        word: user.display_name || user.email || user.id,
        source: 'Background Removal'
      }).catch(err => console.warn('Processed profile picture Drive sync failed:', err));
    } catch (err: any) {
      console.error("Background removal upload error:", err);
      setError(err.message || "處理後上傳失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updateData: {
        userId: string;
        displayName?: string;
        email?: string;
        password?: string;
        avatarUrl?: string | null;
        adminUserId: string;
        role?: 'admin' | 'class_staff' | 'user';
      } = {
        userId: user.id,
        adminUserId: adminUserId
      };

      // Only include changed fields
      if (displayName !== user.display_name) {
        (updateData as any).display_name = displayName;
      }
      if (email && email !== user.email) {
        updateData.email = email;
      }
      if (password) {
        updateData.password = password;
      }
      if (avatarUrl !== user.avatar_url) {
        updateData.avatarUrl = avatarUrl || null;
      }
      if (role !== (user.is_admin ? 'admin' : 'user')) {
        updateData.role = role;
      }

      // Add Class and Class Number to update data
      // Note: We need to pass these to the edge function
      (updateData as any).display_name = displayName || null;
      (updateData as any).class = className || null;
      const parsedClassNumber = classNumber !== "" ? parseInt(classNumber) : null;
      (updateData as any).classNumber = parsedClassNumber;
      (updateData as any).ecas = ecas;
      if (role === 'class_staff') {
        (updateData as any).managed_classes = managedClasses;
      }

      // Add Learning Levels
      (updateData as any).spellingLevel = spellingLevel;
      (updateData as any).readingRearrangingLevel = readingRearrangingLevel;
      (updateData as any).readingProofreadingLevel = readingProofreadingLevel;
      (updateData as any).memorizationLevel = memorizationLevel;
      (updateData as any).proofreadingLevel = proofreadingLevel;

      console.log("Sending update request:", updateData);

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data, error: fnError } = await supabase.functions.invoke("user-management/update-user", {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: updateData
      });

      console.log("Update response:", { data, fnError });

      if (fnError) {
        console.error("Function error:", fnError);
        throw fnError;
      }

      if (data?.error) {
        console.error("Data error:", data.error);
        throw new Error(data.error);
      }

      // Direct DB update as safety net to ensure class_number persists
      const directUpdate: any = {};
      if (displayName !== undefined) directUpdate.display_name = displayName || null;
      if (className !== undefined) directUpdate.class = className || null;
      if (parsedClassNumber !== undefined) directUpdate.class_number = parsedClassNumber;
      if (ecas !== undefined) directUpdate.ecas = ecas;

      const { error: directError } = await supabase
        .from('users')
        .update(directUpdate)
        .eq('id', user.id);

      if (directError) {
        console.warn("Direct DB update failed:", directError.message);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Save error:", err);
      setError(err.message || "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full sm:max-w-lg md:max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">編輯用戶</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] text-sm">
              {error}
            </div>
          )}

          {/* Avatar Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Image className="w-4 h-4" />
              房間角色 (Avatar)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-[hsl(var(--muted))] overflow-hidden flex items-center justify-center border-2 border-dashed border-[hsl(var(--border))]">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  上傳新角色
                </button>
                {avatarPreview && (
                  <>
                    <button
                      onClick={() => setShowBgRemoval(true)}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      <Wand2 className="w-4 h-4" />
                      去背
                    </button>
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.2)] disabled:opacity-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      移除
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              建議尺寸: 200x200 像素, PNG 透明背景
            </p>
          </div>

          {/* Background Removal Editor */}
          {avatarPreview && (
            <BackgroundRemovalEditor
              imageUrl={avatarPreview}
              isOpen={showBgRemoval}
              onClose={() => setShowBgRemoval(false)}
              onApply={handleBgRemovalApply}
            />
          )}

          {/* Display Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <User className="w-4 h-4" />
              顯示名稱
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          {/* Login Email (Read-only) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">
              <Mail className="w-4 h-4" />
              登入電郵 (Login Email)
            </label>
            <div className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-sm select-all cursor-default">
              {user.auth_email || user.email || '—'}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Mail className="w-4 h-4" />
              電郵地址 (選填更改)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Lock className="w-4 h-4" />
              新密碼 (留空則不更改)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6個字符"
              className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Class Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                班級 (Class)
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. 1A"
                className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>

            {/* Class Number */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 flex items-center gap-2">
                <Hash size={16} />
                學號
              </label>
              <input
                type="number"
                value={classNumber}
                onChange={(e) => setClassNumber(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="學號 (1-99)"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Shield className="w-4 h-4" />
              用戶權限 (Role)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'class_staff' | 'user')}
              className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              <option value="user">一般用戶 (User)</option>
              <option value="class_staff">班級助理 (Class Staff)</option>
              <option value="admin">管理員 (Admin)</option>
            </select>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              管理員可以訪問後台管理界面並更新其他用戶。
            </p>
          </div>

          {/* Learning Levels Section */}
          <div className="space-y-4 p-4 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--muted)/0.2)]">
            <label className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--foreground))]">
              <Shield className="w-4 h-4" />
              學習等級 (Learning Levels)
            </label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spelling</label>
                <select 
                  value={spellingLevel} 
                  onChange={(e) => setSpellingLevel(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))]"
                >
                  <option value={1}>Level 1 (Basic)</option>
                  <option value={2}>Level 2 (Advanced)</option>
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unscramble</label>
                <select 
                  value={readingRearrangingLevel} 
                  onChange={(e) => setReadingRearrangingLevel(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))]"
                >
                  <option value={1}>Level 1</option>
                  <option value={2}>Level 2</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Read-Proof</label>
                <select 
                  value={readingProofreadingLevel} 
                  onChange={(e) => setReadingProofreadingLevel(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))]"
                >
                  <option value={1}>Level 1</option>
                  <option value={2}>Level 2</option>
                  <option value={3}>Level 3</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memorize</label>
                <select 
                  value={memorizationLevel} 
                  onChange={(e) => setMemorizationLevel(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))]"
                >
                  <option value={1}>Level 1</option>
                  <option value={2}>Level 2</option>
                  <option value={3}>Level 3</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proofread</label>
                <select 
                  value={proofreadingLevel} 
                  onChange={(e) => setProofreadingLevel(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))]"
                >
                  <option value={1}>Level 1</option>
                  <option value={2}>Level 2</option>
                </select>
              </div>
            </div>
          </div>

          {/* Managed Classes (Only for Class Staff) */}
          {role === 'class_staff' && (
            <div className="space-y-3 p-4 border border-indigo-200 rounded-xl bg-indigo-50/30">
              <label className="flex items-center gap-2 text-sm font-bold text-indigo-700">
                <Shield className="w-4 h-4" />
                負責班級 (Managed Classes)
              </label>
              {isLoadingAssignments ? (
                <div className="flex items-center gap-2 text-xs text-indigo-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  載入權限中...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableClasses.map((cls) => (
                    <label 
                      key={cls.id} 
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer text-sm ${
                        managedClasses.includes(cls.name)
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={managedClasses.includes(cls.name)}
                        onChange={() => toggleManagedClass(cls.name)}
                        className="hidden"
                      />
                      <span className="font-bold">{cls.name}</span>
                    </label>
                  ))}
                  {availableClasses.length === 0 && (
                    <p className="text-xs text-slate-400 italic col-span-full">尚未建立任何班級</p>
                  )}
                </div>
              )}
              <p className="text-xs text-indigo-500/70">
                班級助理只能看到及管理以上所選班級的學生。
              </p>
            </div>
          )}

          {/* Extracurricular Activities */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Shield className="w-4 h-4" />
              Extracurricular Activities (ECAs)
            </label>
            <div className="grid grid-cols-2 gap-3 p-4 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--muted)/0.3)]">
              {availableActivities.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] col-span-2">
                  尚未建立任何課外活動。請到群組管理頁面新增。
                </p>
              ) : (
                availableActivities.map((activity) => (
                  <label key={activity.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-[hsl(var(--border))] cursor-pointer hover:border-blue-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={ecas.includes(activity.name)}
                      onChange={() => toggleEca(activity.name)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {activity.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:px-6 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                儲存中...
              </>
            ) : (
              "儲存變更"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
