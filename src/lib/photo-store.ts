import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

// Where photos' images live. On Vercel that's a private Blob store (free on
// the Hobby plan): nothing in it can be opened without the app's PIN cookie,
// because every image goes out through /api/photos. Locally, without the
// store's token, they're files in .photos/ instead, so dev works offline.

export const PHOTO_SIZES = ["full", "thumb"] as const;
export type PhotoSize = (typeof PHOTO_SIZES)[number];

const blobPath = (id: string, size: PhotoSize) => `photos/${id}/${size}.jpg`;

const LOCAL_DIR = path.join(process.cwd(), ".photos");
const localPath = (id: string, size: PhotoSize) => path.join(LOCAL_DIR, id, `${size}.jpg`);

function inBlobStore() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Photos aren't set up yet: connect a Blob store to the project on Vercel");
  }
  return false;
}

/** Stores a photo's two copies, both JPEG. */
export async function savePhoto(id: string, images: Record<PhotoSize, Uint8Array>) {
  if (inBlobStore()) {
    await Promise.all(
      PHOTO_SIZES.map((size) =>
        put(blobPath(id, size), Buffer.from(images[size]), {
          access: "private",
          contentType: "image/jpeg",
          addRandomSuffix: false,
        }),
      ),
    );
    return;
  }
  await mkdir(path.join(LOCAL_DIR, id), { recursive: true });
  await Promise.all(PHOTO_SIZES.map((size) => writeFile(localPath(id, size), images[size])));
}

/** One copy of a photo, or null if it isn't there. */
export async function readPhoto(id: string, size: PhotoSize): Promise<ReadableStream<Uint8Array> | Uint8Array<ArrayBuffer> | null> {
  if (inBlobStore()) {
    const found = await get(blobPath(id, size), { access: "private" });
    return found?.statusCode === 200 ? found.stream : null;
  }
  try {
    return new Uint8Array(await readFile(localPath(id, size)));
  } catch {
    return null;
  }
}

/** Removes photos' images. Best effort: a leftover image is only wasted space. */
export async function removePhotos(ids: string[]) {
  if (!ids.length) return;
  try {
    if (inBlobStore()) await del(ids.flatMap((id) => PHOTO_SIZES.map((size) => blobPath(id, size))));
    else await Promise.all(ids.map((id) => rm(path.join(LOCAL_DIR, id), { recursive: true, force: true })));
  } catch (err) {
    console.error("Couldn't remove photo images", ids, err);
  }
}
