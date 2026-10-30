export type Category = {
  slug: string
  name: string
  icon: string | null
  sort_order: number
}

export type SaleEvent = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  description: string | null
}

export type Deal = {
  id: string
  title: string
  merchant: string
  category_slug: string
  sale_event_id: string | null
  price: number | null
  original_price: number | null
  discount_pct: number | null
  promo_code: string | null
  promo_start: string | null
  promo_end: string | null
  valid_start: string | null
  valid_end: string | null
  url: string
  image_url: string | null
  source: string
  credit: string | null
  is_sample: boolean
}

export type SortKey = 'ending' | 'newest' | 'upcoming' | 'discount'
export type StatusFilter = 'active' | 'upcoming' | 'all'
