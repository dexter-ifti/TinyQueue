// src/redis/client.ts
import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient;

export async function getRedisClient(): Promise<RedisClient> {
    if (!client) {
        client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        client.on('error', (err) => console.error('Redis Client Error', err));
        await client.connect();
    }

    return client;
}

export async function closeRedis(): Promise<void> {
    if (client) {
        await client.quit();
    }
}