// src/server.ts
import express from 'express';
import { Queue } from './queue/Queue';
import { WorkerPool } from './queue/Worker';
import { registerHandlers } from './handlers';
import { closeRedis } from './redis/client';

const app = express();
app.use(express.json());

const queue = new Queue();
const workerPool = new WorkerPool(queue, 5); // 5 concurrent workers

// Initialize and start
async function start() {
    await queue.initialize();
    registerHandlers(workerPool);
    await workerPool.start();
    console.log('✓ TinyQueue started with 5 workers');
}

// API Routes
app.post('/jobs', async (req, res) => {
    try {
        const { type, payload, maxAttempts } = req.body;

        if (!type || !payload) {
            return res.status(400).json({ error: 'type and payload are required' });
        }

        const job = await queue.enqueue(type, payload, maxAttempts);
        res.status(201).json({ jobId: job.id, status: job.status });
    } catch (error) {
        res.status(500).json({ error: 'Failed to enqueue job' });
    }
});

app.get('/jobs/:id', async (req, res) => {
    try {
        const job = await queue.getJob(req.params.id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(job.toJSON());
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch job' });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const stats = await queue.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await workerPool.stop();
    await closeRedis();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;

start().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(console.error);