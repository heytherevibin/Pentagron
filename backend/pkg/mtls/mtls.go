// Package mtls provides mutual TLS helpers for air-gapped worker ↔ server communication.
//
// Overview
//
// When WORKER_MTLS_ENABLED=true the server and each worker node authenticate each
// other via X.509 certificates signed by a shared CA.
//
//   Server side: presents its own cert/key; requires client (worker) cert signed by CA.
//   Worker side: presents its own cert/key; verifies the server cert against CA.
//
// Certificate layout expected on disk (paths configurable via env):
//
//	WORKER_TLS_CA      — path to the PEM-encoded CA certificate (shared by both sides)
//	WORKER_TLS_CERT    — path to the PEM-encoded certificate for this process
//	WORKER_TLS_KEY     — path to the PEM-encoded private key for this process
//
// The same env-var names are used on both the server and worker binary.  The server
// reads them via config.Config; the worker reads them directly from flags/env.
package mtls

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
)

// Config holds the file paths needed to set up a mutual TLS connection.
type Config struct {
	// CACertPath is the path to the PEM-encoded CA certificate.
	// Both the server and worker must trust the same CA.
	CACertPath string

	// CertPath is the path to this process's PEM-encoded certificate.
	CertPath string

	// KeyPath is the path to this process's PEM-encoded private key.
	KeyPath string
}

// NewServerTLSConfig returns a *tls.Config suitable for the Pentagron server.
//
// The server presents its own certificate and requires connecting workers to
// present a certificate signed by the shared CA (RequireAndVerifyClientCert).
func NewServerTLSConfig(cfg Config) (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(cfg.CertPath, cfg.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: load server cert/key: %w", err)
	}

	caPool, err := loadCertPool(cfg.CACertPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: load CA cert: %w", err)
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientCAs:    caPool,
		ClientAuth:   tls.RequireAndVerifyClientCert,
		MinVersion:   tls.VersionTLS13,
	}, nil
}

// NewClientTLSConfig returns a *tls.Config suitable for a worker node HTTP client.
//
// The worker presents its own certificate and verifies the server against the CA.
func NewClientTLSConfig(cfg Config) (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(cfg.CertPath, cfg.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: load worker cert/key: %w", err)
	}

	caPool, err := loadCertPool(cfg.CACertPath)
	if err != nil {
		return nil, fmt.Errorf("mtls: load CA cert: %w", err)
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
	}, nil
}

// loadCertPool reads a PEM-encoded CA certificate from disk and returns a
// *x509.CertPool containing it.
func loadCertPool(caPath string) (*x509.CertPool, error) {
	caPEM, err := os.ReadFile(caPath)
	if err != nil {
		return nil, fmt.Errorf("read CA file %s: %w", caPath, err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(caPEM) {
		return nil, fmt.Errorf("no valid certificates found in %s", caPath)
	}
	return pool, nil
}

// IsEnabled returns true when all three required paths are non-empty.
// Use this to gate whether mTLS is enabled without requiring a full Config parse.
func IsEnabled(caCert, cert, key string) bool {
	return caCert != "" && cert != "" && key != ""
}
