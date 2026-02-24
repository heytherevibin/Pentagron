'use client'

import { useEffect, useState } from 'react'
import { projects, flows } from '@/lib/api'
import type { Project, Flow } from '@/types'

export default function Dashboard() {
  const [projectList, setProjectList] = useState<Project[]>([])
  const [flowList, setFlowList] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      projects.list().then(r => setProjectList(r.data)),
    ])
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-pentagron-primary font-mono animate-pulse">
        initializing pentagron...
      </div>
    </div>
  )

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8 border-b border-pentagron-border pb-6">
        <div className="flex items-center gap-3">
          <span className="text-pentagron-primary font-mono text-2xl font-bold">
            [PENTAGRON]
          </span>
          <span className="text-gray-500 text-sm font-mono">
            autonomous ai pentesting framework v0.1.0
          </span>
        </div>
        <p className="text-gray-400 text-sm mt-2">
          {projectList.length} project{projectList.length !== 1 ? 's' : ''} active
        </p>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded text-red-300 font-mono text-sm">
          error: {error}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Projects', value: projectList.length, color: 'text-pentagron-primary' },
          { label: 'Active Flows', value: flowList.filter(f => f.status === 'running').length, color: 'text-blue-400' },
          { label: 'Pending Approvals', value: 0, color: 'text-yellow-400' },
          { label: 'Findings', value: 0, color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-pentagron-surface border border-pentagron-border rounded-lg p-4">
            <div className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            <div className="text-gray-400 text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Projects grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Projects</h2>
          <a
            href="/projects/new"
            className="px-4 py-2 bg-pentagron-primary text-black text-sm font-mono font-bold rounded hover:bg-green-400 transition-colors"
          >
            + new project
          </a>
        </div>

        {projectList.length === 0 ? (
          <div className="border border-dashed border-pentagron-border rounded-lg p-12 text-center">
            <p className="text-gray-500 font-mono text-sm">no projects yet</p>
            <p className="text-gray-600 text-xs mt-2">create a project to start an engagement</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectList.map(project => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-pentagron-surface border border-pentagron-border rounded-lg p-5 hover:border-pentagron-primary transition-colors"
              >
                <h3 className="font-semibold text-white">{project.name}</h3>
                {project.description && (
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{project.description}</p>
                )}
                {project.scope && (
                  <p className="text-gray-600 text-xs font-mono mt-2">scope: {project.scope}</p>
                )}
                <p className="text-gray-600 text-xs mt-3">
                  created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
