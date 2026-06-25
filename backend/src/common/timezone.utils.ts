export function getTzOffset(): number {
  let tzOffset = 8; // Default to Asia/Makassar (WITA, UTC+8)
  if (process.env.TZ === 'Asia/Jakarta') tzOffset = 7;
  else if (process.env.TZ === 'Asia/Jayapura') tzOffset = 9;
  return tzOffset;
}

export function getLocalDateBoundaries(): { today: Date; tomorrow: Date } {
  const tzOffset = getTzOffset();
  const now = new Date();
  const localTime = now.getTime() + tzOffset * 60 * 60 * 1000;
  const localDate = new Date(localTime);

  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();

  const today = new Date(
    Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000,
  );
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  return { today, tomorrow };
}

export function parseLocalDate(
  dateInput: string | Date,
  isEndOfDay: boolean = false,
): Date {
  const tzOffset = getTzOffset();
  let dateObj: Date;

  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else {
    const str = String(dateInput).trim();
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      let ms = Date.UTC(y, m, d) - tzOffset * 60 * 60 * 1000;
      if (isEndOfDay) {
        ms += 24 * 60 * 60 * 1000 - 1;
      }
      return new Date(ms);
    }
    dateObj = new Date(str);
  }

  if (isNaN(dateObj.getTime())) {
    return dateObj;
  }

  // Get UTC components based on local offset to construct midnight of that local date
  const localTime = dateObj.getTime() + tzOffset * 60 * 60 * 1000;
  const localDate = new Date(localTime);
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();

  let ms = Date.UTC(year, month, day) - tzOffset * 60 * 60 * 1000;
  if (isEndOfDay) {
    ms += 24 * 60 * 60 * 1000 - 1;
  }
  return new Date(ms);
}
