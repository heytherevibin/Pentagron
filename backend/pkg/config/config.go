package config

import (
	"strings"
	"sync"

	"github.com/spf13/viper"
)

var (
	once     sync.Once
	instance *Config
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// Server
	ServerPort string `mapstructure:"SERVER_PORT"`
	ServerHost string `mapstructure:"SERVER_HOST"`
	GinMode    string `mapstructure:"GIN_MODE"`
	LogLevel   string `mapstructure:"LOG_LEVEL"`
	JWTSecret  string `mapstructure:"JWT_SECRET"`
	CORSOrigin string `mapstructure:"CORS_ORIGIN"`

	// Auth
	AdminEmail    string `mapstructure:"ADMIN_EMAIL"`
	AdminPassword string `mapstructure:"ADMIN_PASSWORD"`

	// LLM — defaults
	LLMDefaultProvider string `mapstructure:"LLM_DEFAULT_PROVIDER"`
	LLMDefaultModel    string `mapstructure:"LLM_DEFAULT_MODEL"`

	// LLM — Anthropic
	AnthropicAPIKey  string `mapstructure:"ANTHROPIC_API_KEY"`
	AnthropicBaseURL string `mapstructure:"ANTHROPIC_BASE_URL"`

	// LLM — OpenAI
	OpenAIAPIKey  string `mapstructure:"OPENAI_API_KEY"`
	OpenAIBaseURL string `mapstructure:"OPENAI_BASE_URL"`

	// LLM — OpenRouter
	OpenRouterAPIKey  string `mapstructure:"OPENROUTER_API_KEY"`
	OpenRouterBaseURL string `mapstructure:"OPENROUTER_BASE_URL"`

	// LLM — DeepSeek
	DeepSeekAPIKey  string `mapstructure:"DEEPSEEK_API_KEY"`
	DeepSeekBaseURL string `mapstructure:"DEEPSEEK_BASE_URL"`

	// LLM — Ollama
	OllamaBaseURL string `mapstructure:"OLLAMA_BASE_URL"`

	// Per-agent model overrides
	AgentModelOrchestrator string `mapstructure:"AGENT_MODEL_ORCHESTRATOR"`
	AgentModelPentester    string `mapstructure:"AGENT_MODEL_PENTESTER"`
	AgentModelRecon        string `mapstructure:"AGENT_MODEL_RECON"`
	AgentModelCoder        string `mapstructure:"AGENT_MODEL_CODER"`
	AgentModelReporter     string `mapstructure:"AGENT_MODEL_REPORTER"`
	AgentModelSummarizer   string `mapstructure:"AGENT_MODEL_SUMMARIZER"`

	// Agent behaviour
	AgentMaxIterations    int    `mapstructure:"AGENT_MAX_ITERATIONS"`
	AgentRequireApproval  bool   `mapstructure:"AGENT_REQUIRE_APPROVAL"`
	EvoGraphEnabled       bool   `mapstructure:"EVOGRAPH_ENABLED"`
	VectorStoreEnabled    bool   `mapstructure:"VECTOR_STORE_ENABLED"`
	SummarizerLastSecBytes int64 `mapstructure:"SUMMARIZER_LAST_SEC_BYTES"`
	SummarizerMaxQABytes   int64 `mapstructure:"SUMMARIZER_MAX_QA_BYTES"`

	// Databases
	PostgresUser     string `mapstructure:"POSTGRES_USER"`
	PostgresPassword string `mapstructure:"POSTGRES_PASSWORD"`
	PostgresDB       string `mapstructure:"POSTGRES_DB"`
	PostgresHost     string `mapstructure:"POSTGRES_HOST"`
	PostgresPort     string `mapstructure:"POSTGRES_PORT"`
	PostgresDSN      string `mapstructure:"POSTGRES_DSN"`

	Neo4jURI      string `mapstructure:"NEO4J_URI"`
	Neo4jUser     string `mapstructure:"NEO4J_USER"`
	Neo4jPassword string `mapstructure:"NEO4J_PASSWORD"`

	RedisURL string `mapstructure:"REDIS_URL"`

	// Docker
	DockerSocket      string `mapstructure:"DOCKER_SOCKET"`
	KaliImage         string `mapstructure:"KALI_IMAGE"`
	KaliContainerName string `mapstructure:"KALI_CONTAINER_NAME"`

	// MCP servers
	MCPNaabuURL      string `mapstructure:"MCP_NAABU_URL"`
	MCPSQLMapURL     string `mapstructure:"MCP_SQLMAP_URL"`
	MCPNucleiURL     string `mapstructure:"MCP_NUCLEI_URL"`
	MCPMetasploitURL string `mapstructure:"MCP_METASPLOIT_URL"`

	// Search APIs
	TavilyAPIKey    string `mapstructure:"TAVILY_API_KEY"`
	PerplexityKey   string `mapstructure:"PERPLEXITY_API_KEY"`
	SearxngURL      string `mapstructure:"SEARXNG_URL"`

	// Observability
	LangfuseEnabled   bool   `mapstructure:"LANGFUSE_ENABLED"`
	LangfusePublicKey string `mapstructure:"LANGFUSE_PUBLIC_KEY"`
	LangfuseSecretKey string `mapstructure:"LANGFUSE_SECRET_KEY"`
	LangfuseBaseURL   string `mapstructure:"LANGFUSE_BASE_URL"`

	// Worker mutual TLS
	// When all three paths are set AND WorkerMTLSEnabled is true, the server
	// requires worker nodes to authenticate via client certificates.
	WorkerMTLSEnabled bool   `mapstructure:"WORKER_MTLS_ENABLED"`
	WorkerTLSCACert   string `mapstructure:"WORKER_TLS_CA"`   // path to shared CA cert PEM
	WorkerTLSCert     string `mapstructure:"WORKER_TLS_CERT"` // path to server cert PEM
	WorkerTLSKey      string `mapstructure:"WORKER_TLS_KEY"`  // path to server key PEM
}

// Load reads configuration from environment variables (and .env file if present).
// It is safe to call multiple times — configuration is loaded only once.
func Load() (*Config, error) {
	var loadErr error
	once.Do(func() {
		v := viper.New()

		// Read from .env file if present (non-fatal if missing)
		v.SetConfigFile(".env")
		v.SetConfigType("env")
		_ = v.ReadInConfig()

		// Bind environment variables automatically
		v.AutomaticEnv()
		v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

		// Defaults
		v.SetDefault("SERVER_PORT", "8080")
		v.SetDefault("SERVER_HOST", "0.0.0.0")
		v.SetDefault("GIN_MODE", "release")
		v.SetDefault("LOG_LEVEL", "info")
		v.SetDefault("LLM_DEFAULT_PROVIDER", "anthropic")
		v.SetDefault("LLM_DEFAULT_MODEL", "claude-sonnet-4-6")
		v.SetDefault("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
		v.SetDefault("OPENAI_BASE_URL", "https://api.openai.com/v1")
		v.SetDefault("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
		v.SetDefault("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
		v.SetDefault("OLLAMA_BASE_URL", "http://localhost:11434")
		v.SetDefault("AGENT_MAX_ITERATIONS", 50)
		v.SetDefault("AGENT_REQUIRE_APPROVAL", true)
		v.SetDefault("EVOGRAPH_ENABLED", true)
		v.SetDefault("VECTOR_STORE_ENABLED", true)
		v.SetDefault("SUMMARIZER_LAST_SEC_BYTES", 51200)
		v.SetDefault("SUMMARIZER_MAX_QA_BYTES", 65536)
		v.SetDefault("POSTGRES_USER", "pentagron")
		v.SetDefault("POSTGRES_PASSWORD", "pentagron")
		v.SetDefault("POSTGRES_DB", "pentagron")
		v.SetDefault("POSTGRES_HOST", "postgres")
		v.SetDefault("POSTGRES_PORT", "5432")
		v.SetDefault("POSTGRES_DSN", "")
		v.SetDefault("NEO4J_URI", "bolt://neo4j:7687")
		v.SetDefault("NEO4J_USER", "neo4j")
		v.SetDefault("REDIS_URL", "redis://redis:6379/0")
		v.SetDefault("DOCKER_SOCKET", "/var/run/docker.sock")
		v.SetDefault("KALI_IMAGE", "pentagron-kali:latest")
		v.SetDefault("KALI_CONTAINER_NAME", "pentagron-kali")
		v.SetDefault("MCP_NAABU_URL", "http://mcp-naabu:8000")
		v.SetDefault("MCP_SQLMAP_URL", "http://mcp-sqlmap:8001")
		v.SetDefault("MCP_NUCLEI_URL", "http://mcp-nuclei:8002")
		v.SetDefault("MCP_METASPLOIT_URL", "http://mcp-metasploit:8003")
		v.SetDefault("LANGFUSE_BASE_URL", "http://langfuse-server:3000")
		v.SetDefault("ADMIN_EMAIL", "admin@pentagron.local")
		v.SetDefault("ADMIN_PASSWORD", "changeme")
		v.SetDefault("CORS_ORIGIN", "http://localhost:3000")
		v.SetDefault("AGENT_MODEL_ORCHESTRATOR", "claude-opus-4-6")
		v.SetDefault("AGENT_MODEL_PENTESTER", "claude-opus-4-6")
		v.SetDefault("AGENT_MODEL_RECON", "claude-sonnet-4-6")
		v.SetDefault("AGENT_MODEL_CODER", "claude-sonnet-4-6")
		v.SetDefault("AGENT_MODEL_REPORTER", "claude-haiku-4-5-20251001")
		v.SetDefault("AGENT_MODEL_SUMMARIZER", "claude-haiku-4-5-20251001")
		v.SetDefault("WORKER_MTLS_ENABLED", false)
		v.SetDefault("WORKER_TLS_CA", "")
		v.SetDefault("WORKER_TLS_CERT", "")
		v.SetDefault("WORKER_TLS_KEY", "")

		cfg := &Config{}
		if err := v.Unmarshal(cfg); err != nil {
			loadErr = err
			return
		}
		instance = cfg
	})
	return instance, loadErr
}

// MustLoad loads configuration and panics on error.
func MustLoad() *Config {
	cfg, err := Load()
	if err != nil {
		panic("failed to load configuration: " + err.Error())
	}
	return cfg
}
