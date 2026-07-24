import { useEffect, useRef, useState } from "react";

type HorizontalScrollNavState = {
  isOverflowing: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

export function useHorizontalScrollNav() {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [mirrorElement, setMirrorElement] = useState<HTMLDivElement | null>(null);
  const syncLockRef = useRef(false);
  const [state, setState] = useState<HorizontalScrollNavState>({
    isOverflowing: false,
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    if (!containerElement) return;

    const update = () => {
      const maxScrollLeft = Math.max(containerElement.scrollWidth - containerElement.clientWidth, 0);
      setContentWidth(containerElement.scrollWidth);
      setState({
        isOverflowing: maxScrollLeft > 8,
        canScrollLeft: containerElement.scrollLeft > 8,
        canScrollRight: containerElement.scrollLeft < maxScrollLeft - 8,
      });
    };

    const syncScroll = (source: HTMLDivElement, target?: HTMLDivElement | null) => {
      if (syncLockRef.current) return;
      syncLockRef.current = true;
      if (target) {
        target.scrollLeft = source.scrollLeft;
      }
      window.requestAnimationFrame(() => {
        syncLockRef.current = false;
        update();
      });
    };

    if (mirrorElement) {
      mirrorElement.scrollLeft = containerElement.scrollLeft;
    }
    update();
    const handleElementScroll = () => syncScroll(containerElement, mirrorElement);
    const handleMirrorScroll = () => {
      if (!mirrorElement) return;
      syncScroll(mirrorElement, containerElement);
    };
    containerElement.addEventListener("scroll", handleElementScroll, { passive: true });
    if (mirrorElement) {
      mirrorElement.addEventListener("scroll", handleMirrorScroll, { passive: true });
    }
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(containerElement);
    if (containerElement.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(containerElement.firstElementChild);
    }
    if (mirrorElement) {
      resizeObserver.observe(mirrorElement);
    }
    window.addEventListener("resize", update);

    return () => {
      containerElement.removeEventListener("scroll", handleElementScroll);
      if (mirrorElement) {
        mirrorElement.removeEventListener("scroll", handleMirrorScroll);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerElement, mirrorElement]);

  const scrollByDirection = (direction: "left" | "right") => {
    if (!containerElement) return;
    const distance = Math.max(Math.round(containerElement.clientWidth * 0.7), 280);
    containerElement.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  return {
    containerRef: setContainerElement,
    mirrorScrollRef: setMirrorElement,
    contentWidth,
    ...state,
    scrollByDirection,
  };
}
