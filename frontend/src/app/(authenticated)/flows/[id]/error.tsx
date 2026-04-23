'use client'

import { ErrorState } from '@/components/shell/error-state'

export default function FlowError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Couldn't load this flow"
      description="The flow detail panel failed to render. This is usually transient — retry or return to the flow list."
      error={error}
      reset={reset}
    />
  )
}
