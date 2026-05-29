/**
 * Parses time strings into a Date object.
 * Supported formats:
 * - "10m" (10 minutes from now)
 * - "2h" (2 hours from now)
 * - "1d" (1 day from now)
 * - "20:00" (today at 20:00, or tomorrow if 20:00 has passed)
 * - "besok 07:00" (tomorrow at 07:00)
 * - "lusa 07:00" (day after tomorrow at 07:00)
 */
export function parseRelativeOrAbsoluteTime(timeStr: string, baseDate = new Date()): Date | null {
  const cleanStr = timeStr.trim().toLowerCase();

  // Match relative minutes (e.g. 10m)
  const minMatch = cleanStr.match(/^(\d+)m$/);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    return new Date(baseDate.getTime() + mins * 60 * 1000);
  }

  // Match relative hours (e.g. 2h)
  const hourMatch = cleanStr.match(/^(\d+)h$/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
  }

  // Match relative days (e.g. 1d)
  const dayMatch = cleanStr.match(/^(\d+)d$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // Match "besok HH:MM" or "lusa HH:MM"
  const dayPrefixMatch = cleanStr.match(/^(besok|lusa)\s+(\d{1,2})[:.](\d{2})$/);
  if (dayPrefixMatch) {
    const dayWord = dayPrefixMatch[1];
    const hours = parseInt(dayPrefixMatch[2], 10);
    const mins = parseInt(dayPrefixMatch[3], 10);

    const targetDate = new Date(baseDate.getTime());
    const offset = dayWord === 'besok' ? 1 : 2;
    targetDate.setDate(targetDate.getDate() + offset);
    targetDate.setHours(hours, mins, 0, 0);
    return targetDate;
  }

  // Match HH:MM (absolute time today/tomorrow)
  const timeOnlyMatch = cleanStr.match(/^(\d{1,2})[:.](\d{2})$/);
  if (timeOnlyMatch) {
    const hours = parseInt(timeOnlyMatch[1], 10);
    const mins = parseInt(timeOnlyMatch[2], 10);

    const targetDate = new Date(baseDate.getTime());
    targetDate.setHours(hours, mins, 0, 0);

    if (targetDate.getTime() <= baseDate.getTime()) {
      // If time has already passed today, set to tomorrow
      targetDate.setDate(targetDate.getDate() + 1);
    }
    return targetDate;
  }

  return null;
}
