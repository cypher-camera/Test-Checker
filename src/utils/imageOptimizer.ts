/**
 * Resizes and optimizes an image file or dataURL so it stays crisp for OCR
 * while preventing memory overflow and network timeouts with real phone camera scans.
 */
export async function optimizeImageForEvaluation(
  fileOrDataUrl: File | string,
  maxDimension = 1500,
  quality = 0.85
): Promise<{ dataUrl: string; mimeType: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let source = '';
    let mimeType = 'image/jpeg';

    if (typeof fileOrDataUrl === 'string') {
      source = fileOrDataUrl;
      const match = fileOrDataUrl.match(/^data:([^;]+);base64,/);
      if (match && match[1]) {
        mimeType = match[1];
      }
    } else {
      mimeType = fileOrDataUrl.type || 'image/jpeg';
      source = URL.createObjectURL(fileOrDataUrl);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Scale down if image is larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: source, mimeType, width, height });
        return;
      }

      // Draw with high quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Export as high-quality JPEG (clean for OCR)
      const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
      if (typeof fileOrDataUrl !== 'string') {
        URL.revokeObjectURL(source);
      }

      resolve({
        dataUrl: optimizedDataUrl,
        mimeType: 'image/jpeg',
        width,
        height,
      });
    };

    img.onerror = (err) => {
      if (typeof fileOrDataUrl !== 'string') {
        URL.revokeObjectURL(source);
      }
      reject(new Error('Failed to process and optimize image.'));
    };

    img.src = source;
  });
}
