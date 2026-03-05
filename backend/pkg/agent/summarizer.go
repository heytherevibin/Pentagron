package agent

import (
	"context"
	"fmt"

	"go.uber.org/zap"

	"github.com/pentagron/pentagron/pkg/llm"
)

const (
	// DefaultSummarizerLastSecBytes is the threshold above which the recent
	// conversation tail is summarized. Default threshold (50KB) tuned for long-running engagements.
	DefaultSummarizerLastSecBytes = 51200
	// DefaultSummarizerMaxQABytes is the max allowed total context before
	// aggressive summarization kicks in (64KB).
	DefaultSummarizerMaxQABytes = 65536
)

// Summarizer prevents context overflow during long agent runs by summarizing
// the conversation history once byte thresholds are exceeded.
// Pentagron's chain summarization mechanism.
type Summarizer struct {
	llmMgr        *llm.Manager
	log           *zap.Logger
	lastSecBytes  int64
	maxQABytes    int64
}

// NewSummarizer creates a new Summarizer with default byte limits.
func NewSummarizer(llmMgr *llm.Manager, log *zap.Logger) *Summarizer {
	return &Summarizer{
		llmMgr:       llmMgr,
		log:          log,
		lastSecBytes: DefaultSummarizerLastSecBytes,
		maxQABytes:   DefaultSummarizerMaxQABytes,
	}
}

// MaybeSummarize checks message sizes and summarizes if thresholds are exceeded.
// It modifies the messages slice in-place.
func (s *Summarizer) MaybeSummarize(ctx context.Context, messages *[]llm.Message, model, provider string) error {
	total := totalBytes(*messages)
	if total < s.maxQABytes {
		return nil
	}

	s.log.Info("context threshold exceeded, summarizing",
		zap.Int64("total_bytes", total),
		zap.Int64("max_bytes", s.maxQABytes),
	)

	// Keep the first message (original task) and last N messages intact
	const keepLast = 4
	if len(*messages) <= keepLast+1 {
		return nil
	}

	toSummarize := (*messages)[1 : len(*messages)-keepLast]
	tail := (*messages)[len(*messages)-keepLast:]

	summary, err := s.summarize(ctx, toSummarize, model, provider)
	if err != nil {
		return fmt.Errorf("summarize: %w", err)
	}

	// Replace middle messages with a single summary message
	first := (*messages)[0]
	summaryMsg := llm.Message{
		Role:    llm.RoleUser,
		Content: "[CONTEXT SUMMARY — previous steps condensed]\n\n" + summary,
	}
	*messages = append([]llm.Message{first, summaryMsg}, tail...)

	s.log.Info("summarization complete",
		zap.Int("messages_before", len(toSummarize)+keepLast+1),
		zap.Int("messages_after", len(*messages)),
	)
	return nil
}

// summarize sends the middle messages to the LLM for condensation.
func (s *Summarizer) summarize(ctx context.Context, msgs []llm.Message, model, provider string) (string, error) {
	var content string
	for _, m := range msgs {
		content += fmt.Sprintf("[%s]: %s\n\n", m.Role, m.Content)
	}

	req := llm.ChatRequest{
		Model:    model,
		Messages: []llm.Message{
			{
				Role: llm.RoleUser,
				Content: fmt.Sprintf(`Summarize the following penetration testing agent conversation history.
Preserve: all discovered credentials, vulnerabilities, hosts, services, and key findings.
Be concise but complete. Use bullet points for findings.

HISTORY:
%s`, content),
			},
		},
		MaxTokens: 2048,
	}

	resp, err := s.llmMgr.Chat(ctx, provider, req)
	if err != nil {
		return "", err
	}
	return resp.Content, nil
}

// totalBytes estimates the byte size of all message content, including role
// labels, tool call IDs, tool names, and inputs. This gives a more accurate
// picture of actual context size and ensures summarization triggers before
// the context window is exhausted.
func totalBytes(messages []llm.Message) int64 {
	var total int64
	for _, m := range messages {
		total += int64(len(m.Role)) + int64(len(m.Content)) + int64(len(m.ToolCallID))
		for _, tc := range m.ToolCalls {
			total += int64(len(tc.ID)) + int64(len(tc.Name)) + int64(len(tc.Input))
		}
	}
	return total
}
