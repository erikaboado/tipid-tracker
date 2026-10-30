import { supabase } from './supabase'
import type { Category, Deal, SaleEvent, SubmissionRow, SubmissionStatus } from '../types'

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
  promo_start: string | null
  promo_end: string | null
  valid_start: string | null
  valid_end: string | null
  notes: string | null
}

export async function submitDeal(s: Submission): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('submissions').insert({ ...s, status: 'pending' })
  if (error) throw error
}

// Admin review. Access is enforced by row-level security and the approve_submission() function in the
// database; these calls only work for signed-in users listed in public.admins.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await client().rpc('is_admin')
  if (error) throw error
  return data === true
}

export async function fetchSubmissions(status: SubmissionStatus): Promise<SubmissionRow[]> {
  const { data, error } = await client()
    .from('submissions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: status === 'pending' })
    .limit(200)
  if (error) throw error
  return data as SubmissionRow[]
}

export type ApprovedDeal = {
  title: string
  merchant: string
  category_slug: string
  url: string
  price: number | null
  original_price: number | null
  promo_code: string | null
  promo_start: string | null
  promo_end: string | null
  valid_start: string | null
  valid_end: string | null
  image_url: string | null
}

export async function approveSubmission(id: string, d: ApprovedDeal): Promise<string> {
  const { data, error } = await client().rpc('approve_submission', {
    p_id: id,
    p_title: d.title,
    p_merchant: d.merchant,
    p_category_slug: d.category_slug,
    p_url: d.url,
    p_price: d.price,
    p_original_price: d.original_price,
    p_promo_code: d.promo_code,
    p_promo_start: d.promo_start,
    p_promo_end: d.promo_end,
    p_valid_start: d.valid_start,
    p_valid_end: d.valid_end,
    p_image_url: d.image_url,
  })
  if (error) throw error
  return data as string
}

export async function setSubmissionStatus(id: string, status: 'pending' | 'rejected'): Promise<void> {
  const { error } = await client().from('submissions').update({ status }).eq('id', id)
  if (error) throw error
}
