package docker

import (
	"context"
	"fmt"
	"io"

	"github.com/docker/docker/client"
)

// Client wraps the Docker SDK client for container management.
type Client struct {
	cli *client.Client
}

// NewClient creates a Docker client from the default socket or DOCKER_SOCKET env.
func NewClient(socketPath string) (*Client, error) {
	opts := []client.Opt{client.FromEnv, client.WithAPIVersionNegotiation()}
	if socketPath != "" {
		opts = append(opts, client.WithHost("unix://"+socketPath))
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("create docker client: %w", err)
	}

	return &Client{cli: cli}, nil
}

// Inner returns the underlying Docker SDK client.
func (c *Client) Inner() *client.Client {
	return c.cli
}

// Ping checks that the Docker daemon is reachable.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.cli.Ping(ctx)
	return err
}

// ContainerRunning returns true if the named container is currently running.
func (c *Client) ContainerRunning(ctx context.Context, name string) (bool, error) {
	containers, err := c.cli.ContainerList(ctx, containerListOptions(name))
	if err != nil {
		return false, fmt.Errorf("list containers: %w", err)
	}
	return len(containers) > 0, nil
}

// ReadContainerLogs streams logs from the named container.
func (c *Client) ReadContainerLogs(ctx context.Context, name string) (io.ReadCloser, error) {
	return c.cli.ContainerLogs(ctx, name, containerLogsOptions())
}
