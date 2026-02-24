package docker

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"go.uber.org/zap"
)

// Executor runs commands inside the Kali Linux sandbox container.
type Executor struct {
	docker        *Client
	containerName string
	log           *zap.Logger
}

// NewExecutor creates an Executor targeting the given Kali container.
func NewExecutor(docker *Client, containerName string, log *zap.Logger) *Executor {
	return &Executor{
		docker:        docker,
		containerName: containerName,
		log:           log,
	}
}

// Exec runs a shell command in the Kali sandbox and returns combined stdout+stderr.
// timeoutSecs is the maximum allowed execution time.
func (e *Executor) Exec(ctx context.Context, command string, timeoutSecs int) (string, error) {
	if timeoutSecs <= 0 {
		timeoutSecs = 60
	}

	execCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
	defer cancel()

	cli := e.docker.Inner()

	// Create exec instance
	execCreate, err := cli.ContainerExecCreate(execCtx, e.containerName, types.ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		Cmd:          []string{"/bin/bash", "-c", command},
	})
	if err != nil {
		return "", fmt.Errorf("docker exec create: %w", err)
	}

	// Attach and stream output
	resp, err := cli.ContainerExecAttach(execCtx, execCreate.ID, types.ExecStartCheck{})
	if err != nil {
		return "", fmt.Errorf("docker exec attach: %w", err)
	}
	defer resp.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, resp.Reader); err != nil && err != io.EOF {
		return "", fmt.Errorf("docker exec read output: %w", err)
	}

	output := buf.String()

	// Check exit code
	inspect, err := cli.ContainerExecInspect(execCtx, execCreate.ID)
	if err == nil && inspect.ExitCode != 0 {
		e.log.Warn("command exited with non-zero code",
			zap.String("command", truncateCmd(command)),
			zap.Int("exit_code", inspect.ExitCode),
		)
		// Return output even on non-zero exit — agent decides if it's an error
	}

	e.log.Debug("exec complete",
		zap.String("command", truncateCmd(command)),
		zap.Int("output_len", len(output)),
	)

	return output, nil
}

// truncateCmd shortens long commands for logging.
func truncateCmd(cmd string) string {
	cmd = strings.ReplaceAll(cmd, "\n", " ")
	if len(cmd) > 120 {
		return cmd[:120] + "..."
	}
	return cmd
}

// containerListOptions builds filter options for listing a specific container.
func containerListOptions(name string) container.ListOptions {
	return container.ListOptions{
		Filters: filters.NewArgs(filters.Arg("name", name)),
	}
}

// containerLogsOptions returns log streaming options.
func containerLogsOptions() container.LogsOptions {
	return container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Timestamps: false,
	}
}
