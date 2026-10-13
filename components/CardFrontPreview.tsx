import Image from "next/image";

/** Presentation only: the source URL remains the artwork sent for printing. */
export function CardFrontPreview({
  artworkUrl,
  title,
  sizes = "(max-width: 640px) 45vw, 380px",
  priority = false,
  unoptimized,
}: {
  artworkUrl: string;
  title: string;
  sizes?: string;
  priority?: boolean;
  unoptimized?: boolean;
}) {
  const isDataUrl = typeof artworkUrl === "string" && artworkUrl.startsWith("data:");
  const shouldBypassOptimization = unoptimized !== undefined ? unoptimized : isDataUrl;

  if (!artworkUrl) {
    return (
      <div
        className="relative w-full aspect-[17/22] overflow-hidden rounded-[2px] border border-stone-300/70 bg-stone-100 flex items-center justify-center text-stone-400 text-xs shadow-[1px_2px_5px_rgba(0,0,0,0.12)]"
        data-card-preview="presentation-only"
      >
        <span className="font-serif italic text-stone-400">Card artwork</span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-[17/22] overflow-hidden rounded-[2px] border border-stone-300/70 bg-white shadow-[1px_2px_5px_rgba(0,0,0,0.12)]"
      data-card-preview="presentation-only"
    >
      <Image
        src={artworkUrl}
        alt={title}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        unoptimized={shouldBypassOptimization}
        className="object-cover"
      />
    </div>
  );
}
