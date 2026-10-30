import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Category, Deal, SaleEvent, SubmissionRow, SubmissionStatus } from '../types'
import { supabase } from '../lib/supabase'
import { approveSubmission, fetchSubmissions, isAdmin, setSubmissionStatus } from '../lib/api'
import { checkRanges } from '../lib/dates'
import AdminDeals from './AdminDeals'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

type Section = 'deals' | 'submissions'

export default function AdminPage({
  categories,
  deals,
  events,
  onDealsChanged,
}: {
  categories: Category[]
  deals: Deal[]
  events: SaleEvent[]
  onDealsChanged: () => Promise<void>
}) {
  const [section, setSection] = useState<Section>('deals')
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [admin, setAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    setAdmin(null)
    if (!userId) return
    isAdmin()
      .then(setAdmin)
      .catch(() => setAdmin(false))
  }, [userId])

  if (checking) return <p className="state">Checking sign-in…</p>
  if (!session) return <SignIn />
  if (admin === null) return <p className="state">Checking admin access…</p>

  return (
    <section className="admin">
      <div className="admin-head">
        <div>
          <h2 className="section-title">Admin</h2>
          <p className="section-sub">Signed in as {session.user.email}</p>
        </div>
        <button type="button" className="ghost" onClick={() => supabase?.auth.signOut()}>Sign out</button>
      </div>
      {admin ? (
        <>
          <nav className="cats admin-tabs" aria-label="Admin">
            <button type="button" className={section === 'deals' ? 'on' : ''} onClick={() => setSection('deals')}>Deals</button>
            <button type="button" className={section === 'submissions' ? 'on' : ''} onClick={() => setSection('submissions')}>
              Submissions
            </button>
          </nav>
          {section === 'deals' ? (
            <AdminDeals categories={categories} deals={deals} events={events} onChanged={onDealsChanged} />
          ) : (
            <Queue categories={categories} onApproved={onDealsChanged} />
          )}
        </>
      ) : (
        <p className="notice bad">This account is not an admin. Ask the site owner to add you to the admins list.</p>
      )}
    </section>
  )
}

function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get('email') ?? '').trim(),
      password: String(f.get('password') ?? ''),
    })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <section className="submit">
      <h2 className="section-title">Admin sign in</h2>
      <p className="section-sub">For Tipid Tracker reviewers only.</p>
      {error && <p className="notice bad">{error}</p>}
      <form onSubmit={onSubmit} className="form">
        <label className="full">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label className="full">
          <span>Password</span>
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  )
}

const STATUSES: { key: SubmissionStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function Queue({ categories, onApproved }: { categories: Category[]; onApproved: () => Promise<void> }) {
  const [status, setStatus] = useState<SubmissionStatus>('pending')
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchSubmissions(status)
      .then(setRows)
      .catch((e: unknown) => setError(errorText(e)))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(load, [load])

  const remove = (id: string) => setRows((r) => r.filter((s) => s.id !== id))

  return (
    <>
      <div className="cats" role="tablist">
        {STATUSES.map((s) => (
          <button key={s.key} type="button" className={status === s.key ? 'on' : ''} onClick={() => setStatus(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      {loading && <p className="state">Loading submissions…</p>}
      {error && <p className="state error">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="state">Nothing here.</p>}
      <div className="stack review-list">
        {rows.map((s) =>
          s.status === 'pending' ? (
            <ReviewCard
              key={s.id}
              submission={s}
              categories={categories}
              onDone={(approved) => {
                remove(s.id)
                if (approved) onApproved()
              }}
            />
          ) : (
            <ReviewedCard key={s.id} submission={s} onDone={() => remove(s.id)} />
          ),
        )}
      </div>
    </>
  )
}

function ReviewCard({
  submission: s,
  categories,
  onDone,
}: {
  submission: SubmissionRow
  categories: Category[]
  onDone: (approved: boolean) => void
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onApprove(e: FormEvent<HTMLFormElement>) {
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
    const deal = {
      title: str('title') ?? '',
      merchant: str('merchant') ?? '',
      category_slug: str('category') ?? '',
      url: str('url') ?? '',
      price: num('price'),
      original_price: num('original_price'),
      promo_code: str('promo_code'),
      promo_start: str('promo_start'),
      promo_end: str('promo_end'),
      valid_start: str('valid_start'),
      valid_end: str('valid_end'),
      image_url: str('image_url'),
    }
    const rangeError = checkRanges(deal.promo_start, deal.promo_end, deal.valid_start, deal.valid_end)
    if (rangeError) {
      setError(rangeError)
      return
    }
    setBusy('approve')
    setError(null)
    try {
      await approveSubmission(s.id, deal)
      onDone(true)
    } catch (err) {
      setError(errorText(err))
      setBusy(null)
    }
  }

  async function onReject() {
    setBusy('reject')
    setError(null)
    try {
      await setSubmissionStatus(s.id, 'rejected')
      onDone(false)
    } catch (err) {
      setError(errorText(err))
      setBusy(null)
    }
  }

  return (
    <article className="card review">
      <div className="card-top">
        <span className="chip">Submitted {new Date(s.created_at).toLocaleString('en-PH')}</span>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="timing">Open link →</a>
      </div>
      {s.notes && <p className="review-notes">“{s.notes}”</p>}
      {error && <p className="notice bad">{error}</p>}

      <form onSubmit={onApprove} className="form">
        <label className="full">
          <span>Title *</span>
          <input name="title" required minLength={5} maxLength={200} defaultValue={s.title} />
        </label>
        <label className="full">
          <span>Link *</span>
          <input name="url" type="url" required maxLength={2000} defaultValue={s.url} />
        </label>
        <label>
          <span>Store / brand *</span>
          <input name="merchant" required maxLength={100} defaultValue={s.merchant ?? ''} />
        </label>
        <label>
          <span>Category *</span>
          <select name="category" required defaultValue={s.category_slug ?? ''}>
            <option value="" disabled>Choose…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Promo price (₱)</span>
          <input name="price" type="number" min="0" step="0.01" defaultValue={s.price ?? ''} />
        </label>
        <label>
          <span>Original price (₱)</span>
          <input name="original_price" type="number" min="0" step="0.01" defaultValue={s.original_price ?? ''} />
        </label>
        <label>
          <span>Promo starts on</span>
          <input name="promo_start" type="date" defaultValue={s.promo_start ?? ''} />
        </label>
        <label>
          <span>Promo ends on</span>
          <input name="promo_end" type="date" defaultValue={s.promo_end ?? ''} />
        </label>
        <label>
          <span>Valid / travel from</span>
          <input name="valid_start" type="date" defaultValue={s.valid_start ?? ''} />
        </label>
        <label>
          <span>Valid / travel until</span>
          <input name="valid_end" type="date" defaultValue={s.valid_end ?? ''} />
        </label>
        <label>
          <span>Promo code</span>
          <input name="promo_code" maxLength={50} defaultValue={s.promo_code ?? ''} />
        </label>
        <label>
          <span>Image URL</span>
          <input name="image_url" type="url" maxLength={2000} defaultValue={s.image_url ?? ''} />
        </label>
        <div className="review-actions">
          <button type="submit" className="approve" disabled={busy !== null}>
            {busy === 'approve' ? 'Approving…' : 'Approve and publish'}
          </button>
          <button type="button" className="ghost" onClick={onReject} disabled={busy !== null}>
            {busy === 'reject' ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </article>
  )
}

function ReviewedCard({ submission: s, onDone }: { submission: SubmissionRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reopen() {
    setBusy(true)
    setError(null)
    try {
      await setSubmissionStatus(s.id, 'pending')
      onDone()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <article className="card review">
      <div className="card-top">
        <span className="chip">
          {s.status === 'approved' ? 'Approved' : 'Rejected'}
          {s.reviewed_at && ` ${new Date(s.reviewed_at).toLocaleString('en-PH')}`}
        </span>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="timing">Open link →</a>
      </div>
      <h3 className="card-title">{s.title}</h3>
      {s.merchant && <p className="merchant">{s.merchant}</p>}
      {s.notes && <p className="review-notes">“{s.notes}”</p>}
      {error && <p className="notice bad">{error}</p>}
      {s.status === 'rejected' && (
        <div className="review-actions">
          <button type="button" className="ghost" onClick={reopen} disabled={busy}>
            {busy ? 'Moving…' : 'Move back to pending'}
          </button>
        </div>
      )}
    </article>
  )
}
