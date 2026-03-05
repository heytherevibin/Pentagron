package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func neoReadConfig() neo4j.SessionConfig {
	return neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead}
}

// graphNode represents a node for the frontend D3 graph visualization.
type graphNode struct {
	ID         string                 `json:"id"`
	Label      string                 `json:"label"`
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
}

// graphEdge represents a relationship for the frontend D3 graph visualization.
type graphEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"`
}

// GetFlowGraph returns EvoGraph nodes and edges for a given flow by querying Neo4j
// for the AttackChain and all connected nodes via HAS_NODE relationships.
func GetFlowGraph(d *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		flowID := c.Param("id")

		// Verify flow access
		flow := checkFlowAccess(c, d, flowID)
		if flow == nil {
			return
		}

		// Check if EvoGraph is available
		if d.MemMgr == nil || d.MemMgr.EvoGraph == nil {
			c.JSON(http.StatusOK, gin.H{"nodes": []graphNode{}, "edges": []graphEdge{}})
			return
		}

		// Look up sessions for this flow (GORM column for Neo4jChain is neo4j_chain)
		var sessions []struct {
			ID         string
			Neo4jChain string
		}
		if err := d.DB.Raw("SELECT id, neo4j_chain FROM sessions WHERE flow_id = ? ORDER BY created_at DESC", flowID).Scan(&sessions).Error; err != nil || len(sessions) == 0 {
			// No sessions yet — return empty graph
			c.JSON(http.StatusOK, gin.H{"nodes": []graphNode{}, "edges": []graphEdge{}})
			return
		}

		// Collect all session IDs to query Neo4j
		sessionIDs := make([]string, 0, len(sessions))
		for _, s := range sessions {
			sessionIDs = append(sessionIDs, s.ID)
		}

		// Query Neo4j for the attack chain and all connected nodes
		ctx := c.Request.Context()
		neo4jSession := d.MemMgr.EvoGraph.Neo4jDriver().NewSession(ctx, neoReadConfig())
		defer neo4jSession.Close(ctx)

		// Get all chain nodes and their children
		result, err := neo4jSession.Run(ctx, `
			MATCH (c:AttackChain)
			WHERE c.session_id IN $session_ids
			OPTIONAL MATCH (c)-[r:HAS_NODE]->(n)
			RETURN c, r, n
		`, map[string]interface{}{
			"session_ids": sessionIDs,
		})
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"nodes": []graphNode{}, "edges": []graphEdge{}})
			return
		}

		nodeMap := make(map[string]graphNode)
		var edges []graphEdge
		edgeIdx := 0

		for result.Next(ctx) {
			rec := result.Record()

			// Chain node (always present)
			chainRaw, ok := rec.Get("c")
			if ok && chainRaw != nil {
				if node, nodeOk := extractNeo4jNode(chainRaw, "AttackChain"); nodeOk {
					nodeMap[node.ID] = node
				}
			}

			// Child node (may be nil)
			childRaw, ok := rec.Get("n")
			if ok && childRaw != nil {
				if node, nodeOk := extractNeo4jNode(childRaw, ""); nodeOk {
					nodeMap[node.ID] = node

					// Create edge from chain to child
					if chainNode, cOk := extractNeo4jNode(chainRaw, "AttackChain"); cOk {
						edgeIdx++
						edges = append(edges, graphEdge{
							ID:     fmt.Sprintf("e-%d", edgeIdx),
							Source: chainNode.ID,
							Target: node.ID,
							Type:   "HAS_NODE",
						})
					}
				}
			}
		}

		// Convert map to slice
		nodes := make([]graphNode, 0, len(nodeMap))
		for _, n := range nodeMap {
			nodes = append(nodes, n)
		}

		c.JSON(http.StatusOK, gin.H{"nodes": nodes, "edges": edges})
	}
}

// extractNeo4jNode converts a Neo4j node result into a graphNode.
func extractNeo4jNode(raw interface{}, fallbackType string) (graphNode, bool) {
	type neo4jNode interface {
		GetProperties() map[string]interface{}
		Labels() []string
	}

	node, ok := raw.(neo4jNode)
	if !ok {
		return graphNode{}, false
	}

	props := node.GetProperties()
	nodeType := fallbackType
	labels := node.Labels()
	if len(labels) > 0 {
		nodeType = labels[0]
	}

	id, _ := props["id"].(string)
	if id == "" {
		return graphNode{}, false
	}

	// Derive label from type-specific fields
	label := nodeType
	if content, ok := props["content"].(string); ok && len(content) > 0 {
		if len(content) > 40 {
			label = content[:40] + "..."
		} else {
			label = content
		}
	} else if tool, ok := props["tool"].(string); ok {
		label = tool
	} else if objective, ok := props["objective"].(string); ok {
		if len(objective) > 40 {
			label = objective[:40] + "..."
		} else {
			label = objective
		}
	}

	return graphNode{
		ID:         id,
		Label:      label,
		Type:       nodeType,
		Properties: props,
	}, true
}
