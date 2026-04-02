/**
 * Minimal Upstash Redis REST client using native fetch.
 * No npm dependency required — calls the Upstash REST API directly.
 */

const baseUrl = process.env.KV_REST_API_URL!
const token   = process.env.KV_REST_API_TOKEN!

async function redisRequest(args: unknown[]): Promise<unknown> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  const data = await res.json() as { result?: unknown; error?: string }
  if (!res.ok) throw new Error(data?.error ?? `Redis error ${res.status}`)
  return data.result ?? null
}

export const redis = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get<T = string>(key: string): Promise<T | null> {
    const result = await redisRequest(['GET', key])
    return (result ?? null) as T | null
  },
  async set(key: string, value: string, opts?: { ex?: number }): Promise<void> {
    const args: unknown[] = ['SET', key, value]
    if (opts?.ex) args.push('EX', opts.ex)
    await redisRequest(args)
  },
  async del(key: string): Promise<void> {
    await redisRequest(['DEL', key])
  },
  async incr(key: string): Promise<number> {
    const result = await redisRequest(['INCR', key])
    return result as number
  },
  async expire(key: string, seconds: number): Promise<void> {
    await redisRequest(['EXPIRE', key, seconds])
  },
}
