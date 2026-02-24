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

# ── Go-based tools (installed via pre-built binaries) ─────────────────────────
RUN apt-get install -y --no-install-recommends golang-go && \
    go install github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest && \
    go install github.com/projectdiscovery/katana/cmd/katana@latest && \
    go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest && \
    cp /root/go/bin/* /usr/local/bin/ && \
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
