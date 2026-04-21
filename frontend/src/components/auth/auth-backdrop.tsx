'use client'

import * as React from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * AuthBackdrop — the visual surface behind public pages (login, setup).
 *
 * Composition, back-to-front:
 *   1. True-black canvas
 *   2. Dot-grid (faded top+bottom)
 *   3. Two conic/radial gradient orbs that parallax on mouse-move
 *   4. Accent scan beam (very slow, diagonal)
 *   5. Noise texture (1% opacity) to kill banding on OLED
 *   6. Hairline border mask on the edges
 *
 * The mouse-tracked parallax uses framer-motion springs so the motion
 * feels weighted. Movement is capped to ±24px regardless of the screen
 * size — tasteful, not tacky.
 */
export function AuthBackdrop({ className }: { className?: string }) {
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)

  const smoothMx = useSpring(mx, { stiffness: 80, damping: 20, mass: 0.4 })
  const smoothMy = useSpring(my, { stiffness: 80, damping: 20, mass: 0.4 })

  // Primary orb drifts subtly with the pointer.
  const orb1X = useTransform(smoothMx, [0, 1], [-32, 32])
  const orb1Y = useTransform(smoothMy, [0, 1], [-24, 24])

  // Secondary orb drifts in the opposite direction (parallax).
  const orb2X = useTransform(smoothMx, [0, 1], [28, -28])
  const orb2Y = useTransform(smoothMy, [0, 1], [20, -20])

  const onMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      mx.set((e.clientX - rect.left) / rect.width)
      my.set((e.clientY - rect.top) / rect.height)
    },
    [mx, my],
  )

  return (
    <div
      onPointerMove={onMove}
      className={cn(
        'pointer-events-auto absolute inset-0 overflow-hidden bg-bg',
        className,
      )}
      aria-hidden
    >
      {/* ── Dot grid, masked to fade top/bottom ───────────────────────────── */}
      <div
        className="absolute inset-0 bg-dot-grid opacity-60"
        style={{
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, #000 40%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, #000 40%, transparent 80%)',
        }}
      />

      {/* ── Primary orb — electric green, sits upper-left ──────────────────── */}
      <motion.div
        style={{ x: orb1X, y: orb1Y }}
        className="absolute -top-[18%] -left-[14%] h-[620px] w-[620px] will-change-transform"
      >
        <div
          className="h-full w-full"
          style={{
            background:
              'radial-gradient(closest-side, hsl(152 100% 43% / 0.30), hsl(152 100% 43% / 0.08) 45%, transparent 75%)',
            filter: 'blur(20px)',
          }}
        />
      </motion.div>

      {/* ── Secondary orb — cooler, lower-right ────────────────────────────── */}
      <motion.div
        style={{ x: orb2X, y: orb2Y }}
        className="absolute -bottom-[18%] -right-[12%] h-[560px] w-[560px] will-change-transform"
      >
        <div
          className="h-full w-full"
          style={{
            background:
              'radial-gradient(closest-side, hsl(213 100% 62% / 0.18), hsl(260 100% 70% / 0.08) 45%, transparent 75%)',
            filter: 'blur(28px)',
          }}
        />
      </motion.div>

      {/* ── Diagonal scan beam ─────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)',
        }}
      >
        <motion.div
          initial={{ x: '-40%', y: '-40%' }}
          animate={{ x: '40%', y: '40%' }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear', repeatType: 'reverse' }}
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, transparent 42%, hsl(152 100% 43% / 0.05) 50%, transparent 58%)',
          }}
        />
      </div>

      {/* ── Noise (anti-banding on OLED) ───────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── Vignette ───────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 90% at 50% 50%, transparent 40%, hsl(0 0% 0% / 0.7) 100%)',
        }}
      />
    </div>
  )
}
