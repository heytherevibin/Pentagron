'use client'

import * as React from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PageShell } from '@/components/shell/page-header'

import { GeneralSettings } from './general'
import { LLMSettings } from './llm'
import { MCPSettings } from './mcp'
import { UsersSettings } from './users'

/**
 * Settings — tabbed workspace for operator administration.
 *
 *   General  — workspace defaults, branding, safe-mode toggle
 *   LLM      — provider credentials, primary/fallback ordering, live test
 *   MCP      — MCP server endpoints, per-server test
 *   Users    — operator accounts (admin-only view)
 */
export default function SettingsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Operator credentials, LLM providers, MCP servers, and workspace defaults."
      />

      <Tabs defaultValue="general" className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="llm">LLM providers</TabsTrigger>
          <TabsTrigger value="mcp">MCP servers</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="llm" className="mt-4">
          <LLMSettings />
        </TabsContent>
        <TabsContent value="mcp" className="mt-4">
          <MCPSettings />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersSettings />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
