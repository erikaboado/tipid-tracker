// Supabase Edge Function: pulls Philippine offers + promotions/coupons from Involve Asia
// and upserts them into public.deals. Triggered on a schedule by pg_cron (see
// supabase/cron/schedule_involve_asia_collector.psql). Add ?dry_run=1 to preview without writing.
//
// Secrets (set by .github/workflows/deploy-collector.yml): INVOLVE_ASIA_API_KEY, INVOLVE_ASIA_API_SECRET,
// COLLECTOR_CRON_SECRET. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from '@supabase/supabase-js'
import { InvolveAsiaClient } from './client.ts'
import { collect } from './collector.ts'

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('COLLECTOR_CRON_SECRET')
  if (!cronSecret) return json(500, { error: 'COLLECTOR_CRON_SECRET is not set' })
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', cronSecret)) return json(401, { error: 'unauthorized' })

  const key = Deno.env.get('INVOLVE_ASIA_API_KEY')
  const secret = Deno.env.get('INVOLVE_ASIA_API_SECRET')
  if (!key || !secret) return json(500, { error: 'INVOLVE_ASIA_API_KEY / INVOLVE_ASIA_API_SECRET are not set' })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  try {
    const result = await collect({
      client: new InvolveAsiaClient({ key, secret }),
      dryRun: ['1', 'true'].includes(new URL(req.url).searchParams.get('dry_run') ?? ''),
      upsert: async (rows) => {
        // (source, source_ref) is unique, so reruns update existing deals instead of duplicating them.
        const { error } = await db.from('deals').upsert(rows, { onConflict: 'source,source_ref' })
        if (error) throw new Error(`upsert failed: ${error.message}`)
      },
    })
    console.log('involve-asia-collector', JSON.stringify({ ...result, sample: undefined }))
    return json(200, result)
  } catch (err) {
    console.error('involve-asia-collector failed', err)
    return json(502, { error: err instanceof Error ? err.message : String(err) })
  }
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
