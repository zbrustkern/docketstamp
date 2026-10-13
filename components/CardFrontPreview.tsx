import Image from "next/image";

/** Presentation only: the source URL remains the artwork sent for printing. */
export function CardFrontPreview({
  artworkUrl,
  title,
  sizes = "(max-width: 640px) 45vw, 380px",
  priority = false,
}: {
  artworkUrl: string;
  title: string;
  sizes?: string;
  priority?: boolean;
}) {
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
        className="object-cover"
      />
    </div>
  );
}
