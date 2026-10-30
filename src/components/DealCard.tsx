import { useState } from 'react'
import type { Category, Deal } from '../types'
import { dealTiming, formatRange, timingLabel } from '../lib/dates'

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })

export default function DealCard({ deal, category }: { deal: Deal; category?: Category }) {
  const [copied, setCopied] = useState(false)
  const timing = dealTiming(deal.promo_start, deal.promo_end)
  const urgent = timing.kind === 'active' && timing.daysLeft !== null && timing.daysLeft <= 2
  const isReddit = deal.credit?.includes('r/')

  async function copyCode() {
    if (!deal.promo_code) return
    try {
      await navigator.clipboard.writeText(deal.promo_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked; code is still visible */
    }
  }

  return (
    <article className={`card ${timing.kind}`}>
      <div className="card-top">
        <span className="chip">{category?.icon} {category?.name ?? deal.category_slug}</span>
        <span className={`timing ${timing.kind} ${urgent ? 'urgent' : ''}`}>{timingLabel(timing)}</span>
      </div>

      <h3 className="card-title">{deal.title}</h3>
      <p className="merchant">{deal.merchant}</p>

      {(deal.price !== null || deal.discount_pct !== null) && (
        <div className="price-row">
          {deal.price !== null && <span className="price">{peso.format(deal.price)}</span>}
          {deal.original_price !== null && <s className="was">{peso.format(deal.original_price)}</s>}
          {deal.discount_pct !== null && deal.discount_pct > 0 && (
            <span className="off">−{Math.round(deal.discount_pct)}%</span>
          )}
        </div>
      )}

      <dl className="dates">
        {(deal.promo_start || deal.promo_end) && (
          <div>
            <dt>Promo</dt>
            <dd>{formatRange(deal.promo_start, deal.promo_end)}</dd>
          </div>
        )}
        {(deal.valid_start || deal.valid_end) && (
          <div>
            <dt>{deal.category_slug === 'travel' ? 'Travel' : 'Valid'}</dt>
            <dd>{formatRange(deal.valid_start, deal.valid_end)}</dd>
          </div>
        )}
      </dl>

      {deal.promo_code && (
        <button type="button" className="code" onClick={copyCode} aria-label={`Copy promo code ${deal.promo_code}`}>
          <span>{deal.promo_code}</span>
          <span className="code-hint">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      )}

      {deal.credit && <p className="credit">{deal.credit}</p>}

      <a className="go" href={deal.url} target="_blank" rel="noopener noreferrer sponsored">
        {isReddit ? 'View on Reddit' : 'Get deal'} →
      </a>
    </article>
  )
}
