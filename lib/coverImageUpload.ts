const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_TARGET_BYTES = 450 * 1024;
const MIN_QUALITY = 0.55;
const QUALITY_STEPS = [0.82, 0.74, 0.68, 0.62, MIN_QUALITY];

type OptimizeCoverImageOptions = {
  maxDimension?: number;
  targetBytes?: number;
};

type OptimizeCoverImageResult = {
  file: File;
  originalSize: number;
  optimized: boolean;
};

const shouldSkipOptimization = (file: File) => {
  if (!file.type.startsWith("image/")) {
    return true;
  }

  return (
    file.type === "image/gif" ||
    file.type === "image/svg+xml" ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for optimization"));
    image.src = src;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode optimized image"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });

const withReplacedExtension = (fileName: string, nextExtension: string) => {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  return `${baseName}.${nextExtension}`;
};

export async function optimizeCoverImageForUpload(
  file: File,
  options: OptimizeCoverImageOptions = {},
): Promise<OptimizeCoverImageResult> {
  if (typeof window === "undefined" || shouldSkipOptimization(file)) {
    return { file, originalSize: file.size, optimized: false };
  }

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_BYTES;
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      return { file, originalSize: file.size, optimized: false };
    }

    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return { file, originalSize: file.size, optimized: false };
    }

    context.drawImage(image, 0, 0, width, height);

    const prefersTransparency =
      file.type === "image/png" || file.type === "image/webp" || file.type === "image/avif";
    const outputType = prefersTransparency ? "image/webp" : "image/jpeg";
    let bestBlob = await canvasToBlob(canvas, outputType, QUALITY_STEPS[0]);

    for (const quality of QUALITY_STEPS.slice(1)) {
      if (bestBlob.size <= targetBytes) {
        break;
      }

      bestBlob = await canvasToBlob(canvas, outputType, quality);
    }

    if (bestBlob.size >= file.size && width === sourceWidth && height === sourceHeight) {
      return { file, originalSize: file.size, optimized: false };
    }

    const extension = outputType === "image/webp" ? "webp" : "jpg";
    const optimizedFile = new File([bestBlob], withReplacedExtension(file.name, extension), {
      type: outputType,
      lastModified: Date.now(),
    });

    return {
      file: optimizedFile,
      originalSize: file.size,
      optimized: optimizedFile.size < file.size || width !== sourceWidth || height !== sourceHeight,
    };
  } catch {
    return { file, originalSize: file.size, optimized: false };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
