import React, { useState, useRef } from "react";
import { X, Loader2, Upload, Trash2, User, Mail, Lock, Image, Wand2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundRemovalEditor } from "@/components/common/BackgroundRemovalEditor";
import { dataUrlToFile } from "@/utils/imageProcessing";

interface UserWithProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url?: string | null;
  created_at: string;
  is_admin: boolean;
}

interface UserEditModalProps {
  user: UserWithProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  adminUserId: string;
}

export function UserEditModal({ user, isOpen, onClose, onSuccess, adminUserId }: UserEditModalProps) {
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null);
  const [role, setRole] = useState<'admin' | 'user'>(user.is_admin ? 'admin' : 'user');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
        role?: 'admin' | 'user';
      } = {
        userId: user.id,
        adminUserId: adminUserId
      };

      // Only include changed fields
      if (displayName !== user.display_name) {
        updateData.displayName = displayName;
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

      const { data, error: fnError } = await supabase.functions.invoke("update-user", {
        body: updateData,
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
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
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">編輯用戶</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Shield className="w-4 h-4" />
              用戶權限 (Role)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
              className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              <option value="user">一般用戶 (User)</option>
              <option value="admin">管理員 (Admin)</option>
            </select>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              管理員可以訪問後台管理界面並更新其他用戶。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[hsl(var(--border))]">
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
