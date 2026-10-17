// A phone's photo is 3–8 MB; stored as taken, the free Blob allowance would
// fill after a few hundred. Shrunk on the phone first, a full copy is a few
// hundred KB and still sharp on any screen, and the thumbnail lists show is
// tens of KB.

const FULL_EDGE = 1600; // the longer side
const THUMB_EDGE = 320; // the shorter side, as thumbnails are cropped square

export type PreparedPhoto = { full: Blob; thumb: Blob; width: number; height: number };

/** Both copies of a chosen photo, as JPEGs, upright (the browser applies the camera's rotation). */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("empty image");

    const fullScale = Math.min(1, FULL_EDGE / Math.max(w, h));
    const thumbScale = Math.min(1, THUMB_EDGE / Math.min(w, h));
    const full = await encode(img, Math.round(w * fullScale), Math.round(h * fullScale), 0.82);
    const thumb = await encode(img, Math.round(w * thumbScale), Math.round(h * thumbScale), 0.75);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function encode(img: HTMLImageElement, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  // A transparent PNG would turn black as a JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("couldn't encode");
  // Let the phone have the memory back straight away (Safari holds on to canvases).
  canvas.width = canvas.height = 0;
  return { blob, width, height };
}
