// Picks a warm, non-punitive line for the home screen. Never shame, never fear —
// a missed day is met with "nevadí, jdeme dál", a finished day with calm praise.
export interface EncouragementInput {
  totalReviews: number
  remainingToday: number
  studiedToday: boolean
  streak: number
}

function czDays(n: number): string {
  if (n === 1) return 'den'
  if (n >= 2 && n <= 4) return 'dny'
  return 'dní'
}

export function encouragement(input: EncouragementInput): string {
  const { totalReviews, remainingToday, studiedToday, streak } = input

  if (totalReviews === 0) return 'Začni klidně jednou kartou — stačí pár minut. 🌱'
  if (remainingToday === 0 && studiedToday) return 'Dnešek máš hotový — pěkná práce. 🌿'
  if (remainingToday === 0) return 'Pro dnešek nic nečeká. Užij si pauzu. 🌿'
  // streak === 0 here means no reviews today or yesterday — gently, never blaming.
  if (streak === 0) return 'Včera jsi vynechal — nevadí, jdeme dál.'
  return `Máš sérii ${streak} ${czDays(streak)} v řadě — hezky popořádku. ✨`
}
