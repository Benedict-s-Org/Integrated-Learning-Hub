/**
 * Image processing utilities for background removal and manipulation
 */

/**
 * Remove white/light background from an image
 * @param imageUrl - Source image URL or data URL
 * @param tolerance - Distance threshold from white (0-255), default 30
 * @param edgeSmoothing - Whether to apply edge smoothing for gradual alpha
 * @returns Promise<string> - Processed image as PNG data URL
 */
export const removeWhiteBackground = async (
  imageUrl: string,
  tolerance: number = 30,
  edgeSmoothing: boolean = false
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
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Scale tolerance to 0-255 range (input is 0-100)
      const scaledTolerance = (tolerance / 100) * 255;
      
      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate Euclidean distance from white (255, 255, 255)
        const distanceToWhite = Math.sqrt(
          Math.pow(255 - r, 2) +
          Math.pow(255 - g, 2) +
          Math.pow(255 - b, 2)
        );
        
        if (distanceToWhite < scaledTolerance) {
          // Within tolerance - make fully transparent
          data[i + 3] = 0;
        } else if (edgeSmoothing && distanceToWhite < scaledTolerance * 1.5) {
          // Edge smoothing zone - gradual transparency
          const alpha = ((distanceToWhite - scaledTolerance) / (scaledTolerance * 0.5)) * 255;
          data[i + 3] = Math.min(255, Math.max(0, Math.round(alpha)));
        }
        // Else: keep original alpha
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};

/**
 * Remove a specific color background from an image
 * @param imageUrl - Source image URL or data URL
 * @param targetColor - RGB color to remove { r, g, b }
 * @param tolerance - Distance threshold (0-255), default 30
 * @param edgeSmoothing - Whether to apply edge smoothing
 * @returns Promise<string> - Processed image as PNG data URL
 */
export const removeColorBackground = async (
  imageUrl: string,
  targetColor: { r: number; g: number; b: number },
  tolerance: number = 30,
  edgeSmoothing: boolean = false
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
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const scaledTolerance = (tolerance / 100) * 255;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const distanceToTarget = Math.sqrt(
          Math.pow(targetColor.r - r, 2) +
          Math.pow(targetColor.g - g, 2) +
          Math.pow(targetColor.b - b, 2)
        );
        
        if (distanceToTarget < scaledTolerance) {
          data[i + 3] = 0;
        } else if (edgeSmoothing && distanceToTarget < scaledTolerance * 1.5) {
          const alpha = ((distanceToTarget - scaledTolerance) / (scaledTolerance * 0.5)) * 255;
          data[i + 3] = Math.min(255, Math.max(0, Math.round(alpha)));
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};

/**
 * Convert a data URL to a File object
 * @param dataUrl - The data URL to convert
 * @param filename - The filename for the resulting File
 * @returns File object
 */
export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
};

/**
 * Convert a File to a data URL
 * @param file - The file to convert
 * @returns Promise<string> - Data URL
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};
