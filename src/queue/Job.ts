// src/queue/Job.ts
export enum JobStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface JobData<T = any> {
    id: string;
    type: string;
    payload: T;
    status: JobStatus;
    attempts: number;
    maxAttempts: number;
    createdAt: number;
    updatedAt: number;
    error?: string;
}

export class Job<T = any> {
    private data: JobData<T>;

    constructor(data: JobData<T>) {
        this.data = data;
    }

    get id(): string {
        return this.data.id;
    }

    get type(): string {
        return this.data.type;
    }

    get payload(): T {
        return this.data.payload;
    }

    get status(): JobStatus {
        return this.data.status;
    }

    get attempts(): number {
        return this.data.attempts;
    }

    get maxAttempts(): number {
        return this.data.maxAttempts;
    }

    toJSON(): JobData<T> {
        return { ...this.data };
    }

    static fromJSON<T>(json: string): Job<T> {
        return new Job(JSON.parse(json));
    }

    updateStatus(status: JobStatus, error?: string): void {
        this.data.status = status;
        this.data.updatedAt = Date.now();
        if (error) {
            this.data.error = error;
        }
    }

    incrementAttempts(): void {
        this.data.attempts++;
        this.data.updatedAt = Date.now();
    }

    canRetry(): boolean {
        return this.data.attempts < this.data.maxAttempts;
    }
}