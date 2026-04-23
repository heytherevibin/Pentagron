'use client'

import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * DataTable — the single primitive for every tabular list in the app.
 *
 * Design goals:
 *  • Column-driven (no JSX-in-body) so rows stay scannable and consistent.
 *  • Selectable rows with a tri-state header checkbox (select all / page).
 *  • Sort by a column (ascending / descending / off).
 *  • Density toggle ('compact' | 'cozy') — controlled by caller.
 *  • Optional pagination footer — controlled externally (server or client).
 *  • Graceful loading, empty, and error states baked in.
 *
 * This component is intentionally *headless-lite*: we own the chrome, the
 * caller owns the data and state. Nothing is fetched here.
 */

export type ColumnAlign = 'left' | 'right' | 'center'

export type Column<T> = {
  /** Stable key — used for sort comparisons and React key. */
  id: string
  /** Header label. Pass a node for icons / tooltips. */
  header: React.ReactNode
  /** Render cell content from row. */
  cell: (row: T) => React.ReactNode
  /** Text alignment. */
  align?: ColumnAlign
  /** Enable sorting on this column. Provide `sortValue` to override default. */
  sortable?: boolean
  /** Extract the primitive value used for sort comparison. */
  sortValue?: (row: T) => string | number
  /** Fixed column width (px) — use sparingly. */
  width?: number | string
  /** Hide at narrow viewports. */
  hideOnMobile?: boolean
  /** Per-cell className. */
  className?: string
  /** Per-header className. */
  headerClassName?: string
}

export type SortState = { columnId: string; direction: 'asc' | 'desc' } | null

export type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  /** Unique key extractor. */
  getRowId: (row: T) => string
  /** Optional — row-level click handler. */
  onRowClick?: (row: T) => void
  /** Optional — sort state, caller-controlled. */
  sort?: SortState
  onSortChange?: (next: SortState) => void
  /** Optional — selection state, caller-controlled set of ids. */
  selected?: Set<string>
  onSelectChange?: (next: Set<string>) => void
  /** Visual density. */
  density?: 'compact' | 'cozy'
  /** Loading skeleton rows. */
  loading?: boolean
  /** Error banner. */
  error?: string | null
  /** Empty state. */
  empty?: React.ReactNode
  /** Pagination UI. If omitted, no footer. */
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
  /** Class overrides. */
  className?: string
  /** Sticky header — defaults true. */
  stickyHeader?: boolean
  /** Aria-label for screen readers. */
  ariaLabel?: string
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  sort = null,
  onSortChange,
  selected,
  onSelectChange,
  density = 'compact',
  loading,
  error,
  empty,
  pagination,
  className,
  stickyHeader = true,
  ariaLabel,
}: DataTableProps<T>) {
  const selectable = Boolean(selected && onSelectChange)
  const rowHeight = density === 'compact' ? 'h-10' : 'h-12'
  const cellPad = density === 'compact' ? 'px-3 py-2' : 'px-3 py-3'

  // Selection — tri-state header
  const pageIds = React.useMemo(() => rows.map((r) => getRowId(r)), [rows, getRowId])
  const allSelectedOnPage =
    selectable && pageIds.length > 0 && pageIds.every((id) => selected!.has(id))
  const someSelectedOnPage =
    selectable && !allSelectedOnPage && pageIds.some((id) => selected!.has(id))
  const headerCheckboxState: boolean | 'indeterminate' = allSelectedOnPage
    ? true
    : someSelectedOnPage
      ? 'indeterminate'
      : false

  const togglePage = (checked: boolean) => {
    if (!onSelectChange || !selected) return
    const next = new Set(selected)
    if (checked) pageIds.forEach((id) => next.add(id))
    else pageIds.forEach((id) => next.delete(id))
    onSelectChange(next)
  }

  const toggleRow = (id: string, checked: boolean) => {
    if (!onSelectChange || !selected) return
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    onSelectChange(next)
  }

  // Sort dispatcher — cycles none → asc → desc → none
  const cycleSort = (columnId: string) => {
    if (!onSortChange) return
    if (!sort || sort.columnId !== columnId) {
      onSortChange({ columnId, direction: 'asc' })
    } else if (sort.direction === 'asc') {
      onSortChange({ columnId, direction: 'desc' })
    } else {
      onSortChange(null)
    }
  }

  // Sort rows (stable, client-side) if caller didn't already sort
  const sortedRows = React.useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.id === sort.columnId)
    if (!col || !col.sortable) return rows
    const extract = col.sortValue ?? ((r: T) => String(col.cell(r)))
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = extract(a)
      const vb = extract(b)
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb))
      return sort.direction === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sort, columns])

  const totalCols = columns.length + (selectable ? 1 : 0)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-bg-subtle/40',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
        >
          <thead
            className={cn(
              'text-2xs font-mono uppercase tracking-widest text-fg-subtle',
              'bg-bg-muted/60 border-b border-border-subtle',
              stickyHeader && 'sticky top-0 z-10 backdrop-blur-sm',
            )}
          >
            <tr className="h-9">
              {selectable && (
                <th className="w-9 px-3">
                  <Checkbox
                    checked={headerCheckboxState}
                    onCheckedChange={(v) => togglePage(Boolean(v))}
                    aria-label="Select page"
                  />
                </th>
              )}
              {columns.map((col) => {
                const sorted = sort?.columnId === col.id ? sort.direction : null
                return (
                  <th
                    key={col.id}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'px-3 text-left font-mono',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.headerClassName,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(col.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 hover:text-fg transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 rounded',
                          sorted && 'text-fg',
                        )}
                      >
                        <span>{col.header}</span>
                        <SortIcon direction={sorted} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border-subtle/70 [&_td]:tabular">
            {loading && rows.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className={rowHeight}>
                    {selectable && (
                      <td className={cellPad}>
                        <Skeleton className="h-4 w-4 rounded" />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          cellPad,
                          col.align === 'right' && 'text-right',
                          col.hideOnMobile && 'hidden md:table-cell',
                        )}
                      >
                        <Skeleton className="h-3.5 w-[60%]" />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedRows.map((row) => {
                  const id = getRowId(row)
                  const isSelected = selectable && selected!.has(id)
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        rowHeight,
                        'transition-[background-color,box-shadow] duration-120 ease-out-quart',
                        // Accent-left indicator on hover via inset shadow —
                        // no border shift, no layout reflow.
                        'hover:bg-bg-muted/50 hover:shadow-[inset_2px_0_0_0_hsl(var(--accent)/0.55)]',
                        isSelected &&
                          'bg-accent/5 shadow-[inset_2px_0_0_0_hsl(var(--accent))]',
                        onRowClick && 'cursor-pointer',
                      )}
                    >
                      {selectable && (
                        <td
                          className={cellPad}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => toggleRow(id, Boolean(v))}
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={cn(
                            cellPad,
                            col.align === 'right' && 'text-right',
                            col.align === 'center' && 'text-center',
                            col.hideOnMobile && 'hidden md:table-cell',
                            col.className,
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
          </tbody>

          {!loading && rows.length === 0 && (
            <tfoot>
              <tr>
                <td colSpan={totalCols} className="p-10 text-center">
                  {error ? (
                    <div className="text-sm text-danger">{error}</div>
                  ) : (
                    empty ?? (
                      <div className="text-sm text-fg-muted">No results.</div>
                    )
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pagination && (
        <DataTablePagination {...pagination} />
      )}
    </div>
  )
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  // One icon that rotates — avoids the visual "jump" of swapping glyphs
  // between asc/desc. Off-state uses a neutral dual-chevron at 50% opacity.
  if (direction === null) {
    return <ChevronsUpDown className="h-3 w-3 opacity-50 transition-opacity duration-120" />
  }
  return (
    <ChevronDown
      className={cn(
        'h-3 w-3 transition-transform duration-180 ease-out-quart',
        direction === 'asc' && 'rotate-180',
      )}
    />
  )
}

function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2.5 text-2xs text-fg-subtle font-mono">
      <div>
        {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-1.5 text-fg-muted">
          {page} / {pages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

/** Ready-made bulk-actions bar that slides in above the table when rows selected. */
export function BulkActionsBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <div
      className={cn(
        'sticky top-14 z-20 mb-3',
        'flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2',
        'animate-fade-in',
      )}
    >
      <span className="text-xs font-medium text-fg">
        {count} selected
      </span>
      <span className="h-4 w-px bg-border-strong" />
      <div className="flex flex-1 items-center gap-1.5">{children}</div>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
        Clear
      </Button>
    </div>
  )
}
