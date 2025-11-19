# TinyQueue - Redis-Backed Job Queue

A robust, production-ready job queue system built with TypeScript, Redis, Express.js, and Bun. TinyQueue provides FIFO processing, concurrent worker pools, automatic retry mechanisms with exponential backoff, and real-time monitoring.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-red)](https://redis.io/)
[![Bun](https://img.shields.io/badge/Bun-1.x-black)](https://bun.sh/)

## Features

- **FIFO Job Processing** - First-in, first-out queue using Redis lists
- **Concurrent Worker Pool** - Configurable number of parallel workers
- **Automatic Retry Logic** - Exponential backoff for failed jobs
- **Job State Management** - Track jobs through pending → processing → completed/failed states
- **Type-Safe Handler Registration** - Strongly typed job handlers with TypeScript
- **Real-Time Monitoring** - REST API for job status and queue statistics
- **Graceful Shutdown** - Proper cleanup on process termination
- **Atomic Operations** - Redis atomic operations prevent job loss


## Prerequisites

Before you begin, ensure you have the following installed:

- **Bun** >= 1.0.0 ([Installation Guide](https://bun.sh/docs/installation))
- **Redis** >= 6.0 ([Installation Guide](https://redis.io/docs/getting-started/installation/))
- **Node.js** >= 18.0 (if not using Bun exclusively)

## Installation

### 1. Clone or 

```bash
git clone 
cd tinyqueue
```

### 2. Install Dependencies

```bash
bun install 
```

### 3. Set Up Redis

**Docker**
```bash
docker run -d --name redis-queue -p 6379:6379 redis:latest
```


### 4. Verify Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### 5. Start the Application

```bash
bun run dev
```


### Set Environment Variables

Create `.env` file:

```env
PORT=3000
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=5
```

###  Run the Application

```bash
# Development mode with hot reload
bun --watch src/server.ts

# Production mode
bun run src/server.ts
```

You should see:
```
✓ TinyQueue started with 5 workers
Server running on http://localhost:3000
```

## Architecture

### System Overview

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP POST /jobs
       ▼
┌─────────────────────────────────────┐
│         Express Server              │
│  ┌───────────────────────────────┐  │
│  │      Queue Manager            │  │
│  │  • enqueue()                  │  │
│  │  • dequeue()                  │  │
│  │  • complete()                 │  │
│  │  • fail()                     │  │
│  └───────────┬───────────────────┘  │
└──────────────┼──────────────────────┘
               │
               ▼
      ┌────────────────┐
      │     Redis      │
      │  • queue:jobs  │ (Pending)
      │  • queue:proc  │ (Processing)
      │  • queue:job:* │ (Job Data)
      └────────┬───────┘
               │
               ▼
┌──────────────────────────────────────┐
│        Worker Pool (N workers)       │
│  ┌──────────┐  ┌──────────┐         │
│  │ Worker 1 │  │ Worker 2 │  ...    │
│  └────┬─────┘  └────┬─────┘         │
│       │             │                │
│       ▼             ▼                │
│  ┌─────────────────────────────┐    │
│  │     Job Handlers            │    │
│  │  • send-email               │    │
│  │  • process-image            │    │
│  │  • export-data              │    │
│  └─────────────────────────────┘    │
└──────────────────────────────────────┘
```

### Data Flow

1. **Job Submission**: Client sends job via POST `/jobs`
2. **Enqueue**: Job stored in Redis with unique ID, added to pending queue
3. **Dequeue**: Worker atomically moves job from pending to processing
4. **Execute**: Handler processes job payload
5. **Complete/Fail**: Job status updated, removed from processing queue
6. **Retry (if failed)**: Job re-queued with exponential backoff


## API Reference

### Enqueue Job

Create a new job and add it to the queue.

**Endpoint:** `POST /jobs`

**Request Body:**
```json
{
  "type": "send-email",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome!",
    "body": "Thanks for signing up"
  },
  "maxAttempts": 3
}
```

**Response:** `201 Created`
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "send-email",
    "payload": {
      "to": "user@example.com",
      "subject": "Hello World",
      "body": "This is a test email"
    },
    "maxAttempts": 3
  }'
```

### Get Job Status

Retrieve current status and details of a specific job.

**Endpoint:** `GET /jobs/:id`

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "send-email",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome!",
    "body": "Thanks for signing up"
  },
  "status": "completed",
  "attempts": 1,
  "maxAttempts": 3,
  "createdAt": 1700000000000,
  "updatedAt": 1700000002000
}
```

**Job Statuses:**
- `pending` - Job is waiting in queue
- `processing` - Job is currently being processed
- `completed` - Job finished successfully
- `failed` - Job failed after all retry attempts

**cURL Example:**
```bash
curl http://localhost:3000/jobs/550e8400-e29b-41d4-a716-446655440000
```

### Get Queue Statistics

View current queue metrics.

**Endpoint:** `GET /stats`

**Response:** `200 OK`
```json
{
  "pending": 42,
  "processing": 5
}
```

**cURL Example:**
```bash
curl http://localhost:3000/stats
```

### Health Check

Verify the server is running.

**Endpoint:** `GET /health`

**Response:** `200 OK`
```json
{
  "status": "ok"
}
```


## Production Deployment

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Run
CMD ["bun", "run", "src/server.ts"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  tinyqueue:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=10
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis-data:
```

**Deploy:**
```bash
docker-compose up -d
```

### Production Checklist

- [ ] Enable Redis persistence (AOF or RDB)
- [ ] Set up Redis authentication
- [ ] Configure Redis memory limits
- [ ] Enable TLS/SSL for Redis connection
- [ ] Set up log aggregation (ELK, Datadog)
- [ ] Configure application monitoring (Prometheus, Grafana)
- [ ] Set up alerts for queue size thresholds
- [ ] Implement rate limiting on API endpoints
- [ ] Add authentication to API endpoints
- [ ] Set up automated backups for Redis data
- [ ] Configure horizontal pod autoscaling (K8s)
- [ ] Document incident response procedures




## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request


## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/tinyqueue/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/tinyqueue/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/tinyqueue/discussions)

## Acknowledgments

- Built with [Bun](https://bun.sh/)
- Powered by [Redis](https://redis.io/)
- Inspired by [Bull](https://github.com/OptimalBits/bull) and [BullMQ](https://github.com/taskforcesh/bullmq)

---

**Happy queuing!**