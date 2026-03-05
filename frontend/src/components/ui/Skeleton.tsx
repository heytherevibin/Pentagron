import { cn } from '@/lib/cn'

interface SkeletonProps {
  className?: string
  variant?: 'line' | 'card' | 'stat'
}

const VARIANT_STYLES: Record<string, string> = {
  line: 'h-4 skeleton-shimmer',
  card: 'h-24 bg-surface-1 border border-border skeleton-shimmer',
  stat: 'h-20 bg-surface-1 border border-border skeleton-shimmer',
}

export function Skeleton({ className, variant = 'line' }: SkeletonProps) {
  return (
    <div className={cn(VARIANT_STYLES[variant], className)} aria-hidden />
  )
}

/** Full-page shell loading: sidebar strip + main content blocks (mi48 pattern). */
export function PageShellSkeleton() {
  return (
    <div className="min-h-screen flex bg-background">
      <div className="w-14 shrink-0 skeleton-shimmer" />
      <div className="flex-1 min-w-0 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

/** Dashboard loading: same outer/inner shell as dashboard + stat grid + panels. */
export function DashboardPageSkeleton() {
  return (
    <div className="min-h-screen dot-grid">
      <div className="w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border">
        <div>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="stat" />
          ))}
        </div>
        <div className="panel border border-border">
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="p-4">
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <div className="panel border border-border">
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="p-4">
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Project detail loading: same shell + header + two panels. */
export function ProjectDetailPageSkeleton() {
  return (
    <div className="min-h-screen dot-grid">
      <div className="w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border">
        <div>
          <Skeleton className="h-5 w-48 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="panel border border-border">
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
        <div className="panel border border-border">
          <div className="px-4 py-3 border-b border-border flex justify-between">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 border-b border-border last:border-b-0"
              >
                <Skeleton className="h-4 w-4 shrink-0" />
                <Skeleton className="h-4 flex-1 max-w-[200px]" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Flow detail loading: same shell + header + 3-column layout placeholders. */
export function FlowDetailPageSkeleton() {
  return (
    <div className="min-h-screen dot-grid flex flex-col">
      <div className="w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 box-border flex flex-col flex-1 min-h-0">
        <header className="shrink-0 border-b border-border px-4 py-4 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <Skeleton className="h-3 w-48" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
          <Skeleton className="h-2 w-full" />
        </header>
        <main className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden min-h-[400px]">
          <div className="flex-1 lg:w-1/2 border-r border-border skeleton-shimmer min-h-[300px]" />
          <div className="lg:w-1/4 border-r border-border p-4 space-y-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="lg:w-1/4 skeleton-shimmer min-h-[200px]" />
        </main>
      </div>
    </div>
  )
}

/** Settings loading: same shell + header + tab bar + content blocks. */
export function SettingsPageSkeleton() {
  return (
    <div className="min-h-screen dot-grid bg-surface-1">
      <div className="w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border">
        <div>
          <Skeleton className="h-5 w-24 mb-1" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="flex gap-0 border-b border-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}
