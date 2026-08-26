import assert from "node:assert/strict";
import test from "node:test";
import { VedoyBooking, bookingsOverlap, findAvailableSlots, fromVedoyBookingRow } from "../dist/index.js";

const booking = {
  id: "one",
  customerName: "Haugesund Bakeri",
  startsAt: "2026-08-24T08:00:00.000Z",
  endsAt: "2026-08-24T09:00:00.000Z",
  status: "confirmed",
};

test("detects overlap but permits adjacent bookings", () => {
  assert.equal(bookingsOverlap(booking, { startsAt: "2026-08-24T08:30:00.000Z", endsAt: "2026-08-24T09:30:00.000Z" }), true);
  assert.equal(bookingsOverlap(booking, { startsAt: "2026-08-24T09:00:00.000Z", endsAt: "2026-08-24T10:00:00.000Z" }), false);
});

test("maps database rows", () => {
  const mapped = fromVedoyBookingRow({ id: "b1", customer_name: "Vedøy IT-hjelp", starts_at: booking.startsAt, ends_at: booking.endsAt });
  assert.equal(mapped.customerName, "Vedøy IT-hjelp");
});

test("finds slots and ignores cancelled bookings", () => {
  const slots = findAvailableSlots({ date: "2026-08-24", workdayStart: "08:00", workdayEnd: "11:00", durationMinutes: 60, bookings: [booking] });
  assert.equal(slots.length, 2);
  const cancelled = { ...booking, status: "cancelled" };
  assert.equal(findAvailableSlots({ date: "2026-08-24", workdayStart: "08:00", workdayEnd: "11:00", durationMinutes: 60, bookings: [cancelled] }).length, 3);
});

test("applies booking buffers", () => {
  const localBooking = { ...booking, startsAt: "2026-08-24T06:00:00.000Z", endsAt: "2026-08-24T07:00:00.000Z" };
  const slots = findAvailableSlots({ date: "2026-08-24", workdayStart: "07:00", workdayEnd: "10:00", durationMinutes: 30, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, bookings: [localBooking] });
  assert.deepEqual(slots.map((slot) => slot.startsAt), ["2026-08-24T05:00:00.000Z", "2026-08-24T07:30:00.000Z"]);
});

test("engine rejects conflicts and cancellation frees a slot", () => {
  const engine = new VedoyBooking([booking]);
  assert.throws(() => engine.add({ ...booking, id: "two", customerName: "Konflikt" }));
  assert.equal(engine.cancel("one"), true);
  assert.doesNotThrow(() => engine.add({ ...booking, id: "two" }));
});
