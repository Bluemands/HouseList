import clsx from "clsx";
import { photoSrc, type PhotoDTO } from "@/lib/types";

/**
 * A photo's small copy. Plain <img>, not next/image: the images are already
 * sized on the phone, and the optimiser's free allowance is better unspent.
 * Its own file so list rows can show one without loading the photo viewer.
 */
export function PhotoThumb({ photo, alt = "", className }: { photo: PhotoDTO; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photoSrc(photo.id, "thumb")} alt={alt} loading="lazy" decoding="async" className={clsx("object-cover", className)} />;
}
