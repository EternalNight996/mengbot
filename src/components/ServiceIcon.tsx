import { useState } from "react";
import { cn } from "@/lib/cn";
import { APP_TILES } from "@/lib/app-icon-tiles";

/** One connectable app as the Apps catalog lists it. */
export interface ToolkitCard {
  slug: string;
  label: string;
  blurb: string;
  logo: string | null;
  noAuth?: boolean;
  domain: string | null;
  categories?: string[];
  /** "cn" marks the China edition's locally bundled apps. */
  region?: "cn" | "global";
}

/**
 * An app's bundled logo, then its own letter tile, then its initial.
 *
 * Nothing here fetches: the old second stage asked Google for a favicon, which
 * simply timed out in mainland China and left a blank square behind.
 */
export function ServiceIcon({ card, className = "size-11" }: { card: Pick<ToolkitCard, "logo" | "domain" | "label"> & Partial<Pick<ToolkitCard, "slug">>; className?: string }) {
  const [brokenLogo, setBrokenLogo] = useState(false);
  if (card.logo && !brokenLogo) {
    return (
      <img
        src={card.logo}
        alt=""
        loading="lazy"
        className={cn("rounded-xl object-contain", className)}
        onError={() => setBrokenLogo(true)}
      />
    );
  }
  const tile = card.slug ? APP_TILES[card.slug] : undefined;
  if (tile) {
    return (
      <div
        aria-hidden="true"
        style={{ backgroundColor: tile.background }}
        className={cn("flex items-center justify-center rounded-xl font-semibold text-white", className)}
      >
        <span className="text-[15px] leading-none">{tile.character}</span>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center justify-center rounded-xl bg-raised text-[15px] font-semibold text-ink-secondary", className)}>
      {card.label.slice(0, 1).toUpperCase()}
    </div>
  );
}
