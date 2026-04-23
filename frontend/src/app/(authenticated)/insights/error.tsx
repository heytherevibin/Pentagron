'use client'

import { ErrorState } from '@/components/shell/error-state'

export default function InsightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Insights failed to load"
      description="Analytics fetches or Recharts rendering failed. Retry, or switch to a different window."
      error={error}
      reset={reset}
    />
  )
}
