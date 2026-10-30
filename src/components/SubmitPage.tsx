import { useState, type FormEvent } from 'react'
import type { Category } from '../types'
import { submitDeal } from '../lib/api'
import { checkRanges, todayPH } from '../lib/dates'

type State = 'idle' | 'sending' | 'sent' | 'error'

export default function SubmitPage({ categories }: { categories: Category[] }) {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const str = (k: string) => {
      const v = String(f.get(k) ?? '').trim()
      return v === '' ? null : v
    }
    const price = str('price')
    const rangeError = checkRanges(str('promo_start'), str('promo_end'), str('valid_start'), str('valid_end'))
    if (rangeError) {
      setState('error')
      setMessage(rangeError)
      return
    }
    setState('sending')
    try {
      await submitDeal({
        title: str('title') ?? '',
        url: str('url') ?? '',
        category_slug: str('category'),
        merchant: str('merchant'),
        price: price ? Number(price) : null,
        promo_start: str('promo_start'),
        promo_end: str('promo_end'),
        valid_start: str('valid_start'),
        valid_end: str('valid_end'),
        notes: str('notes'),
      })
      form.reset()
      setState('sent')
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <section className="submit">
      <h2 className="section-title">Submit a deal</h2>
      <p className="section-sub">Spotted a promo? Share it. We check every submission before it goes live.</p>

      {state === 'sent' && <p className="notice ok">Salamat! Your deal was sent for review.</p>}
      {state === 'error' && <p className="notice bad">{message}</p>}

      <form onSubmit={onSubmit} className="form">
        <label className="full">
          <span>What's the deal? *</span>
          <input name="title" required minLength={5} maxLength={200} placeholder="e.g. Buy 1 Take 1 milk tea, Nov 1–3" />
        </label>
        <label className="full">
          <span>Link to the promo *</span>
          <input name="url" type="url" required maxLength={2000} placeholder="https://" />
        </label>
        <label>
          <span>Store / brand</span>
          <input name="merchant" maxLength={100} />
        </label>
        <label>
          <span>Category</span>
          <select name="category" defaultValue="">
            <option value="">Not sure</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Promo starts on</span>
          <input name="promo_start" type="date" />
        </label>
        <label>
          <span>Promo ends on</span>
          <input name="promo_end" type="date" min={todayPH()} />
        </label>
        <label>
          <span>Valid / travel from</span>
          <input name="valid_start" type="date" />
        </label>
        <label>
          <span>Valid / travel until</span>
          <input name="valid_end" type="date" />
        </label>
        <label>
          <span>Promo price (₱)</span>
          <input name="price" type="number" min="0" step="0.01" inputMode="decimal" />
        </label>
        <label className="full">
          <span>Anything else? (mechanics, promo code, where you saw it)</span>
          <textarea name="notes" rows={3} maxLength={1000} />
        </label>
        <button type="submit" className="primary" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Submit deal'}
        </button>
      </form>
    </section>
  )
}
