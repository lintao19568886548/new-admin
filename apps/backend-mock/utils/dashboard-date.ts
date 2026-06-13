export function parseDashboardDate(value: unknown) {
  const rawDate = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function resolveDashboardReferenceDate(
  value: unknown,
  fallback = new Date(),
) {
  return parseDashboardDate(value) || fallback;
}

export function startOfDashboardDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDashboardDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function resolveDashboardDateRange(
  startValue: unknown,
  endValue: unknown,
  fallback = new Date(),
) {
  const startDate = parseDashboardDate(startValue);
  const endDate = parseDashboardDate(endValue);

  if (startDate && endDate) {
    const periodStartDate = new Date(
      Math.min(startDate.getTime(), endDate.getTime()),
    );
    const periodEndDate = new Date(
      Math.max(startDate.getTime(), endDate.getTime()),
    );

    return {
      periodEnd: addDashboardDays(startOfDashboardDay(periodEndDate), 1),
      periodEndDate,
      periodStart: startOfDashboardDay(periodStartDate),
      periodStartDate,
    };
  }

  const referenceDate = resolveDashboardReferenceDate(endValue, fallback);
  const periodStart = startOfDashboardDay(referenceDate);

  return {
    periodEnd: addDashboardDays(periodStart, 1),
    periodEndDate: referenceDate,
    periodStart,
    periodStartDate: referenceDate,
  };
}
