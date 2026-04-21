'use client'

import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from './dialog'

/**
 * Command — cmdk primitive, restyled for the Pentagron dark theme.
 *
 * Compose directly or use <CommandDialog /> for the ⌘K launcher pattern.
 */
export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-lg bg-bg-subtle text-fg',
      className,
    )}
    {...props}
  />
))
Command.displayName = 'Command'

interface CommandDialogProps extends React.ComponentProps<typeof Dialog> {
  /** Placeholder text in the search input. */
  placeholder?: string
  /** Text shown when no results match. */
  emptyMessage?: string
  children: React.ReactNode
}

export function CommandDialog({
  children,
  placeholder = 'Search or run a command…',
  emptyMessage = 'No results found.',
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent
        hideClose
        className="p-0 max-w-xl rounded-lg overflow-hidden"
      >
        <Command className="rounded-lg" loop>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {children}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border-subtle" cmdk-input-wrapper="">
    <Search className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-5 w-full bg-transparent text-sm text-fg placeholder:text-fg-subtle',
        'outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = 'CommandInput'

export const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[360px] overflow-y-auto overflow-x-hidden p-1', className)}
    {...props}
  />
))
CommandList.displayName = 'CommandList'

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-8 text-center text-xs text-fg-subtle"
    {...props}
  />
))
CommandEmpty.displayName = 'CommandEmpty'

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden text-fg',
      '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
      '[&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest',
      '[&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-group-heading]]:font-medium',
      className,
    )}
    {...props}
  />
))
CommandGroup.displayName = 'CommandGroup'

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border-subtle', className)}
    {...props}
  />
))
CommandSeparator.displayName = 'CommandSeparator'

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 px-2 py-2 rounded',
      'text-sm text-fg outline-none',
      'transition-colors duration-100',
      'data-[selected=true]:bg-bg-muted data-[selected=true]:text-fg',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40',
      '[&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle',
      className,
    )}
    {...props}
  />
))
CommandItem.displayName = 'CommandItem'

export function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto text-2xs tracking-widest text-fg-subtle font-mono', className)}
      {...props}
    />
  )
}
