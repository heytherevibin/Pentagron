'use client'

import * as React from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, PageShell } from '@/components/shell/page-header'

import { GeneralSettings } from './general'
import { LLMSettings } from './llm'
import { MCPSettings } from './mcp'
import { UsersSettings } from './users'
import { RbacSettings } from './rbac'
import { ApiKeysSettings } from './api-keys'
import { IntegrationsSettings } from './integrations'
import { SessionsSettings } from './sessions'
import { AuditSettings } from './audit'

/**
 * Settings — tabbed workspace for operator administration.
 *
 *   General       — workspace defaults, branding, safe-mode toggle
 *   LLM           — provider credentials, primary/fallback ordering, live test
 *   MCP           — MCP server endpoints, per-server test
 *   Users         — operator accounts (admin-only view)
 *   Roles         — RBAC role/permission matrix
 *   API keys      — programmatic access tokens, scoped + revocable
 *   Integrations  — Slack/Jira/webhook/email/pagerduty destinations
 *   Sessions      — active sign-ins, revoke per device or all others
 *   Audit log     — immutable record of sensitive actions, exportable
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
          <TabsTrigger value="rbac">Roles</TabsTrigger>
          <TabsTrigger value="api-keys">API keys</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
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
        <TabsContent value="rbac" className="mt-4">
          <RbacSettings />
        </TabsContent>
        <TabsContent value="api-keys" className="mt-4">
          <ApiKeysSettings />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsSettings />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsSettings />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditSettings />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
