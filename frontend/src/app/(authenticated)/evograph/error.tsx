'use client'

import { ErrorState } from '@/components/shell/error-state'

export default function EvograhError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Graph renderer crashed"
      description="EvoGraph's canvas failed. This is usually a transient WebGL / canvas issue — try again."
      error={error}
      reset={reset}
    />
  )
}
