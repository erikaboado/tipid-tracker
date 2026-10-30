// Turns Involve Asia offers + campaigns (promotions and coupons) into rows for public.deals.
// Pure functions only, so they can be unit-tested against sample responses.
//
// Involve Asia's public docs list request filters but not the response item fields, so each
// value is read from a short list of likely field names (first non-empty wins). Once the API
// key is approved, run the function with ?dry_run=1 to see the real field names and trim
// these lists if needed.

import type { ApiItem } from './client.ts'

export type DealRow = {
  title: string
  merchant: string
  category_slug: string
  promo_code: string | null
  promo_start: string | null
  promo_end: string | null
  valid_start: string | null
  valid_end: string | null
  url: string
  image_url: string | null
  source: 'involve_asia'
  source_ref: string
  is_sample: false
  updated_at: string
}

export type SkipReason = 'no_id' | 'no_link' | 'expired' | 'not_a_promo'

export const FIELDS = {
  offerId: ['offer_id', 'id'],
  offerMerchant: ['merchant_name', 'advertiser_name', 'brand_name', 'offer_name', 'name'],
  offerLink: ['tracking_link', 'tracking_url', 'affiliate_link', 'aff_link'],
  offerImage: ['logo', 'offer_logo', 'logo_url', 'merchant_logo', 'thumbnail', 'image_url'],
  categories: ['categories', 'category', 'category_name', 'offer_categories'],

  campaignMerchant: ['merchant_name', 'advertiser_name', 'brand_name', 'offer_name'],
  campaignId: ['campaign_banner_id', 'campaign_id', 'banner_id', 'promotion_id', 'id'],
  campaignTitle: ['title', 'campaign_name', 'banner_name', 'promotion_name', 'name'],
  campaignDescription: ['description', 'campaign_description', 'details'],
  promoCode: ['voucher_code', 'coupon_code', 'promo_code', 'code'],
  promoStart: ['start_date', 'campaign_start_date', 'date_start', 'start_time', 'start_at'],
  promoEnd: ['end_date', 'campaign_end_date', 'date_end', 'end_time', 'end_at'],
  validStart: ['valid_start', 'valid_start_date', 'valid_from', 'validity_start', 'redemption_start', 'travel_start'],
  validEnd: ['valid_end', 'valid_end_date', 'valid_until', 'validity_end', 'redemption_end', 'travel_end'],
  campaignLink: ['tracking_link', 'tracking_url', 'deeplink', 'aff_link', 'affiliate_link'],
  campaignImage: ['banner_url', 'banner_image', 'banner_image_url', 'image_url', 'image', 'creative_url', 'banner'],
} as const

// Involve Asia category names → our category slugs. First matching rule wins, so the more
// specific rules come first ("Food Delivery" before "Groceries", "Travel" before "Home").
const CATEGORY_RULES: [RegExp, string][] = [
  [/travel|flight|airline|hotel|booking|tour|vacation|holiday/i, 'travel'],
  [/bank|credit card|finance|financial|e-?wallet|insurance|loan|payment|invest/i, 'bank'],
  [/food delivery|restaurant|dining|food ?& ?beverage|f&b|food/i, 'food'],
  [/grocer|supermarket|household essentials/i, 'groceries'],
  [/beauty|health|cosmetic|skincare|personal care|wellness|pharma/i, 'beauty'],
  [/fashion|apparel|clothing|shoe|footwear|bag|accessor|jewel|watch|lifestyle/i, 'fashion'],
  [/electronic|gadget|mobile|phone|computer|laptop|tech|appliance|gaming/i, 'gadgets'],
  [/home|living|furniture|decor|kitchen|garden/i, 'home'],
]
export const FALLBACK_CATEGORY = 'other'

export function mapCategory(...sources: unknown[]): string {
  const names = sources.flatMap(toNames)
  for (const name of names) {
    for (const [re, slug] of CATEGORY_RULES) if (re.test(name)) return slug
  }
  return FALLBACK_CATEGORY
}

export function indexOffers(offers: ApiItem[]): Map<string, ApiItem> {
  const byId = new Map<string, ApiItem>()
  for (const o of offers) {
    const id = text(pick(o, FIELDS.offerId))
    if (id) byId.set(id, o)
  }
  return byId
}

export function mapCampaign(
  c: ApiItem,
  offersById: Map<string, ApiItem>,
  today: string,
  now: string,
): { row: DealRow } | { skip: SkipReason } {
  const id = text(pick(c, FIELDS.campaignId))
  if (!id) return { skip: 'no_id' }

  const offer = offersById.get(text(c.offer_id) ?? '') ?? {}
  const promoCode = text(pick(c, FIELDS.promoCode))
  const promoStart = toDate(pick(c, FIELDS.promoStart))
  const promoEnd = toDate(pick(c, FIELDS.promoEnd))

  // Evergreen banners with no code and no end date aren't deals; keep coupons and time-boxed promos.
  if (!promoCode && !promoEnd) return { skip: 'not_a_promo' }
  if (promoEnd && promoEnd < today) return { skip: 'expired' }

  const url = httpUrl(pick(c, FIELDS.campaignLink)) ?? httpUrl(pick(offer, FIELDS.offerLink))
  if (!url) return { skip: 'no_link' }

  const merchant = cleanMerchant(
    text(pick(offer, FIELDS.offerMerchant)) ?? text(pick(c, FIELDS.campaignMerchant)) ?? 'Involve Asia merchant',
  )
  const title = text(pick(c, FIELDS.campaignTitle)) ?? text(pick(c, FIELDS.campaignDescription)) ??
    (promoCode ? `${merchant} promo code` : `${merchant} promo`)

  return {
    row: {
      title: title.slice(0, 200),
      merchant,
      category_slug: mapCategory(pick(c, FIELDS.categories), pick(offer, FIELDS.categories)),
      promo_code: promoCode,
      promo_start: promoStart,
      promo_end: promoEnd,
      valid_start: toDate(pick(c, FIELDS.validStart)),
      valid_end: toDate(pick(c, FIELDS.validEnd)),
      url,
      // Only images the feed itself provides: the campaign banner, else the merchant logo.
      image_url: httpUrl(pick(c, FIELDS.campaignImage)) ?? httpUrl(pick(offer, FIELDS.offerImage)),
      source: 'involve_asia',
      source_ref: `campaign:${id}`,
      is_sample: false,
      updated_at: now,
    },
  }
}

export function mapAll(offers: ApiItem[], campaigns: ApiItem[], now: Date) {
  const offersById = indexOffers(offers)
  const today = manilaDate(now)
  const rows = new Map<string, DealRow>() // keyed by source_ref so one batch never upserts a row twice
  const skipped: Record<SkipReason, number> = { no_id: 0, no_link: 0, expired: 0, not_a_promo: 0 }
  for (const c of campaigns) {
    const result = mapCampaign(c, offersById, today, now.toISOString())
    if ('skip' in result) skipped[result.skip]++
    else rows.set(result.row.source_ref, result.row)
  }
  return { rows: [...rows.values()], skipped }
}

// ---- helpers ----

export function pick(obj: ApiItem, keys: readonly string[]): unknown {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

function text(v: unknown): string | null {
  if (typeof v === 'number') return String(v)
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

function toNames(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(toNames)
  if (v && typeof v === 'object') return toNames((v as ApiItem).name ?? (v as ApiItem).category_name)
  const s = text(v)
  return s ? s.split(/[,|;]/).map((p) => p.trim()).filter(Boolean) : []
}

/** Accepts "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS" or ISO strings; returns "YYYY-MM-DD" or null. */
export function toDate(v: unknown): string | null {
  const s = text(v)
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m || m[1] === '0000') return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[0] ? null : m[0]
}

function httpUrl(v: unknown): string | null {
  const s = text(v)
  return s && /^https?:\/\//i.test(s) && s.length <= 2000 ? s : null
}

/** "Lazada PH (CPS)" → "Lazada PH". */
function cleanMerchant(name: string): string {
  return name.replace(/\s*\((?:cps|cpa|cpc|cpm|cpa_both)[^)]*\)\s*/gi, ' ').trim() || name
}

/** Today's date in the Philippines (UTC+8, no DST). */
export function manilaDate(now: Date): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10)
}
