// Photos arrive already shrunk by the phone (lib/photo-resize.ts), so these
// are generous: a full copy is usually a few hundred KB, a thumbnail ~40 KB.
const FULL_MAX = 3 * 1024 * 1024;
const THUMB_MAX = 512 * 1024;

/** The upload's bytes, if it's a JPEG of a sensible size. */
async function jpeg(part: FormDataEntryValue | null, max: number) {
  if (!(part instanceof Blob) || part.size === 0 || part.size > max) return null;
  const bytes = new Uint8Array(await part.arrayBuffer());
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null;
}

/** A photo's two copies from an upload's "full" and "thumb" parts, or null if either isn't usable. */
export async function readPhotoParts(form: FormData) {
  const full = await jpeg(form.get("full"), FULL_MAX);
  const thumb = await jpeg(form.get("thumb"), THUMB_MAX);
  return full && thumb ? { full, thumb } : null;
}

/** The error to answer with when storing a photo failed. */
export function storeFailure(err: unknown) {
  console.error("Couldn't store a photo", err);
  const unset = err instanceof Error && err.message.startsWith("Photos aren't set up");
  return { error: unset ? (err as Error).message : "Couldn't save the photo. Try again?", status: unset ? 503 : 502 };
}
