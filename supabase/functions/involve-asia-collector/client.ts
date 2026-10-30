// Minimal client for the Involve Asia publisher API (https://api.involve.asia/docs/).
// Auth: POST /authenticate with key + secret (form-encoded) returns a bearer JWT in data.token,
// valid for 2 hours. List endpoints are POST, form-encoded, and wrap results as
// { status, message, data: { page, limit, count, nextPage, data: [...] } }.

export const BASE_URL = 'https://api.involve.asia/api'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>
export type ApiItem = Record<string, unknown>
export type Params = Record<string, string | number | boolean>

export type ClientOptions = {
  key: string
  secret: string
  baseUrl?: string
  fetch?: FetchLike
  sleep?: (ms: number) => Promise<void>
  /** Safety cap so a pagination bug can never loop forever. */
  maxPages?: number
}

// Involve Asia allows 60 requests/minute; back off like their docs suggest.
const RATE_LIMIT_BACKOFF_MS = [250, 500, 1000, 2000]

export class InvolveAsiaError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message)
    this.name = 'InvolveAsiaError'
  }
}

export class InvolveAsiaClient {
  private token: string | null = null
  private readonly baseUrl: string
  private readonly fetch: FetchLike
  private readonly sleep: (ms: number) => Promise<void>
  private readonly maxPages: number

  constructor(private readonly opts: ClientOptions) {
    this.baseUrl = opts.baseUrl ?? BASE_URL
    this.fetch = opts.fetch ?? ((input, init) => fetch(input, init))
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.maxPages = opts.maxPages ?? 50
  }

  async authenticate(): Promise<string> {
    const res = await this.fetch(`${this.baseUrl}/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ key: this.opts.key, secret: this.opts.secret }),
    })
    const json = await readJson(res)
    const data = (json?.data ?? {}) as ApiItem
    const token = data.token ?? data.access_token
    if (!res.ok || json?.status === 'error' || typeof token !== 'string' || !token) {
      throw new InvolveAsiaError(`Involve Asia authentication failed: ${describe(res, json)}`, res.status)
    }
    this.token = token
    return token
  }

  /** POST to a list endpoint and follow nextPage until the last page. */
  async listAll(path: string, params: Params = {}): Promise<ApiItem[]> {
    const items: ApiItem[] = []
    let page = 1
    for (let i = 0; i < this.maxPages; i++) {
      const data = await this.post(path, { ...params, page, limit: params.limit ?? 100 })
      const rows = Array.isArray(data?.data) ? (data.data as ApiItem[]) : []
      items.push(...rows)
      const next = Number(data?.nextPage)
      if (!rows.length || !Number.isFinite(next) || next <= page) return items
      page = next
    }
    console.warn(`involve-asia: stopped ${path} after ${this.maxPages} pages`)
    return items
  }

  private async post(path: string, params: Params): Promise<ApiItem> {
    if (!this.token) await this.authenticate()
    let reauthed = false
    for (let attempt = 0;; attempt++) {
      const res = await this.fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])),
      })
      const json = await readJson(res)

      // Expired/invalid token: re-authenticate once, then retry.
      if ((res.status === 401 || json?.status_code === 401) && !reauthed) {
        reauthed = true
        await this.authenticate()
        continue
      }
      if (res.status === 429 && attempt < RATE_LIMIT_BACKOFF_MS.length) {
        await this.sleep(RATE_LIMIT_BACKOFF_MS[attempt])
        continue
      }
      if (!res.ok || json?.status !== 'success') {
        throw new InvolveAsiaError(`Involve Asia ${path} failed: ${describe(res, json)}`, res.status)
      }
      return (json.data ?? {}) as ApiItem
    }
  }
}

async function readJson(res: Response): Promise<ApiItem | null> {
  try {
    return (await res.json()) as ApiItem
  } catch {
    return null
  }
}

function describe(res: Response, json: ApiItem | null): string {
  return `HTTP ${res.status}${json?.message ? ` – ${json.message}` : ''}`
}
