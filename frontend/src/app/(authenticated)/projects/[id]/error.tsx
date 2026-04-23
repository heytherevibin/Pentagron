'use client'

import { ErrorState } from '@/components/shell/error-state'

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Couldn't load this project"
      description="Project data failed to render. Retry, or return to the projects list."
      error={error}
      reset={reset}
    />
  )
}
