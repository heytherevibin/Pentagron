package memory

import (
	"context"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Manager provides unified access to all memory systems:
//   - VectorStore: 4-class semantic search via pgvector
//   - EvoGraph: evolutionary attack chain intelligence via Neo4j
type Manager struct {
	Vector   *VectorStore
	EvoGraph *EvoGraph
	enabled  struct {
		vector   bool
		evograph bool
	}
}

// NewManager creates a memory Manager.
// Pass nil for either driver to disable that subsystem.
func NewManager(db *gorm.DB, neo4jDriver neo4j.DriverWithContext, log *zap.Logger, vectorEnabled, evographEnabled bool) *Manager {
	m := &Manager{}
	m.enabled.vector = vectorEnabled && db != nil
	m.enabled.evograph = evographEnabled && neo4jDriver != nil

	if m.enabled.vector {
		m.Vector = NewVectorStore(db)
	}
	if m.enabled.evograph {
		m.EvoGraph = NewEvoGraph(neo4jDriver, log)
	}
	return m
}

// StoreMemory saves content to the appropriate vector store class.
// embedding may be nil if vector storage is disabled.
func (m *Manager) StoreMemory(ctx context.Context, projectID string, storeType StoreType, content string, embedding []float32, metadata string) error {
	if !m.enabled.vector || m.Vector == nil {
		return nil
	}
	return m.Vector.Store(ctx, projectID, storeType, content, embedding, metadata)
}

// SearchMemory returns relevant memory entries for a query.
func (m *Manager) SearchMemory(ctx context.Context, projectID string, storeType StoreType, queryEmbedding []float32, topK int) ([]MemoryEntry, error) {
	if !m.enabled.vector || m.Vector == nil {
		return nil, nil
	}
	return m.Vector.Search(ctx, projectID, storeType, queryEmbedding, topK)
}
