import { assertEquals } from '@std/assert'
import type { ApiItem } from './client.ts'
import { manilaDate, mapAll, mapCategory, toDate } from './mapper.ts'
import { fixture } from './test_helpers.ts'

const NOW = new Date('2026-10-30T02:00:00Z')

async function sample() {
  const page1 = (await fixture('offers_page1.json')) as { data: { data: ApiItem[] } }
  const page2 = (await fixture('offers_page2.json')) as { data: { data: ApiItem[] } }
  const campaigns = (await fixture('campaigns.json')) as { data: { data: ApiItem[] } }
  return mapAll([...page1.data.data, ...page2.data.data], campaigns.data.data, NOW)
}

Deno.test('maps a coupon campaign with promo period, code, banner and affiliate link', async () => {
  const { rows } = await sample()
  assertEquals(rows.find((r) => r.source_ref === 'campaign:9001'), {
    title: '11.11 Mega Sale: extra ₱150 off',
    merchant: 'Lazada PH',
    category_slug: 'gadgets',
    promo_code: 'LAZ1111',
    promo_start: '2026-11-01',
    promo_end: '2026-11-11',
    valid_start: null,
    valid_end: null,
    url: 'https://invol.co/cl1234',
    image_url: 'https://img.example-cdn.com/banners/laz-1111.jpg',
    source: 'involve_asia',
    source_ref: 'campaign:9001',
    is_sample: false,
    updated_at: NOW.toISOString(),
  })
})

Deno.test('keeps a separate valid / travel period and falls back to the offer tracking link', async () => {
  const { rows } = await sample()
  const klook = rows.find((r) => r.source_ref === 'campaign:9002')!
  assertEquals(klook.category_slug, 'travel')
  assertEquals([klook.promo_start, klook.promo_end], ['2026-10-25', '2026-11-15'])
  assertEquals([klook.valid_start, klook.valid_end], ['2026-12-01', '2027-03-31'])
  assertEquals(klook.promo_code, null)
  assertEquals(klook.url, 'https://invol.co/aff_m?offer_id=202&aff_id=1')
})

Deno.test('open-ended coupon: title from description, zero dates become null, no invented image', async () => {
  const { rows } = await sample()
  const zalora = rows.find((r) => r.source_ref === 'campaign:9003')!
  assertEquals(zalora.title, 'Extra 20% off new arrivals')
  assertEquals(zalora.category_slug, 'fashion')
  assertEquals([zalora.promo_start, zalora.promo_end], [null, null])
  assertEquals(zalora.image_url, null) // neither banner nor logo in the feed
})

Deno.test('skips expired promos, evergreen banners and promos without an affiliate link; dedupes repeats', async () => {
  const { rows, skipped } = await sample()
  assertEquals(rows.map((r) => r.source_ref).sort(), ['campaign:9001', 'campaign:9002', 'campaign:9003'])
  assertEquals(skipped, { no_id: 0, no_link: 1, expired: 1, not_a_promo: 1 })
})

Deno.test('mapping is deterministic, so reruns produce the same upsert keys', async () => {
  const a = await sample()
  const b = await sample()
  assertEquals(a.rows, b.rows)
})

Deno.test('mapCategory', () => {
  assertEquals(mapCategory('Food & Beverage'), 'food')
  assertEquals(mapCategory(['Health & Beauty']), 'beauty')
  assertEquals(mapCategory('Banking & Finance'), 'bank')
  assertEquals(mapCategory([{ name: 'Home & Living' }]), 'home')
  assertEquals(mapCategory('Groceries'), 'groceries')
  assertEquals(mapCategory(undefined, 'Flights'), 'travel')
  assertEquals(mapCategory('Marketplace'), 'other')
  assertEquals(mapCategory(), 'other')
})

Deno.test('toDate', () => {
  assertEquals(toDate('2026-11-11 23:59:59'), '2026-11-11')
  assertEquals(toDate('2026-11-11T16:00:00Z'), '2026-11-11')
  assertEquals(toDate('0000-00-00 00:00:00'), null)
  assertEquals(toDate('2026-02-30'), null)
  assertEquals(toDate('soon'), null)
  assertEquals(toDate(null), null)
})

Deno.test('manilaDate uses Philippine time', () => {
  assertEquals(manilaDate(new Date('2026-10-30T17:00:00Z')), '2026-10-31')
  assertEquals(manilaDate(new Date('2026-10-30T15:59:00Z')), '2026-10-30')
})
