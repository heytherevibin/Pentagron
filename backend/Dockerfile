# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Download dependencies first (cached layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /bin/pentagron-server ./cmd/server

# ── Stage 2: Dev (with air for hot reload) ────────────────────────────────────
FROM golang:1.23-alpine AS dev

WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY go.mod go.sum ./
RUN go mod download
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM alpine:3.20 AS production

RUN apk add --no-cache ca-certificates wget tzdata

# Copy binary and templates
COPY --from=builder /bin/pentagron-server /usr/local/bin/pentagron-server
COPY --from=builder /app/pkg/templates /app/pkg/templates

WORKDIR /app
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

USER nobody
CMD ["/usr/local/bin/pentagron-server"]
