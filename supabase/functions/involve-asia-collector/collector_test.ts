import { assertEquals, assertRejects } from '@std/assert'
import { InvolveAsiaClient, InvolveAsiaError } from './client.ts'
import { collect } from './collector.ts'
import type { DealRow } from './mapper.ts'
import { fakeFetch, fixture } from './test_helpers.ts'

const NOW = new Date('2026-10-30T02:00:00Z')
const noSleep = () => Promise.resolve()

async function standardRoutes() {
  return {
    '/authenticate': [[200, await fixture('authenticate.json')]] as [number, unknown][],
    '/offers/all': [[200, await fixture('offers_page1.json')], [200, await fixture('offers_page2.json')]] as [
      number,
      unknown,
    ][],
    '/campaigns/all': [[200, await fixture('campaigns.json')]] as [number, unknown][],
  }
}

/** Stand-in for public.deals with its unique (source, source_ref) constraint. */
function fakeDealsTable() {
  const table = new Map<string, DealRow>()
  return {
    table,
    upsert: (rows: DealRow[]) => {
      for (const r of rows) table.set(`${r.source}|${r.source_ref}`, r)
      return Promise.resolve()
    },
  }
}

Deno.test('authenticates, pages through offers, filters to the Philippines and upserts deals', async () => {
  const { fetch, calls } = fakeFetch(await standardRoutes())
  const db = fakeDealsTable()
  const result = await collect({
    client: new InvolveAsiaClient({ key: 'k', secret: 's', fetch }),
    upsert: db.upsert,
    now: NOW,
  })

  assertEquals(calls[0], { path: '/authenticate', params: { key: 'k', secret: 's' }, auth: null })
  const offerCalls = calls.filter((c) => c.path === '/offers/all')
  assertEquals(offerCalls.map((c) => c.params.page), ['1', '2'])
  assertEquals(offerCalls[0].params['filters[offer_country]'], 'Philippines')
  assertEquals(offerCalls[0].params['filters[application_status]'], 'Approved')
  assertEquals(offerCalls[0].auth, 'Bearer sample.jwt.token')
  assertEquals(calls.find((c) => c.path === '/campaigns/all')!.params['filters[country]'], 'Philippines')

  assertEquals(
    { offers: result.offers, campaigns: result.campaigns, mapped: result.mapped, upserted: result.upserted },
    {
      offers: 3,
      campaigns: 7,
      mapped: 3,
      upserted: 3,
    },
  )
  assertEquals(db.table.size, 3)
})

Deno.test('running twice does not create duplicates', async () => {
  const db = fakeDealsTable()
  for (let i = 0; i < 2; i++) {
    const { fetch } = fakeFetch(await standardRoutes())
    await collect({ client: new InvolveAsiaClient({ key: 'k', secret: 's', fetch }), upsert: db.upsert, now: NOW })
  }
  assertEquals(db.table.size, 3)
})

Deno.test('dry run writes nothing and reports the feed field names', async () => {
  const { fetch } = fakeFetch(await standardRoutes())
  const db = fakeDealsTable()
  const result = await collect({
    client: new InvolveAsiaClient({ key: 'k', secret: 's', fetch }),
    upsert: db.upsert,
    now: NOW,
    dryRun: true,
  })
  assertEquals(db.table.size, 0)
  assertEquals(result.upserted, 0)
  assertEquals(result.sample!.rows.length, 3)
  assertEquals(result.sample!.campaignFields.includes('voucher_code'), true)
})

Deno.test('re-authenticates once when the token has expired', async () => {
  const routes = await standardRoutes()
  routes['/offers/all'].unshift([401, await fixture('token_expired.json')])
  const { fetch, calls } = fakeFetch(routes)
  const result = await collect({
    client: new InvolveAsiaClient({ key: 'k', secret: 's', fetch }),
    upsert: fakeDealsTable().upsert,
    now: NOW,
  })
  assertEquals(calls.filter((c) => c.path === '/authenticate').length, 2)
  assertEquals(result.mapped, 3)
})

Deno.test('backs off and retries when rate limited', async () => {
  const routes = await standardRoutes()
  routes['/campaigns/all'].unshift([429, { message: 'Too Many Requests' }])
  const waits: number[] = []
  const { fetch } = fakeFetch(routes)
  const client = new InvolveAsiaClient({ key: 'k', secret: 's', fetch, sleep: (ms) => (waits.push(ms), noSleep()) })
  const result = await collect({ client, upsert: fakeDealsTable().upsert, now: NOW })
  assertEquals(waits, [250])
  assertEquals(result.mapped, 3)
})

Deno.test('fails clearly when the API key is not approved yet', async () => {
  const { fetch } = fakeFetch({ '/authenticate': [[401, { status: 'error', message: 'Invalid key or secret' }]] })
  await assertRejects(
    () =>
      collect({
        client: new InvolveAsiaClient({ key: 'k', secret: 's', fetch }),
        upsert: fakeDealsTable().upsert,
        now: NOW,
      }),
    InvolveAsiaError,
    'Invalid key or secret',
  )
})
