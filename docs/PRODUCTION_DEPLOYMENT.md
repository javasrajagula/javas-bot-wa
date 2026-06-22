# Production Deployment Guide — Javas Bot WA

This document describes the production profile settings, database configurations, and webhook management for Javas Bot WA.

## Production Profile (PostgreSQL + Redis)

While development runs SQLite, production environments utilize:

* **PostgreSQL**: Handled natively by Prisma.
* **Redis**: Used as the cache driver and worker queue manager.

### Env Configuration

```ini
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
REDIS_URL="redis://:pass@host:6379/0"
LOG_LEVEL="info"
```

---

## Webhook retry Queue

Webhook notifications (member join, warning triggers) are queued to prevent blocking runtime threads:

1. **Retries**: Retried up to 3 times on delivery failure.
2. **Backoff**: Uses exponential backoff delays.
3. **Dead-letter Log**: Unresolved webhooks are logged to the `ErrorLog` model in Prisma.
