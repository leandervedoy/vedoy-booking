export type BookingStatus = "pending" | "confirmed" | "cancelled";

export type Booking = {
  id: string;
  customerName: string;
  customerEmail?: string;
  startsAt: string;
  endsAt: string;
  serviceId?: string;
  notes?: string;
  status?: BookingStatus;
};

export type VedoyBookingRow = {
  id: string;
  customer_name: string;
  customer_email?: string | null;
  starts_at: string;
  ends_at: string;
  service_id?: string | null;
  notes?: string | null;
  status?: BookingStatus | null;
};

export type AvailabilityOptions = {
  date: string;
  workdayStart?: string;
  workdayEnd?: string;
  durationMinutes: number;
  intervalMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  bookings?: Booking[];
};

export type AvailabilitySlot = { startsAt: string; endsAt: string };

function parseDate(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid ISO date.`);
  return date;
}

export function validateBooking(booking: Booking) {
  if (!booking.id?.trim()) throw new TypeError("Booking id is required.");
  if (!booking.customerName?.trim()) throw new TypeError("Customer name is required.");
  const start = parseDate(booking.startsAt, "startsAt");
  const end = parseDate(booking.endsAt, "endsAt");
  if (end <= start) throw new RangeError("endsAt must be after startsAt.");
  return booking;
}

export function bookingsOverlap(
  first: Pick<Booking, "startsAt" | "endsAt">,
  second: Pick<Booking, "startsAt" | "endsAt">,
) {
  const firstStart = parseDate(first.startsAt, "startsAt").getTime();
  const firstEnd = parseDate(first.endsAt, "endsAt").getTime();
  const secondStart = parseDate(second.startsAt, "startsAt").getTime();
  const secondEnd = parseDate(second.endsAt, "endsAt").getTime();
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function findBookingConflicts(bookings: Booking[]) {
  const active = bookings
    .filter((booking) => booking.status !== "cancelled")
    .map((booking) => validateBooking(booking))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const conflicts: Array<[Booking, Booking]> = [];
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      if (Date.parse(active[right].startsAt) >= Date.parse(active[left].endsAt)) break;
      if (bookingsOverlap(active[left], active[right])) conflicts.push([active[left], active[right]]);
    }
  }
  return conflicts;
}

export function fromVedoyBookingRow(row: VedoyBookingRow): Booking {
  return validateBooking({
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email || undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    serviceId: row.service_id || undefined,
    notes: row.notes || undefined,
    status: row.status || undefined,
  });
}

function localDate(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) throw new TypeError("date and workday times must be valid.");
  return value;
}

function positiveMinutes(value: number, label: string, allowZero = false) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new RangeError(`${label} must be ${allowZero ? "zero or " : ""}a positive whole number.`);
  }
  return value;
}

export function findAvailableSlots(options: AvailabilityOptions): AvailabilitySlot[] {
  const duration = positiveMinutes(options.durationMinutes, "durationMinutes");
  const interval = positiveMinutes(options.intervalMinutes ?? duration, "intervalMinutes");
  const before = positiveMinutes(options.bufferBeforeMinutes ?? 0, "bufferBeforeMinutes", true);
  const after = positiveMinutes(options.bufferAfterMinutes ?? 0, "bufferAfterMinutes", true);
  const dayStart = localDate(options.date, options.workdayStart ?? "08:00");
  const dayEnd = localDate(options.date, options.workdayEnd ?? "16:00");
  if (dayEnd <= dayStart) throw new RangeError("workdayEnd must be after workdayStart.");

  const active = (options.bookings ?? []).filter((booking) => booking.status !== "cancelled");
  active.forEach(validateBooking);
  const slots: AvailabilitySlot[] = [];
  for (let start = dayStart.getTime(); start + duration * 60_000 <= dayEnd.getTime(); start += interval * 60_000) {
    const candidate = {
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + duration * 60_000).toISOString(),
    };
    const blocked = active.some((booking) => bookingsOverlap(
      candidate,
      {
        startsAt: new Date(Date.parse(booking.startsAt) - before * 60_000).toISOString(),
        endsAt: new Date(Date.parse(booking.endsAt) + after * 60_000).toISOString(),
      },
    ));
    if (!blocked) slots.push(candidate);
  }
  return slots;
}

export class VedoyBooking {
  #bookings = new Map<string, Booking>();

  constructor(bookings: Booking[] = []) {
    for (const booking of bookings) this.add(booking);
  }

  add(booking: Booking, options: { allowConflicts?: boolean } = {}) {
    validateBooking(booking);
    if (!options.allowConflicts && booking.status !== "cancelled") {
      const conflict = this.list().find((current) =>
        current.id !== booking.id && current.status !== "cancelled" && bookingsOverlap(current, booking));
      if (conflict) throw new Error(`Booking conflicts with ${conflict.id}.`);
    }
    this.#bookings.set(booking.id, { ...booking });
    return this;
  }

  cancel(id: string) {
    const booking = this.#bookings.get(id);
    if (!booking) return false;
    this.#bookings.set(id, { ...booking, status: "cancelled" });
    return true;
  }

  remove(id: string) {
    return this.#bookings.delete(id);
  }

  get(id: string) {
    const booking = this.#bookings.get(id);
    return booking ? { ...booking } : undefined;
  }

  list() {
    return [...this.#bookings.values()]
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map((booking) => ({ ...booking }));
  }

  available(options: Omit<AvailabilityOptions, "bookings">) {
    return findAvailableSlots({ ...options, bookings: this.list() });
  }
}

