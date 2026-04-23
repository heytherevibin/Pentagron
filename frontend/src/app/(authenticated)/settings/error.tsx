'use client'

import { ErrorState } from '@/components/shell/error-state'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Settings failed to load"
      description="The settings panel errored. Your existing configuration is untouched."
      error={error}
      reset={reset}
    />
  )
}
