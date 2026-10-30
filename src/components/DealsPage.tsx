import { useMemo, useState } from 'react'
import type { Category, Deal, SaleEvent, SortKey, StatusFilter } from '../types'
import { dealTiming, formatDate, todayPH } from '../lib/dates'
import DealCard from './DealCard'

const FAR = '9999-12-31'

export default function DealsPage({ categories, deals, events }: { categories: Category[]; deals: Deal[]; events: SaleEvent[] }) {
  const [category, setCategory] = useState<string>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<SortKey>('ending')
  const [query, setQuery] = useState('')
  const [eventId, setEventId] = useState<string>('all')

  const catMap = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories])
  const today = todayPH()

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of deals) {
      const kind = dealTiming(d.promo_start, d.promo_end, today).kind
      if (kind === 'expired' || (status !== 'all' && kind !== status)) continue
      m.set(d.category_slug, (m.get(d.category_slug) ?? 0) + 1)
    }
    return m
  }, [deals, today, status])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = deals.filter((d) => {
      const t = dealTiming(d.promo_start, d.promo_end, today)
      if (t.kind === 'expired') return false
      if (status !== 'all' && t.kind !== status) return false
      if (category !== 'all' && d.category_slug !== category) return false
      if (eventId !== 'all' && d.sale_event_id !== eventId) return false
      if (q && !`${d.title} ${d.merchant}`.toLowerCase().includes(q)) return false
      return true
    })
    const by: Record<SortKey, (a: Deal, b: Deal) => number> = {
      ending: (a, b) => (a.promo_end ?? FAR).localeCompare(b.promo_end ?? FAR),
      newest: (a, b) => (b.promo_start ?? '').localeCompare(a.promo_start ?? ''),
      upcoming: (a, b) => (a.promo_start ?? FAR).localeCompare(b.promo_start ?? FAR),
      discount: (a, b) => (b.discount_pct ?? -1) - (a.discount_pct ?? -1),
    }
    return list.sort(by[sort])
  }, [deals, query, status, category, eventId, sort, today])

  const upcomingEvents = events.filter((e) => e.ends_on >= today)

  return (
    <section>
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search deals or stores…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search deals"
        />
        <div className="selects">
          <label>
            <span>Show</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="active">Active now</option>
              <option value="upcoming">Upcoming</option>
              <option value="all">Active + upcoming</option>
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="ending">Ending soonest</option>
              <option value="upcoming">Starting soonest</option>
              <option value="newest">Newest promos</option>
              <option value="discount">Biggest discount</option>
            </select>
          </label>
          <label>
            <span>Sale event</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="all">Any</option>
              {upcomingEvents.map((e) => (
                <option key={e.id} value={e.id}>{e.name} · {formatDate(e.starts_on)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="cats" role="group" aria-label="Categories">
        <button type="button" className={category === 'all' ? 'on' : ''} onClick={() => setCategory('all')}>
          All <small>{[...counts.values()].reduce((a, b) => a + b, 0)}</small>
        </button>
        {categories.map((c) => (
          <button key={c.slug} type="button" className={category === c.slug ? 'on' : ''} onClick={() => setCategory(c.slug)}>
            {c.icon} {c.name} <small>{counts.get(c.slug) ?? 0}</small>
          </button>
        ))}
      </div>

      <p className="result-count">{visible.length} {visible.length === 1 ? 'deal' : 'deals'}</p>

      {visible.length === 0 ? (
        <p className="state">No deals match. Try “Active + upcoming” or another category.</p>
      ) : (
        <div className="grid">
          {visible.map((d) => (
            <DealCard key={d.id} deal={d} category={catMap.get(d.category_slug)} />
          ))}
        </div>
      )}
    </section>
  )
}
