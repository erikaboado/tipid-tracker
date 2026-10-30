import { useMemo, useState, type FormEvent } from 'react'
import type { Category, Deal, SaleEvent } from '../types'
import { clearSampleDeals, deleteDeal, saveDeal } from '../lib/api'
import { checkRanges, formatRange, todayPH } from '../lib/dates'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Feed deals are refreshed by their collectors, which would overwrite hand edits or bring deleted ones back.
const FEED_SOURCES = new Set(['shopee', 'lazada', 'involve_asia'])

type Editing = { mode: 'new' } | { mode: 'edit'; deal: Deal } | null

export default function AdminDeals({
  categories,
  deals,
  events,
  onChanged,
}: {
  categories: Category[]
  deals: Deal[]
  events: SaleEvent[]
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState<Editing>(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [clearing, setClearing] = useState(false)

  const sampleCount = deals.filter((d) => d.is_sample).length
  const catBySlug = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deals
      .filter((d) => !q || `${d.title} ${d.merchant}`.toLowerCase().includes(q))
      .sort((a, b) => Number(a.is_sample) - Number(b.is_sample) || (b.promo_end ?? '').localeCompare(a.promo_end ?? ''))
  }, [deals, query])

  async function onClearSamples() {
    if (!window.confirm(`Delete all ${sampleCount} sample deals? This cannot be undone.`)) return
    setClearing(true)
    setNotice(null)
    try {
      const n = await clearSampleDeals()
      await onChanged()
      setNotice({ ok: true, text: `Deleted ${n} sample deal${n === 1 ? '' : 's'}.` })
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) })
    } finally {
      setClearing(false)
    }
  }

  async function onSaved(isNew: boolean) {
    setEditing(null)
    await onChanged()
    setNotice({ ok: true, text: isNew ? 'Deal published.' : 'Deal updated.' })
  }

  async function onDelete(d: Deal) {
    if (!window.confirm(`Delete “${d.title}”? This cannot be undone.`)) return
    setNotice(null)
    try {
      await deleteDeal(d.id)
      await onChanged()
      setNotice({ ok: true, text: 'Deal deleted.' })
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) })
    }
  }

  if (editing) {
    return (
      <DealForm
        deal={editing.mode === 'edit' ? editing.deal : null}
        categories={categories}
        events={events}
        onSaved={onSaved}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <>
      <div className="review-actions admin-toolbar">
        <button type="button" className="approve" onClick={() => { setNotice(null); setEditing({ mode: 'new' }) }}>
          + New deal
        </button>
        {sampleCount > 0 && (
          <button type="button" className="ghost danger" onClick={onClearSamples} disabled={clearing}>
            {clearing ? 'Clearing…' : `Clear ${sampleCount} sample deal${sampleCount === 1 ? '' : 's'}`}
          </button>
        )}
      </div>
      {notice && <p className={`notice ${notice.ok ? 'ok' : 'bad'}`}>{notice.text}</p>}
      <div className="form">
        <label className="full">
          <span>Search {deals.length} deals</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title or store" />
        </label>
      </div>
      {shown.length === 0 && <p className="state">No deals yet.</p>}
      <ul className="admin-deals">
        {shown.map((d) => {
          const cat = catBySlug.get(d.category_slug)
          const range = formatRange(d.promo_start, d.promo_end)
          return (
            <li key={d.id} className="admin-deal">
              <div className="admin-deal-body">
                <strong>{d.title}</strong>
                <span>
                  {cat?.icon} {d.merchant}
                  {range && ` · ${range}`}
                  {' · '}
                  {d.is_sample ? 'sample' : d.source}
                </span>
              </div>
              <div className="admin-deal-actions">
                <button type="button" className="ghost small" onClick={() => { setNotice(null); setEditing({ mode: 'edit', deal: d }) }}>
                  Edit
                </button>
                <button type="button" className="ghost small danger" onClick={() => onDelete(d)}>
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function DealForm({
  deal,
  categories,
  events,
  onSaved,
  onCancel,
}: {
  deal: Deal | null
  categories: Category[]
  events: SaleEvent[]
  onSaved: (isNew: boolean) => Promise<void>
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayPH()
  // Past sale events aren't useful for new deals, but keep the one an existing deal already points at.
  const eventOptions = events.filter((e) => e.ends_on >= today || e.id === deal?.sale_event_id)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const str = (k: string) => {
      const v = String(f.get(k) ?? '').trim()
      return v === '' ? null : v
    }
    const num = (k: string) => {
      const v = str(k)
      return v === null ? null : Number(v)
    }
    const input = {
      title: str('title') ?? '',
      merchant: str('merchant') ?? '',
      category_slug: str('category') ?? '',
      url: str('url') ?? '',
      sale_event_id: str('sale_event'),
      price: num('price'),
      original_price: num('original_price'),
      promo_code: str('promo_code'),
      promo_start: str('promo_start'),
      promo_end: str('promo_end'),
      valid_start: str('valid_start'),
      valid_end: str('valid_end'),
    }
    const rangeError = checkRanges(input.promo_start, input.promo_end, input.valid_start, input.valid_end)
    if (rangeError) {
      setError(rangeError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveDeal(deal?.id ?? null, input)
      await onSaved(deal === null)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <article className="card review">
      <h3 className="card-title">{deal ? 'Edit deal' : 'New deal'}</h3>
      {deal && FEED_SOURCES.has(deal.source) && (
        <p className="review-notes">
          This deal comes from the {deal.source} feed. The next feed refresh may overwrite your changes.
        </p>
      )}
      {!deal?.image_url && (
        <p className="section-sub">Product photos come from affiliate feeds only, so this deal shows its category picture.</p>
      )}
      {error && <p className="notice bad">{error}</p>}
      <form onSubmit={onSubmit} className="form">
        <label className="full">
          <span>Title *</span>
          <input name="title" required minLength={5} maxLength={200} defaultValue={deal?.title ?? ''}
            placeholder="e.g. Piso seat sale to Siargao" />
        </label>
        <label className="full">
          <span>Link *</span>
          <input name="url" type="url" required maxLength={2000} defaultValue={deal?.url ?? ''} placeholder="https://" />
        </label>
        <label>
          <span>Store / brand *</span>
          <input name="merchant" required maxLength={100} defaultValue={deal?.merchant ?? ''} />
        </label>
        <label>
          <span>Category *</span>
          <select name="category" required defaultValue={deal?.category_slug ?? ''}>
            <option value="" disabled>Choose…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Promo starts on</span>
          <input name="promo_start" type="date" defaultValue={deal?.promo_start ?? ''} />
        </label>
        <label>
          <span>Promo ends on</span>
          <input name="promo_end" type="date" defaultValue={deal?.promo_end ?? ''} />
        </label>
        <label>
          <span>Valid / travel from</span>
          <input name="valid_start" type="date" defaultValue={deal?.valid_start ?? ''} />
        </label>
        <label>
          <span>Valid / travel until</span>
          <input name="valid_end" type="date" defaultValue={deal?.valid_end ?? ''} />
        </label>
        <label>
          <span>Promo price (₱)</span>
          <input name="price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={deal?.price ?? ''} />
        </label>
        <label>
          <span>Original price (₱)</span>
          <input name="original_price" type="number" min="0" step="0.01" inputMode="decimal"
            defaultValue={deal?.original_price ?? ''} />
        </label>
        <label>
          <span>Sale event</span>
          <select name="sale_event" defaultValue={deal?.sale_event_id ?? ''}>
            <option value="">None</option>
            {eventOptions.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name} ({formatRange(ev.starts_on, ev.ends_on)})</option>
            ))}
          </select>
        </label>
        <label>
          <span>Promo code</span>
          <input name="promo_code" maxLength={50} defaultValue={deal?.promo_code ?? ''} />
        </label>
        <div className="review-actions">
          <button type="submit" className="approve" disabled={busy}>
            {busy ? 'Saving…' : deal ? 'Save changes' : 'Publish deal'}
          </button>
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </form>
    </article>
  )
}
