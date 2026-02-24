-- Pentagron PostgreSQL initialization script
-- Run once on first container start via docker-entrypoint-initdb.d

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;           -- pgvector for semantic memory
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- trigram similarity search

-- ── pgvector memory stores ────────────────────────────────────────────────────
-- The memory_records table is created by GORM AutoMigrate,
-- but we pre-create the vector index here for performance.

-- After AutoMigrate runs, create IVFFlat index for fast approximate NN search:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_embedding
--   ON memory_records USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ── Neo4j connection note ────────────────────────────────────────────────────
-- EvoGraph and recon graph nodes are stored in Neo4j (separate container).
-- PostgreSQL stores: users, projects, flows, tasks, actions, artifacts,
--                    sessions, memory_records, approval_requests.

-- ── Default indexes (supplemental — GORM creates primary indexes) ─────────────
-- These are created after AutoMigrate; listed here for documentation.
--
-- CREATE INDEX IF NOT EXISTS idx_flows_project_id ON flows(project_id);
-- CREATE INDEX IF NOT EXISTS idx_flows_status ON flows(status);
-- CREATE INDEX IF NOT EXISTS idx_tasks_flow_id ON tasks(flow_id);
-- CREATE INDEX IF NOT EXISTS idx_actions_task_id ON actions(task_id);
-- CREATE INDEX IF NOT EXISTS idx_memory_project_type ON memory_records(project_id, store_type);

SELECT 'Pentagron database initialized' AS status;
