import type { FetchLike } from './client.ts'

export async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await Deno.readTextFile(new URL(`./fixtures/${name}`, import.meta.url)))
}

export type Call = { path: string; params: Record<string, string>; auth: string | null }

/** A fake fetch that answers each path from a queue of [status, body] responses. */
export function fakeFetch(routes: Record<string, [number, unknown][]>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = []
  const fetch: FetchLike = (input, init) => {
    const path = new URL(input).pathname.replace(/^\/api/, '')
    const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')))
    calls.push({ path, params, auth: new Headers(init?.headers).get('Authorization') })
    const queue = routes[path]
    if (!queue?.length) throw new Error(`unexpected request to ${path}`)
    const [status, body] = queue.length > 1 ? queue.shift()! : queue[0]
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  }
  return { fetch, calls }
}
