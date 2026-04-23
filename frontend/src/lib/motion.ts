/**
 * Motion system — single source of truth for durations and easings used by
 * framer-motion variants. Tailwind utilities (`duration-120` / `ease-out-quart`)
 * cover CSS-driven transitions; this file covers JS-driven ones.
 *
 * Durations, in seconds:
 *   • fast   (0.12s) — hover / focus feedback
 *   • base   (0.18s) — modal / dropdown entry
 *   • slow   (0.24s) — large surface transitions (sidebar collapse, sheet)
 *   • lazy   (0.32s) — hero & on-enter page animations
 *
 * All variants automatically collapse to instant when `reduced === true`.
 */

export const MOTION_DURATION = {
  fast: 0.12,
  base: 0.18,
  slow: 0.24,
  lazy: 0.32,
} as const

/** Vercel-style ease-out-quart, matches Tailwind's `ease-out-quart`. */
export const EASE_OUT_QUART = [0.16, 1, 0.3, 1] as const

/** Standard fade-in for on-mount surfaces. */
export const fadeIn = (reduced = false) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: {
    duration: reduced ? 0 : MOTION_DURATION.base,
    ease: EASE_OUT_QUART,
  },
})

/** Fade + small upward lift — for cards appearing in staggered grids. */
export const fadeUp = (reduced = false, delay = 0) => ({
  initial: { opacity: 0, y: reduced ? 0 : 6 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: reduced ? 0 : MOTION_DURATION.slow,
    ease: EASE_OUT_QUART,
    delay: reduced ? 0 : delay,
  },
})

/** Width-tween used by the collapsible sidebar. */
export const widthTween = (reduced = false) => ({
  duration: reduced ? 0 : MOTION_DURATION.slow,
  ease: EASE_OUT_QUART,
})

/** Presence transition for toast-style surfaces. */
export const popover = (reduced = false) => ({
  initial: { opacity: 0, scale: reduced ? 1 : 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: reduced ? 1 : 0.97 },
  transition: {
    duration: reduced ? 0 : MOTION_DURATION.base,
    ease: EASE_OUT_QUART,
  },
})

/* ─────────────────────────────────────────────────────────────────────────
   Variants (for motion.ul + motion.li stagger patterns).
   Keep these JSON-shaped Variants objects so they compose cleanly with
   framer-motion's `variants` / `initial` / `animate` API.
   ───────────────────────────────────────────────────────────────────────── */

import type { Variants } from 'framer-motion'

/** Parent stagger container — pair with `fadeRiseItem`. */
export const staggerList: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.035, delayChildren: 0.04 },
  },
}

/** Child item — 6px rise + fade, exit faster than enter. */
export const fadeRiseItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATION.slow, ease: EASE_OUT_QUART },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: MOTION_DURATION.fast, ease: EASE_OUT_QUART },
  },
}

/** Reduced-motion fallback — opacity only, short. */
export const reducedFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
}

/** Soft spring — use for press-feedback + panel slides where physics reads
 *  better than a tween. */
export const springSoft = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.7,
}
