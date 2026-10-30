// All promo dates are Philippine dates (Asia/Manila), stored as YYYY-MM-DD.

export function todayPH(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

function toUTC(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000)
}

export function formatDate(d: string | null): string {
  if (!d) return ''
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(toUTC(d))
}

export function formatRange(start: string | null, end: string | null): string {
  if (start && end) return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
  if (end) return `until ${formatDate(end)}`
  if (start) return `from ${formatDate(start)}`
  return ''
}

export function monthLabel(d: string): string {
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(toUTC(d))
}

export type DealTiming =
  | { kind: 'upcoming'; days: number }
  | { kind: 'active'; daysLeft: number | null }
  | { kind: 'expired' }

export function dealTiming(start: string | null, end: string | null, today = todayPH()): DealTiming {
  if (end && end < today) return { kind: 'expired' }
  if (start && start > today) return { kind: 'upcoming', days: daysBetween(today, start) }
  return { kind: 'active', daysLeft: end ? daysBetween(today, end) : null }
}

export function timingLabel(t: DealTiming): string {
  if (t.kind === 'expired') return 'Ended'
  if (t.kind === 'upcoming') return t.days === 1 ? 'Starts tomorrow' : `Starts in ${t.days} days`
  if (t.daysLeft === null) return 'Ongoing'
  if (t.daysLeft === 0) return 'Last day today'
  if (t.daysLeft === 1) return 'Ends tomorrow'
  return `${t.daysLeft} days left`
}

// Both ranges must run forwards; the database rejects them otherwise.
export function checkRanges(
  promoStart: string | null,
  promoEnd: string | null,
  validStart: string | null,
  validEnd: string | null,
): string | null {
  if (promoStart && promoEnd && promoEnd < promoStart) return 'The promo end date is before its start date.'
  if (validStart && validEnd && validEnd < validStart) return 'The valid / travel end date is before its start date.'
  return null
}
