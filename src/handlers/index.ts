// src/handlers/index.ts
import { WorkerPool } from '../queue/Worker';

export function registerHandlers(workerPool: WorkerPool): void {
    // Email handler
    workerPool.register('send-email', async (payload: {
        to: string;
        subject: string;
        body: string;
    }) => {
        console.log(`Sending email to ${payload.to}: ${payload.subject}`);
        // Simulate email sending
        await sleep(2000);
        console.log(`Email sent to ${payload.to}`);
    });

    // Image processing handler
    workerPool.register('process-image', async (payload: {
        imageUrl: string;
        operations: string[];
    }) => {
        console.log(`Processing image: ${payload.imageUrl}`);
        // Simulate image processing
        await sleep(3000);
        console.log(`Image processed with operations: ${payload.operations.join(', ')}`);
    });

    // Data export handler
    workerPool.register('export-data', async (payload: {
        userId: string;
        format: string;
    }) => {
        console.log(`Exporting data for user ${payload.userId} in ${payload.format} format`);
        // Simulate data export
        await sleep(5000);
        console.log(`Data export completed for user ${payload.userId}`);
    });

    // Notification handler
    workerPool.register('send-notification', async (payload: {
        userId: string;
        message: string;
        type: string;
    }) => {
        console.log(`Sending ${payload.type} notification to user ${payload.userId}`);
        // Simulate notification sending
        await sleep(1000);
        console.log(`Notification sent: ${payload.message}`);
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}