/**
 * Image Optimizer - Client-side image compression and resizing
 */

interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'image/jpeg' | 'image/webp' | 'image/png';
}

/**
 * Compresses an image file using Canvas API
 */
export const compressImage = async (
    file: File,
    options: CompressionOptions = {}
): Promise<File> => {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.8,
        format = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate aspect ratio resizing
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Fill white background for JPEG
                if (format === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Canvas to Blob conversion failed'));
                            return;
                        }
                        const compressedFile = new File([blob], file.name, {
                            type: format,
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    format,
                    quality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
