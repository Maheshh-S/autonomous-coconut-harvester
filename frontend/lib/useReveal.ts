"use client";

import { useCallback } from "react";

/**
 * Reveal-on-scroll. Adds `.in` to any descendant [data-reveal] when it
 * enters the viewport. Falls back to "reveal above the fold on scroll" so
 * throttled/backgrounded tabs still reveal. Honors prefers-reduced-motion.
 *
 * Returns a callback ref so it works even when the target <main> mounts after
 * the initial render (e.g. behind a loading/error branch). A MutationObserver
 * also watches for [data-reveal] nodes inserted later (async content swaps),
 * since React will not re-fire a stable ref callback across sibling swaps.
 */
export function useReveal() {
  return useCallback((root: HTMLElement | null) => {
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observed = new WeakSet<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    const register = (el: Element) => {
      if (observed.has(el)) return;
      observed.add(el);
      if (reduce) {
        (el as HTMLElement).classList.add("in");
      } else {
        io.observe(el);
      }
    };

    const scan = () => {
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(register);
    };

    scan();

    if (!reduce) {
      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute("data-reveal")) register(node);
              node.querySelectorAll<HTMLElement>("[data-reveal]").forEach(register);
            }
          });
        }
      });
      mo.observe(root, { childList: true, subtree: true });
    }
  }, []);
}
