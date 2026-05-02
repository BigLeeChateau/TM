function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayLocal(): string {
  return formatLocalDate(new Date())
}

export function validateActualDates(
  start?: string | null,
  end?: string | null,
): { valid: boolean; error?: string } {
  const today = getTodayLocal()

  if (start && start !== '' && start > today) {
    return { valid: false, error: 'Actual start cannot be in the future' }
  }
  if (end && end !== '' && end > today) {
    return { valid: false, error: 'Actual end cannot be in the future' }
  }
  if (start && start !== '' && end && end !== '' && end < start) {
    return { valid: false, error: 'Actual end cannot be before actual start' }
  }
  return { valid: true }
}

export function computeActualDatesFromTimer(
  timerStartedAt: string,
  timerStoppedAt: string,
): { actual_start: string; actual_end: string } {
  const start = new Date(timerStartedAt)
  const end = new Date(timerStoppedAt)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid timer timestamp')
  }
  return {
    actual_start: formatLocalDate(start),
    actual_end: formatLocalDate(end),
  }
}
