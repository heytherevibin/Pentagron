package memory

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// StoreType categorises the four vector memory classes.
type StoreType string

const (
	StoreGuide    StoreType = "guide"    // reusable methodologies
	StoreTask     StoreType = "task"     // task-specific knowledge
	StoreResearch StoreType = "research" // research findings
	StoreResult   StoreType = "result"   // execution results
)

// VectorStore provides semantic search over the four pgvector memory classes.
type VectorStore struct {
	db *gorm.DB
}

// NewVectorStore creates a VectorStore backed by PostgreSQL + pgvector.
func NewVectorStore(db *gorm.DB) *VectorStore {
	return &VectorStore{db: db}
}

// MemoryEntry is a record returned from a semantic search.
type MemoryEntry struct {
	ID        string    `json:"id"`
	StoreType StoreType `json:"store_type"`
	Content   string    `json:"content"`
	Metadata  string    `json:"metadata"`
	Score     float64   `json:"score"`
}

// Store saves a new memory entry with its embedding vector.
// embedding should be a 1536-dimension float slice (OpenAI text-embedding-3-small compatible).
func (v *VectorStore) Store(ctx context.Context, projectID string, storeType StoreType, content string, embedding []float32, metadata string) error {
	if metadata == "" {
		metadata = "{}"
	}

	// Use raw SQL for pgvector INSERT
	sql := `
		INSERT INTO memory_records (id, project_id, store_type, content, embedding, metadata, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5::jsonb, NOW())`

	return v.db.WithContext(ctx).Exec(sql, projectID, string(storeType), content, formatVector(embedding), metadata).Error
}

// Search returns the top-k most semantically similar entries to the query embedding.
func (v *VectorStore) Search(ctx context.Context, projectID string, storeType StoreType, queryEmbedding []float32, topK int) ([]MemoryEntry, error) {
	if topK == 0 {
		topK = 5
	}

	sql := `
		SELECT id::text, store_type, content, metadata,
		       1 - (embedding <=> $1::vector) AS score
		FROM memory_records
		WHERE project_id = $2 AND store_type = $3
		ORDER BY embedding <=> $1::vector
		LIMIT $4`

	rows, err := v.db.WithContext(ctx).Raw(sql, formatVector(queryEmbedding), projectID, string(storeType), topK).Rows()
	if err != nil {
		return nil, fmt.Errorf("vector search: %w", err)
	}
	defer rows.Close()

	var results []MemoryEntry
	for rows.Next() {
		var entry MemoryEntry
		if err := rows.Scan(&entry.ID, &entry.StoreType, &entry.Content, &entry.Metadata, &entry.Score); err != nil {
			return nil, err
		}
		results = append(results, entry)
	}
	return results, nil
}

// Delete removes a memory entry by ID.
func (v *VectorStore) Delete(ctx context.Context, id string) error {
	return v.db.WithContext(ctx).Exec("DELETE FROM memory_records WHERE id = $1", id).Error
}

// formatVector converts a float32 slice to a pgvector-compatible string like [0.1,0.2,...].
func formatVector(v []float32) string {
	if len(v) == 0 {
		return "[]"
	}
	s := "["
	for i, f := range v {
		if i > 0 {
			s += ","
		}
		s += fmt.Sprintf("%.8f", f)
	}
	s += "]"
	return s
}
