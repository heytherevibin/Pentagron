package database

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Neo4jClient wraps the official Neo4j driver.
type Neo4jClient struct {
	driver neo4j.DriverWithContext
}

// NewNeo4j creates a new Neo4j driver and verifies connectivity.
func NewNeo4j(uri, user, password string) (*Neo4jClient, error) {
	driver, err := neo4j.NewDriverWithContext(
		uri,
		neo4j.BasicAuth(user, password, ""),
	)
	if err != nil {
		return nil, fmt.Errorf("create neo4j driver: %w", err)
	}

	ctx := context.Background()
	if err := driver.VerifyConnectivity(ctx); err != nil {
		return nil, fmt.Errorf("neo4j connectivity check: %w", err)
	}

	return &Neo4jClient{driver: driver}, nil
}

// Driver returns the underlying Neo4j driver for direct use.
func (c *Neo4jClient) Driver() neo4j.DriverWithContext {
	return c.driver
}

// Session opens a new Neo4j session with write access.
func (c *Neo4jClient) Session(ctx context.Context) neo4j.SessionWithContext {
	return c.driver.NewSession(ctx, neo4j.SessionConfig{
		AccessMode: neo4j.AccessModeWrite,
	})
}

// ReadSession opens a read-only Neo4j session.
func (c *Neo4jClient) ReadSession(ctx context.Context) neo4j.SessionWithContext {
	return c.driver.NewSession(ctx, neo4j.SessionConfig{
		AccessMode: neo4j.AccessModeRead,
	})
}

// Close closes the Neo4j driver.
func (c *Neo4jClient) Close(ctx context.Context) error {
	return c.driver.Close(ctx)
}

// EnsureConstraints creates uniqueness constraints for EvoGraph and recon nodes.
func (c *Neo4jClient) EnsureConstraints(ctx context.Context) error {
	constraints := []string{
		// EvoGraph nodes
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:AttackChain) REQUIRE n.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:ChainStep) REQUIRE n.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:ChainFinding) REQUIRE n.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:ChainDecision) REQUIRE n.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:ChainFailure) REQUIRE n.id IS UNIQUE",
		// Recon nodes
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:Domain) REQUIRE n.name IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:Host) REQUIRE n.ip IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:Service) REQUIRE n.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:Vulnerability) REQUIRE n.id IS UNIQUE",
		"CREATE CONSTRAINT IF NOT EXISTS FOR (n:Credential) REQUIRE n.id IS UNIQUE",
	}

	session := c.Session(ctx)
	defer session.Close(ctx)

	for _, cql := range constraints {
		if _, err := session.Run(ctx, cql, nil); err != nil {
			return fmt.Errorf("constraint %q: %w", cql[:50], err)
		}
	}
	return nil
}
