import { useEffect, useState } from 'react'
import { fetchAll } from './lib/api'
import { isConfigured } from './lib/supabase'
import type { Category, Deal, SaleEvent } from './types'
import DealsPage from './components/DealsPage'
import CalendarPage from './components/CalendarPage'
import SubmitPage from './components/SubmitPage'

type Tab = 'deals' | 'calendar' | 'submit'

function readTab(): Tab {
  const h = window.location.hash.replace('#/', '')
  return h === 'calendar' || h === 'submit' ? h : 'deals'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readTab)
  const [categories, setCategories] = useState<Category[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [events, setEvents] = useState<SaleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!isConfigured) {
      setError('Supabase is not configured. Copy .env.example to .env and fill in your project URL and publishable key.')
      setLoading(false)
      return
    }
    fetchAll()
      .then((r) => {
        setCategories(r.categories)
        setDeals(r.deals)
        setEvents(r.events)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const hasSamples = deals.some((d) => d.is_sample)

  return (
    <div className="app">
      <header className="masthead">
        <div className="wrap masthead-inner">
          <a href="#/" className="brand">
            <span className="brand-mark" aria-hidden>₱</span>
            <span>
              <span className="brand-name">Tipid Tracker</span>
              <span className="brand-tag">Lahat ng promo, isang lugar.</span>
            </span>
          </a>
          <nav className="tabs" aria-label="Main">
            <a href="#/" className={tab === 'deals' ? 'on' : ''}>Deals</a>
            <a href="#/calendar" className={tab === 'calendar' ? 'on' : ''}>Sale calendar</a>
            <a href="#/submit" className={tab === 'submit' ? 'on' : ''}>Submit a deal</a>
          </nav>
        </div>
      </header>

      {hasSamples && (
        <div className="sample-banner">
          <div className="wrap">Preview mode: these are <strong>sample deals</strong> for testing, not real promos.</div>
        </div>
      )}

      <main className="wrap main">
        {loading && <p className="state">Loading deals…</p>}
        {error && <p className="state error">{error}</p>}
        {!loading && !error && tab === 'deals' && <DealsPage categories={categories} deals={deals} events={events} />}
        {!loading && !error && tab === 'calendar' && <CalendarPage deals={deals} events={events} categories={categories} />}
        {!loading && !error && tab === 'submit' && <SubmitPage categories={categories} />}
      </main>

      <footer className="footer">
        <div className="wrap">
          Tipid Tracker gathers promos from retailers, airlines, banks and the community. Always check the
          merchant's page for full mechanics. Some links may earn us a small commission at no cost to you.
        </div>
      </footer>
    </div>
  )
}
