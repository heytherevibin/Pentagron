import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

function PentagonIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-neutral-600"
    >
      <path
        d="M24 4L44 18.5L36.5 42H11.5L4 18.5L24 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center w-full">
      <div className="border border-dashed border-border p-12 flex flex-col items-center text-center">
        <div className="mb-4 text-muted">
          {icon ?? <PentagonIcon />}
        </div>
        <p className="text-muted font-mono text-sm">{title}</p>
        {description && (
          <p className="text-muted text-xs mt-1">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
