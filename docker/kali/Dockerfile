FROM kalilinux/kali-rolling

# Avoid interactive prompts during install
ENV DEBIAN_FRONTEND=noninteractive

# Update and install core tools
RUN apt-get update && apt-get upgrade -y

# ── Recon & OSINT ─────────────────────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    nmap masscan \
    amass subfinder dnsx \
    whois dnsutils curl wget \
    git python3 python3-pip \
    && apt-get clean

# ── Web application testing ───────────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    gobuster feroxbuster \
    nikto wpscan \
    sqlmap \
    wfuzz \
    && apt-get clean

# ── Network tools ─────────────────────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    netcat-openbsd \
    tcpdump \
    net-tools \
    iputils-ping \
    traceroute \
    && apt-get clean

# ── Exploitation ──────────────────────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    metasploit-framework \
    && apt-get clean

# ── Impacket (Windows/AD attacks) ────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    impacket-scripts \
    python3-impacket \
    && apt-get clean

# ── AD / Windows ─────────────────────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    evil-winrm \
    bloodhound \
    crackmapexec \
    netexec \
    responder \
    certipy-ad \
    smbclient \
    && apt-get clean

# ── Password attacks ──────────────────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    hydra \
    john \
    hashcat \
    medusa \
    crunch \
    wordlists \
    && apt-get clean

# ── ProjectDiscovery tools (pre-built release binaries, no CGO needed) ─────────
RUN apt-get install -y --no-install-recommends unzip ca-certificates && \
    ARCH=$(dpkg --print-architecture) && \
    for tool in httpx nuclei naabu katana subfinder dnsx; do \
        wget -qO /tmp/${tool}.zip \
            "https://github.com/projectdiscovery/${tool}/releases/latest/download/${tool}_linux_${ARCH}.zip" \
        && unzip -oq /tmp/${tool}.zip ${tool} -d /usr/local/bin/ \
        && rm -f /tmp/${tool}.zip \
        || echo "WARN: skipping ${tool} (download failed)"; \
    done && \
    chmod +x /usr/local/bin/httpx /usr/local/bin/nuclei /usr/local/bin/naabu \
              /usr/local/bin/katana /usr/local/bin/subfinder /usr/local/bin/dnsx 2>/dev/null || true && \
    apt-get clean

# ── Update Nuclei templates ───────────────────────────────────────────────────
RUN nuclei -update-templates 2>/dev/null || true

# ── Misc utilities ────────────────────────────────────────────────────────────
RUN apt-get install -y --no-install-recommends \
    jq \
    vim \
    less \
    file \
    binutils \
    && apt-get clean

RUN rm -rf /var/lib/apt/lists/*

# Keep container running for exec calls
CMD ["tail", "-f", "/dev/null"]
