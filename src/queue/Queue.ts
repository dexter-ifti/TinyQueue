// src/queue/Queue.ts
import { RedisClient, getRedisClient } from '../redis/client';
import { Job, JobData, JobStatus } from './Job';
import { randomUUID } from 'crypto';

export class Queue {
    private redis: RedisClient | null = null;
    private queueKey = 'queue:jobs';
    private processingKey = 'queue:processing';
    private jobKeyPrefix = 'queue:job:';

    async initialize(): Promise<void> {
        this.redis = await getRedisClient();
    }

    private getJobKey(jobId: string): string {
        return `${this.jobKeyPrefix}${jobId}`;
    }

    async enqueue<T>(type: string, payload: T, maxAttempts = 3): Promise<Job<T>> {
        if (!this.redis) throw new Error('Queue not initialized');

        const jobData: JobData<T> = {
            id: randomUUID(),
            type,
            payload,
            status: JobStatus.PENDING,
            attempts: 0,
            maxAttempts,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const job = new Job(jobData);

        // Store job data
        await this.redis.set(this.getJobKey(job.id), JSON.stringify(job.toJSON()));

        // Add to pending queue (FIFO with LPUSH/RPOP)
        await this.redis.lPush(this.queueKey, job.id);

        return job;
    }

    async dequeue(): Promise<Job | null> {
        if (!this.redis) throw new Error('Queue not initialized');

        // Atomically move from pending to processing
        const jobId = await this.redis.rPopLPush(this.queueKey, this.processingKey);

        if (!jobId) return null;

        const jobJson = await this.redis.get(this.getJobKey(jobId));
        if (!jobJson) return null;

        const job = Job.fromJSON(jobJson);
        job.updateStatus(JobStatus.PROCESSING);
        job.incrementAttempts();

        await this.redis.set(this.getJobKey(job.id), JSON.stringify(job.toJSON()));

        return job;
    }

    async complete(job: Job): Promise<void> {
        if (!this.redis) throw new Error('Queue not initialized');

        job.updateStatus(JobStatus.COMPLETED);
        await this.redis.set(this.getJobKey(job.id), JSON.stringify(job.toJSON()));
        await this.redis.lRem(this.processingKey, 1, job.id);
    }

    async fail(job: Job, error: string): Promise<void> {
        if (!this.redis) throw new Error('Queue not initialized');

        if (job.canRetry()) {
            // Retry with exponential backoff
            const delay = Math.pow(2, job.attempts) * 1000;

            job.updateStatus(JobStatus.PENDING, error);
            await this.redis.set(this.getJobKey(job.id), JSON.stringify(job.toJSON()));
            await this.redis.lRem(this.processingKey, 1, job.id);

            // Add back to queue after delay
            setTimeout(async () => {
                await this.redis!.lPush(this.queueKey, job.id);
            }, delay);
        } else {
            job.updateStatus(JobStatus.FAILED, error);
            await this.redis.set(this.getJobKey(job.id), JSON.stringify(job.toJSON()));
            await this.redis.lRem(this.processingKey, 1, job.id);
        }
    }

    async getJob(jobId: string): Promise<Job | null> {
        if (!this.redis) throw new Error('Queue not initialized');

        const jobJson = await this.redis.get(this.getJobKey(jobId));
        return jobJson ? Job.fromJSON(jobJson) : null;
    }

    async getStats(): Promise<{
        pending: number;
        processing: number;
    }> {
        if (!this.redis) throw new Error('Queue not initialized');

        const [pending, processing] = await Promise.all([
            this.redis.lLen(this.queueKey),
            this.redis.lLen(this.processingKey)
        ]);

        return { pending, processing };
    }
}