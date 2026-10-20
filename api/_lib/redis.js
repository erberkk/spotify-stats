// Shared Redis client, reused across invocations on a warm instance.
import { createClient } from 'redis';

let clientPromise = null;

export function getRedis() {
  if (!clientPromise) {
    const { REDIS_URL } = process.env;
    if (!REDIS_URL) throw new Error('REDIS_URL environment variable not set');

    const client = createClient({
      url: REDIS_URL,
      socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(retries * 200, 2000) },
    });
    client.on('error', (err) => console.error('Redis Client Error:', err));
    clientPromise = client.connect().then(() => client).catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export const userKey = (username) => `spotify:user:${username}`;
