import { Link } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";

import type { SmartSearchHit } from "~/types/search";
import { buildMangaUrl } from "~/utils/manga-url.utils";
import { scopeLabel } from "~/utils/text-normalize";
import { getPosterVariantForContext } from "~/utils/poster-variants.utils";

interface SearchItemProps {
  result: SmartSearchHit;
  isFirst?: boolean;
}

export function SearchItem({ result, isFirst }: SearchItemProps) {
  const highlight = result.highlight;
  const highlightIsTitle = highlight?.field === "title";

  return (
    <Popover.Close asChild>
      <Link
        to={buildMangaUrl(result.slug ?? result.id)}
        className={`hover:bg-bgc-layer2 flex items-center gap-3 p-3 transition-colors ${
          isFirst ? "bg-bgc-layer2" : "bg-bgc-layer1"
        } border-bd-default border-b last:border-b-0`}
      >
        <img
          src={getPosterVariantForContext(result, "small")?.url || result.poster}
          alt={result.title}
          className="h-24 w-16 flex-shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-txt-primary line-clamp-1 text-base leading-6 font-semibold">
            {highlightIsTitle && highlight ? (
              <span dangerouslySetInnerHTML={{ __html: highlight.snippet }} />
            ) : (
              result.title
            )}
          </h3>
          {!highlightIsTitle && highlight && (
            <p
              className="text-txt-focus text-xs leading-4 font-medium"
              dangerouslySetInnerHTML={{ __html: highlight.snippet }}
            />
          )}
          {result.altTitle && (
            <p className="text-txt-secondary line-clamp-1 text-xs leading-4 font-medium italic">
              {result.altTitle}
            </p>
          )}
          <p className="text-txt-secondary text-xs leading-4 font-medium">
            {result.genres.join(", ")}
          </p>
          <p className="text-txt-focus text-[11px] leading-4 font-semibold">
            {scopeLabel(result.scope)}
          </p>
        </div>
      </Link>
    </Popover.Close>
  );
}
