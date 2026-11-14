export type UploadedImage = { path: string; thumb_path: string };

export function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("사진을 읽지 못했습니다"));
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

function webp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob?.type === "image/webp" ? resolve(blob) : reject(new Error("WebP 변환을 지원하는 브라우저가 필요합니다")), "image/webp", 0.85,
  ));
}

export async function resizeImage(file: File, maxEdge: 1600): Promise<Blob> {
  const image = await loadImage(file);
  const ratio = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진을 변환하지 못했습니다");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return webp(canvas);
}

export async function makeThumb(file: File, size: 240): Promise<Blob> {
  const image = await loadImage(file);
  const edge = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("썸네일을 만들지 못했습니다");
  context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, size, size);
  return webp(canvas);
}
