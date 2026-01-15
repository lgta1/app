import { useCallback, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";

type InfoTooltipProps = {
  content: ReactNode;
  ariaLabel?: string;
  triggerClassName?: string;
  contentClassName?: string;
  side?: Popover.PopoverContentProps["side"];
  align?: Popover.PopoverContentProps["align"];
  sideOffset?: number;
};

export function InfoTooltip({
  content,
  ariaLabel = "Thông tin",
  triggerClassName = "",
  contentClassName = "",
  side = "top",
  align = "center",
  sideOffset = 8,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  const openTooltip = useCallback(() => setOpen(true), []);
  const closeTooltip = useCallback(() => setOpen(false), []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/35 bg-white/5 text-[10px] font-bold leading-none text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC] sm:h-5 sm:w-5 sm:text-xs ${triggerClassName}`}
          onMouseEnter={openTooltip}
          onMouseLeave={closeTooltip}
          onFocus={openTooltip}
          onBlur={closeTooltip}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((prev) => !prev);
          }}
        >
          i
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={`bg-bgc-layer1 border-bd-default data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-[99999] w-[min(92vw,420px)] rounded-xl border p-3 shadow-lg will-change-[transform,opacity] ${contentClassName}`}
          side={side}
          align={align}
          sideOffset={sideOffset}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={openTooltip}
          onMouseLeave={closeTooltip}
        >
          <div className="text-txt-secondary text-xs leading-relaxed font-medium whitespace-pre-line">
            {content}
          </div>
          <Popover.Arrow className="fill-bgc-layer1" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
