import { type ApiItem, InvolveAsiaClient } from './client.ts'
import { type DealRow, mapAll } from './mapper.ts'

export const COUNTRY = 'Philippines'
const UPSERT_CHUNK = 200

export type UpsertDeals = (rows: DealRow[]) => Promise<void>

export type CollectResult = {
  offers: number
  campaigns: number
  mapped: number
  upserted: number
  skipped: Record<string, number>
  dryRun: boolean
  sample?: { offerFields: string[]; campaignFields: string[]; rows: DealRow[] }
}

export async function collect(opts: {
  client: InvolveAsiaClient
  upsert: UpsertDeals
  now?: Date
  dryRun?: boolean
}): Promise<CollectResult> {
  const { client, upsert, dryRun = false } = opts
  const now = opts.now ?? new Date()

  // Offers = the merchants we're approved to promote (name, logo, tracking link, categories).
  const offers = await client.listAll('/offers/all', {
    'filters[offer_country]': COUNTRY,
    'filters[application_status]': 'Approved',
    'filters[offer_status]': 'Active',
  })
  // Campaigns = each merchant's promotions and coupons (dates, voucher code, banner).
  const campaigns = await client.listAll('/campaigns/all', { 'filters[country]': COUNTRY })

  const { rows, skipped } = mapAll(offers, campaigns, now)

  let upserted = 0
  if (!dryRun) {
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK)
      await upsert(chunk)
      upserted += chunk.length
    }
  }

  return {
    offers: offers.length,
    campaigns: campaigns.length,
    mapped: rows.length,
    upserted,
    skipped,
    dryRun,
    ...(dryRun && {
      sample: { offerFields: fieldNames(offers[0]), campaignFields: fieldNames(campaigns[0]), rows: rows.slice(0, 5) },
    }),
  }
}

function fieldNames(item: ApiItem | undefined): string[] {
  return item ? Object.keys(item).sort() : []
}
