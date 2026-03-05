package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ipBucket tracks the token bucket state for a single IP address.
type ipBucket struct {
	mu        sync.Mutex
	tokens    float64
	lastRefil time.Time
}

// authRateLimiter is a token-bucket rate limiter keyed by client IP.
type authRateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*ipBucket
	rate     float64 // tokens added per second
	capacity float64 // max tokens (= burst size)
}

var loginLimiter = &authRateLimiter{
	buckets:  make(map[string]*ipBucket),
	rate:     0.2,  // 1 attempt per 5 seconds sustained
	capacity: 5,    // burst of up to 5 attempts
}

func init() {
	// Periodically evict stale bucket entries to prevent unbounded memory growth.
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			loginLimiter.evictStale(15 * time.Minute)
		}
	}()
}

func (l *authRateLimiter) allow(ip string) bool {
	l.mu.Lock()
	b, ok := l.buckets[ip]
	if !ok {
		b = &ipBucket{tokens: l.capacity, lastRefil: time.Now()}
		l.buckets[ip] = b
	}
	l.mu.Unlock()

	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(b.lastRefil).Seconds()
	b.tokens += elapsed * l.rate
	if b.tokens > l.capacity {
		b.tokens = l.capacity
	}
	b.lastRefil = now

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

func (l *authRateLimiter) evictStale(maxAge time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := time.Now().Add(-maxAge)
	for ip, b := range l.buckets {
		b.mu.Lock()
		stale := b.lastRefil.Before(cutoff)
		b.mu.Unlock()
		if stale {
			delete(l.buckets, ip)
		}
	}
}

// LoginRateLimit is a Gin middleware that applies token-bucket rate limiting
// to the login endpoint. Returns HTTP 429 when the burst budget is exhausted.
func LoginRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !loginLimiter.allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "too many login attempts — please wait before trying again",
			})
			return
		}
		c.Next()
	}
}
