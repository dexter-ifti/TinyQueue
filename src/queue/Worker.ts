// src/queue/Worker.ts
import { Queue } from './Queue';
import { Job } from './Job';

export type JobHandler<T = any> = (payload: T) => Promise<void>;

export class WorkerPool {
    private queue: Queue;
    private handlers = new Map<string, JobHandler>();
    private workers: Worker[] = [];
    private isRunning = false;

    constructor(queue: Queue, concurrency = 5) {
        this.queue = queue;
        for (let i = 0; i < concurrency; i++) {
            this.workers.push(new Worker(queue, this.handlers));
        }
    }

    register<T>(type: string, handler: JobHandler<T>): void {
        this.handlers.set(type, handler);
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        await Promise.all(this.workers.map(w => w.start()));
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        await Promise.all(this.workers.map(w => w.stop()));
    }
}

class Worker {
    private queue: Queue;
    private handlers: Map<string, JobHandler>;
    private isRunning = false;
    private pollInterval = 1000;

    constructor(queue: Queue, handlers: Map<string, JobHandler>) {
        this.queue = queue;
        this.handlers = handlers;
    }

    async start(): Promise<void> {
        this.isRunning = true;
        this.process();
    }

    async stop(): Promise<void> {
        this.isRunning = false;
    }

    private async process(): Promise<void> {
        while (this.isRunning) {
            try {
                const job = await this.queue.dequeue();

                if (!job) {
                    await this.sleep(this.pollInterval);
                    continue;
                }

                await this.handleJob(job);
            } catch (error) {
                console.error('Worker error:', error);
                await this.sleep(this.pollInterval);
            }
        }
    }

    private async handleJob(job: Job): Promise<void> {
        const handler = this.handlers.get(job.type);

        if (!handler) {
            await this.queue.fail(job, `No handler registered for type: ${job.type}`);
            return;
        }

        try {
            await handler(job.payload);
            await this.queue.complete(job);
            console.log(`✓ Job ${job.id} (${job.type}) completed`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.queue.fail(job, errorMessage);
            console.error(`✗ Job ${job.id} (${job.type}) failed:`, errorMessage);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}