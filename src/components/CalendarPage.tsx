import { useMemo } from 'react'
import type { Category, Deal, SaleEvent } from '../types'
import { daysBetween, formatDate, formatRange, monthLabel, todayPH } from '../lib/dates'
import DealCard from './DealCard'

export default function CalendarPage({ deals, events, categories }: { deals: Deal[]; events: SaleEvent[]; categories: Category[] }) {
  const today = todayPH()
  const catMap = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories])

  const upcoming = events.filter((e) => e.ends_on >= today)
  const byMonth = useMemo(() => {
    const m = new Map<string, SaleEvent[]>()
    for (const e of upcoming) {
      const k = monthLabel(e.starts_on)
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()]
  }, [upcoming])

  const endingThisWeek = deals
    .filter((d) => d.promo_end && d.promo_end >= today && daysBetween(today, d.promo_end) <= 7)
    .filter((d) => !d.promo_start || d.promo_start <= today)
    .sort((a, b) => (a.promo_end ?? '').localeCompare(b.promo_end ?? ''))

  const dealCount = (id: string) => deals.filter((d) => d.sale_event_id === id).length

  return (
    <section className="calendar">
      <div className="cal-col">
        <h2 className="section-title">Upcoming sale days</h2>
        <p className="section-sub">Mega sales and payday promos. Deals get attached as stores announce them.</p>
        {byMonth.length === 0 && <p className="state">No upcoming sale events yet.</p>}
        {byMonth.map(([month, list]) => (
          <div key={month} className="month">
            <h3 className="month-name">{month}</h3>
            <ol className="events">
              {list.map((e) => {
                const live = e.starts_on <= today
                const days = daysBetween(today, e.starts_on)
                return (
                  <li key={e.id} className={`event ${live ? 'live' : ''}`}>
                    <div className="event-date">
                      <span className="event-day">{formatDate(e.starts_on).split(' ')[1]}</span>
                      <span className="event-mon">{formatDate(e.starts_on).split(' ')[0]}</span>
                    </div>
                    <div className="event-body">
                      <strong>{e.name}</strong>
                      <span>{formatRange(e.starts_on, e.ends_on)}{e.description ? ` · ${e.description}` : ''}</span>
                    </div>
                    <div className="event-side">
                      <span className="countdown">{live ? 'Happening now' : days === 1 ? 'Tomorrow' : `in ${days} days`}</span>
                      <span className="event-count">{dealCount(e.id)} {dealCount(e.id) === 1 ? 'deal' : 'deals'}</span>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>

      <div className="cal-col">
        <h2 className="section-title">Ending this week</h2>
        <p className="section-sub">Last chance — active promos ending within 7 days.</p>
        {endingThisWeek.length === 0 ? (
          <p className="state">Nothing ending this week.</p>
        ) : (
          <div className="stack">
            {endingThisWeek.map((d) => (
              <DealCard key={d.id} deal={d} category={catMap.get(d.category_slug)} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
