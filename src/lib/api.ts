import { supabase } from './supabase'
import type { Category, Deal, SaleEvent } from '../types'

export async function fetchAll(): Promise<{ categories: Category[]; deals: Deal[]; events: SaleEvent[] }> {
  if (!supabase) throw new Error('Supabase is not configured. Copy .env.example to .env and fill it in.')
  const [c, d, e] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('deals').select('*').limit(1000),
    supabase.from('sale_events').select('*').order('starts_on'),
  ])
  const err = c.error ?? d.error ?? e.error
  if (err) throw err
  return { categories: c.data as Category[], deals: d.data as Deal[], events: e.data as SaleEvent[] }
}

export type Submission = {
  title: string
  url: string
  category_slug: string | null
  merchant: string | null
  price: number | null
  promo_end: string | null
  notes: string | null
}

export async function submitDeal(s: Submission): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('submissions').insert({ ...s, status: 'pending' })
  if (error) throw error
}
