FROM golang:1.23-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o mcp-server .

FROM kalilinux/kali-rolling
RUN apt-get update && apt-get install -y --no-install-recommends     naabu nuclei sqlmap metasploit-framework     && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=builder /build/mcp-server /usr/local/bin/mcp-server
EXPOSE ${MCP_PORT:-8000}
CMD ["/usr/local/bin/mcp-server"]
