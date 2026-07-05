// Picks a warm, non-punitive line for the home screen. Never shame, never fear —
// a missed day is met with "nevadí, jdeme dál", a finished day with calm praise.
import { t } from '../i18n'

export interface EncouragementInput {
  totalReviews: number
  remainingToday: number
  studiedToday: boolean
  streak: number
}

export function encouragement(input: EncouragementInput): string {
  const { totalReviews, remainingToday, studiedToday, streak } = input

  if (totalReviews === 0) return t('encStart')
  if (remainingToday === 0 && studiedToday) return t('encDoneToday')
  if (remainingToday === 0) return t('encNothingWaiting')
  // streak === 0 here means no reviews today or yesterday — gently, never blaming.
  if (streak === 0) return t('encMissed')
  return t('encStreak', streak)
}
