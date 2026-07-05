"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 10;
const GAP = 10;

export type HintAlign = "start" | "center" | "end";

function computePosition(anchor: DOMRect, popoverWidth: number, align: HintAlign) {
  const top = anchor.bottom + GAP;
  const vw = window.innerWidth;

  if (align === "start") {
    let left = anchor.left;
    const maxLeft = vw - VIEWPORT_MARGIN - popoverWidth;
    left = Math.max(VIEWPORT_MARGIN, Math.min(maxLeft, left));
    return { top, left, transform: "translateX(0)" };
  }

  if (align === "end") {
    let left = anchor.right;
    const minLeft = VIEWPORT_MARGIN + popoverWidth;
    const maxLeft = vw - VIEWPORT_MARGIN;
    left = Math.max(minLeft, Math.min(maxLeft, left));
    return { top, left, transform: "translateX(-100%)" };
  }

  const halfW = popoverWidth / 2;
  const centerX = anchor.left + anchor.width / 2;
  const minCenter = VIEWPORT_MARGIN + halfW;
  const maxCenter = vw - VIEWPORT_MARGIN - halfW;
  const left = Math.max(minCenter, Math.min(maxCenter, centerX));
  return { top, left, transform: "translateX(-50%)" };
}

export function ActionHintPopover({
  anchorRef,
  open,
  summary,
  costLabel,
  align = "center",
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  summary: string;
  costLabel: string;
  align?: HintAlign;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const { top, left, transform } = computePosition(anchor, popover.offsetWidth, align);
      setStyle({
        position: "fixed",
        top,
        left,
        transform,
        visibility: "visible",
      });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, summary, costLabel, align]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div ref={popoverRef} className="action-hint-popover" style={style} role="tooltip">
      <p className="action-hint-popover__summary">{summary}</p>
      <p className="action-hint-popover__cost">
        <span className="action-hint-popover__cost-label">Cost</span> {costLabel}
      </p>
    </div>,
    document.body,
  );
}
