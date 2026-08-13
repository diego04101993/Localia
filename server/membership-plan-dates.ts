export function parseMxIsoDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function addCalendarMonths(from: Date, months: number): Date {
  if (months === 0) {
    const result = new Date(from);
    result.setDate(result.getDate() + 1);
    return result;
  }
  const result = new Date(from);
  const dayOfMonth = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== dayOfMonth) {
    result.setDate(0);
  }
  return result;
}

function addCalendarMonthsFromMxIsoDate(value: string, months: number): Date | null {
  const parsed = parseMxIsoDateInput(value);
  if (!parsed) return null;

  if (months === 0) {
    return parsed;
  }

  const result = new Date(parsed.getTime());
  const dayOfMonth = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() !== dayOfMonth) {
    result.setUTCDate(0);
  }
  return result;
}

export function calculatePlanExpirationDate(
  plan: { cycleMonths: number | null; durationDays?: number | null },
  from = new Date(),
): Date {
  if ((plan.cycleMonths ?? 1) === 0) {
    const result = new Date(from);
    result.setDate(result.getDate() + Math.max(plan.durationDays ?? 1, 1));
    return result;
  }

  return addCalendarMonths(from, plan.cycleMonths ?? 1);
}

export function calculatePlanExpirationDateFromMxIsoDate(
  plan: { cycleMonths: number | null; durationDays?: number | null },
  startDate: string,
): Date | null {
  const parsed = parseMxIsoDateInput(startDate);
  if (!parsed) return null;

  if ((plan.cycleMonths ?? 1) === 0) {
    const result = new Date(parsed.getTime());
    result.setUTCDate(result.getUTCDate() + Math.max(plan.durationDays ?? 1, 1));
    return result;
  }

  return addCalendarMonthsFromMxIsoDate(startDate, plan.cycleMonths ?? 1);
}
