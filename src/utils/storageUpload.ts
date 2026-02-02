import { supabase } from '@/integrations/supabase/client';

/**
 * Upload image to Supabase Storage
 * Files are organized by user ID for security (RLS enforces user can only upload to their own folder)
 * Bucket is private - use signed URLs for access
 */
export const uploadImageToSupabase = async (
  file: File, 
  folder: string = 'general'
): Promise<string | null> => {
  try {
    // Get current user for folder organization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('請先登入才能上傳圖片');
      return null;
    }
    
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    // Validate file type (only allow images)
    const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      alert('只允許上傳圖片檔案 (JPG, PNG, GIF, WEBP)');
      return null;
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('檔案大小不能超過 5MB');
      return null;
    }
    
    // Include user ID in path for RLS policy compliance
    const fileName = `${user.id}/${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('furniture')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Supabase upload error:', error);
      alert(`上傳失敗: ${error.message}`);
      return null;
    }
    
    // Use signed URL instead of public URL (bucket is now private)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('furniture')
      .createSignedUrl(data.path, 604800); // 7 days expiry
    
    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError);
      alert('無法取得圖片連結');
      return null;
    }
    
    return signedUrlData.signedUrl;
  } catch (err) {
    console.error('Upload exception:', err);
    alert('上傳時發生錯誤，請檢查網路連線');
    return null;
  }
};

/**
 * Convert a data URL to a File object
 */
export const dataUrlToFile = (dataUrl: string, fileName: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
};

/**
 * Helper function to flip image horizontally using Canvas API
 */
export const flipImageHorizontally = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};

/**
 * Helper function to flip and darken image using Canvas API (for wall dark side)
 */
export const flipAndDarkenImage = async (
  imageUrl: string, 
  darkenAmount: number = 0.75
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      // Horizontal flip
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      
      // Darken effect
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - darkenAmount})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};
