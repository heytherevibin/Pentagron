package mtls

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// ── helpers ───────────────────────────────────────────────────────────────────

// generateTestCA creates a self-signed CA certificate and writes it to a temp file.
// Returns (caCertPath, caKey, caCert).
func generateTestCA(t *testing.T, dir string) (caPath string, caKey *ecdsa.PrivateKey, caCert *x509.Certificate) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate CA key: %v", err)
	}

	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now().Add(-time.Minute),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
	}
	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create CA cert: %v", err)
	}
	cert, _ := x509.ParseCertificate(certDER)

	path := filepath.Join(dir, "ca.pem")
	f, _ := os.Create(path)
	_ = pem.Encode(f, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	f.Close()

	return path, key, cert
}

// generateTestCert creates a certificate signed by the given CA and writes cert+key PEM files.
func generateTestCert(t *testing.T, dir, name string, caKey *ecdsa.PrivateKey, caCert *x509.Certificate) (certPath, keyPath string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate %s key: %v", name, err)
	}

	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: name},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
	}
	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, caCert, &key.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create %s cert: %v", name, err)
	}

	certPath = filepath.Join(dir, name+"-cert.pem")
	keyPath = filepath.Join(dir, name+"-key.pem")

	fc, _ := os.Create(certPath)
	_ = pem.Encode(fc, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	fc.Close()

	keyDER, _ := x509.MarshalECPrivateKey(key)
	fk, _ := os.Create(keyPath)
	_ = pem.Encode(fk, &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	fk.Close()

	return certPath, keyPath
}

// ── IsEnabled ────────────────────────────────────────────────────────────────

func TestIsEnabled_AllSet(t *testing.T) {
	if !IsEnabled("ca.pem", "cert.pem", "key.pem") {
		t.Error("expected true when all three paths are set")
	}
}

func TestIsEnabled_MissingCA(t *testing.T) {
	if IsEnabled("", "cert.pem", "key.pem") {
		t.Error("expected false when CA path is empty")
	}
}

func TestIsEnabled_MissingCert(t *testing.T) {
	if IsEnabled("ca.pem", "", "key.pem") {
		t.Error("expected false when cert path is empty")
	}
}

func TestIsEnabled_MissingKey(t *testing.T) {
	if IsEnabled("ca.pem", "cert.pem", "") {
		t.Error("expected false when key path is empty")
	}
}

func TestIsEnabled_AllEmpty(t *testing.T) {
	if IsEnabled("", "", "") {
		t.Error("expected false when all paths are empty")
	}
}

// ── NewServerTLSConfig ────────────────────────────────────────────────────────

func TestNewServerTLSConfig_Valid(t *testing.T) {
	dir := t.TempDir()
	caPath, caKey, caCert := generateTestCA(t, dir)
	certPath, keyPath := generateTestCert(t, dir, "server", caKey, caCert)

	cfg := Config{CACertPath: caPath, CertPath: certPath, KeyPath: keyPath}
	tlsCfg, err := NewServerTLSConfig(cfg)
	if err != nil {
		t.Fatalf("NewServerTLSConfig: %v", err)
	}
	if tlsCfg == nil {
		t.Fatal("expected non-nil tls.Config")
	}
	if len(tlsCfg.Certificates) != 1 {
		t.Errorf("expected 1 certificate, got %d", len(tlsCfg.Certificates))
	}
	if tlsCfg.ClientCAs == nil {
		t.Error("expected non-nil ClientCAs pool")
	}
}

func TestNewServerTLSConfig_BadCertPath(t *testing.T) {
	dir := t.TempDir()
	caPath, _, _ := generateTestCA(t, dir)

	cfg := Config{CACertPath: caPath, CertPath: "/nonexistent/cert.pem", KeyPath: "/nonexistent/key.pem"}
	_, err := NewServerTLSConfig(cfg)
	if err == nil {
		t.Error("expected error for nonexistent cert/key paths")
	}
}

func TestNewServerTLSConfig_BadCAPath(t *testing.T) {
	dir := t.TempDir()
	_, caKey, caCert := generateTestCA(t, dir)
	certPath, keyPath := generateTestCert(t, dir, "server", caKey, caCert)

	cfg := Config{CACertPath: "/nonexistent/ca.pem", CertPath: certPath, KeyPath: keyPath}
	_, err := NewServerTLSConfig(cfg)
	if err == nil {
		t.Error("expected error for nonexistent CA path")
	}
}

// ── NewClientTLSConfig ────────────────────────────────────────────────────────

func TestNewClientTLSConfig_Valid(t *testing.T) {
	dir := t.TempDir()
	caPath, caKey, caCert := generateTestCA(t, dir)
	certPath, keyPath := generateTestCert(t, dir, "worker", caKey, caCert)

	cfg := Config{CACertPath: caPath, CertPath: certPath, KeyPath: keyPath}
	tlsCfg, err := NewClientTLSConfig(cfg)
	if err != nil {
		t.Fatalf("NewClientTLSConfig: %v", err)
	}
	if tlsCfg == nil {
		t.Fatal("expected non-nil tls.Config")
	}
	if len(tlsCfg.Certificates) != 1 {
		t.Errorf("expected 1 certificate, got %d", len(tlsCfg.Certificates))
	}
	if tlsCfg.RootCAs == nil {
		t.Error("expected non-nil RootCAs pool")
	}
}

func TestNewClientTLSConfig_BadKeyPath(t *testing.T) {
	dir := t.TempDir()
	caPath, caKey, caCert := generateTestCA(t, dir)
	certPath, _ := generateTestCert(t, dir, "worker", caKey, caCert)

	cfg := Config{CACertPath: caPath, CertPath: certPath, KeyPath: "/nonexistent/key.pem"}
	_, err := NewClientTLSConfig(cfg)
	if err == nil {
		t.Error("expected error for nonexistent key path")
	}
}

// ── loadCertPool ──────────────────────────────────────────────────────────────

func TestLoadCertPool_Valid(t *testing.T) {
	dir := t.TempDir()
	caPath, _, _ := generateTestCA(t, dir)

	pool, err := loadCertPool(caPath)
	if err != nil {
		t.Fatalf("loadCertPool: %v", err)
	}
	if pool == nil {
		t.Error("expected non-nil cert pool")
	}
}

func TestLoadCertPool_NonexistentFile(t *testing.T) {
	_, err := loadCertPool("/nonexistent/ca.pem")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}

func TestLoadCertPool_InvalidPEM(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.pem")
	_ = os.WriteFile(path, []byte("this is not valid PEM"), 0600)

	_, err := loadCertPool(path)
	if err == nil {
		t.Error("expected error for invalid PEM content")
	}
}

// ── TLS version enforcement ───────────────────────────────────────────────────

func TestServerTLSConfig_MinTLS13(t *testing.T) {
	dir := t.TempDir()
	caPath, caKey, caCert := generateTestCA(t, dir)
	certPath, keyPath := generateTestCert(t, dir, "server", caKey, caCert)

	tlsCfg, _ := NewServerTLSConfig(Config{CACertPath: caPath, CertPath: certPath, KeyPath: keyPath})
	if tlsCfg.MinVersion != 0x0304 { // tls.VersionTLS13
		t.Errorf("expected TLS 1.3 minimum, got 0x%04x", tlsCfg.MinVersion)
	}
}

func TestClientTLSConfig_MinTLS13(t *testing.T) {
	dir := t.TempDir()
	caPath, caKey, caCert := generateTestCA(t, dir)
	certPath, keyPath := generateTestCert(t, dir, "worker", caKey, caCert)

	tlsCfg, _ := NewClientTLSConfig(Config{CACertPath: caPath, CertPath: certPath, KeyPath: keyPath})
	if tlsCfg.MinVersion != 0x0304 {
		t.Errorf("expected TLS 1.3 minimum, got 0x%04x", tlsCfg.MinVersion)
	}
}
