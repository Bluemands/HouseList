"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Trash2, X } from "lucide-react";
import { PHOTOS_MAX, photoSrc, type ItemDTO } from "@/lib/types";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { PhotoThumb } from "@/components/PhotoThumb";

/** An item's photos as tiles, with a way to add more; a tile opens it full size. */
export function PhotosField({ item }: { item: ItemDTO }) {
  const { addPhoto } = useStore();
  const [uploading, setUploading] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const room = PHOTOS_MAX - item.photos.length - uploading;

  async function add(files: FileList | null) {
    const chosen = Array.from(files ?? []).slice(0, Math.max(0, room));
    if (!chosen.length) return;
    setUploading((n) => n + chosen.length);
    // One at a time: a phone shrinking several big photos at once can run out of memory.
    for (const file of chosen) {
      await addPhoto(item.id, file);
      setUploading((n) => n - 1);
    }
  }

  const picker = (
    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => {
      add(e.target.files);
      e.target.value = "";
    }} />
  );

  return (
    <>
      {item.photos.length === 0 && uploading === 0 ? (
        <label className="inline-flex cursor-pointer items-center gap-1.5 justify-self-start rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:bg-sunken active:scale-[0.97]">
          <ImagePlus size={15} aria-hidden="true" /> Add a photo
          {picker}
        </label>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {item.photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setViewing(i)}
                aria-label={`Photo ${i + 1} of ${item.photos.length}, open full size`}
                className="block aspect-square w-full overflow-hidden rounded-control bg-sunken outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <PhotoThumb photo={p} className="h-full w-full" />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`up-${i}`} className="grid aspect-square place-items-center rounded-control bg-sunken text-ink-3">
              <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-label="Adding a photo" />
            </li>
          ))}
          {room > 0 && (
            <li>
              <label className="grid aspect-square w-full cursor-pointer place-content-center justify-items-center gap-1 rounded-control border border-dashed border-line-strong text-ink-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:border-tick-ring hover:text-ink">
                <ImagePlus size={18} aria-hidden="true" />
                <span className="text-hint font-semibold">Add</span>
                {picker}
              </label>
            </li>
          )}
        </ul>
      )}
      {viewing !== null && item.photos.length > 0 && (
        <PhotoViewer item={item} start={Math.min(viewing, item.photos.length - 1)} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

/** Full size, one at a time, swiped through like a phone's own photos. */
function PhotoViewer({ item, start, onClose }: { item: ItemDTO; start: number; onClose: () => void }) {
  const { deletePhoto } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const photos = item.photos;
  const at = Math.min(index, photos.length - 1);
  const photo = photos[at];

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (rail) rail.scrollLeft = start * rail.clientWidth;
  }, [start]);

  function go(to: number) {
    const rail = railRef.current;
    if (!rail || to < 0 || to >= photos.length) return;
    rail.scrollTo({ left: to * rail.clientWidth, behavior: "smooth" });
  }

  if (!photo) return null;
  return (
    <dialog
      ref={ref}
      aria-label={`Photos of ${item.title}`}
      // The viewer opens over an item sheet: its Escape and taps are its own.
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(at - 1);
        if (e.key === "ArrowRight") go(at + 1);
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-[#0d0c0b] p-0 text-white backdrop:bg-transparent"
    >
      <div
        ref={railRef}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-contain [scrollbar-width:none]"
      >
        {photos.map((p, i) => (
          <div key={p.id} className="grid h-full w-full shrink-0 snap-center place-items-center px-2 pt-16 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc(p.id, "full")}
              alt={`Photo ${i + 1} of ${photos.length}`}
              width={p.width}
              height={p.height}
              loading={Math.abs(i - start) <= 1 ? "eager" : "lazy"}
              decoding="async"
              className="max-h-full w-auto max-w-full object-contain"
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pt-[max(12px,env(safe-area-inset-top))] pb-6">
        <p className="min-w-0 flex-1 truncate pl-1 text-meta text-white/80" aria-live="polite">
          {photos.length > 1 && <span className="font-semibold text-white">{at + 1} of {photos.length} · </span>}
          {photo.addedBy}, {timeAgo(photo.createdAt)}
        </p>
        <button
          type="button"
          onClick={() => {
            deletePhoto(item, photo);
            if (photos.length === 1) onClose();
          }}
          aria-label="Delete this photo"
          className="hit grid h-10 w-10 place-items-center rounded-full text-white/85 hover:bg-white/10 hover:text-white"
        >
          <Trash2 size={18} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hit grid h-10 w-10 place-items-center rounded-full text-white/85 hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Phones swipe; a mouse needs something to click. */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(at - 1)}
            disabled={at === 0}
            aria-label="Previous photo"
            className="absolute top-1/2 left-3 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 disabled:opacity-0 pointer-fine:grid"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={() => go(at + 1)}
            disabled={at === photos.length - 1}
            aria-label="Next photo"
            className="absolute top-1/2 right-3 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 disabled:opacity-0 pointer-fine:grid"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </dialog>
  );
}
