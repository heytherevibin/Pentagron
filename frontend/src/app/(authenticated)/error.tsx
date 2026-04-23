'use client'

import { ErrorState } from '@/components/shell/error-state'

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="This section failed to load"
      description="We've logged the error. Try again or jump elsewhere in the app — other routes are unaffected."
      error={error}
      reset={reset}
    />
  )
}
