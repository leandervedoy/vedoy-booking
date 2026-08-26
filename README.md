# vedoy-booking

Et avhengighetsfritt Node.js/TypeScript-bibliotek for bookinger, konfliktkontroll og ledige tider. Pakken er bookingmotoren for Vedøy Growth, men kan brukes i andre systemer.

## Installer

```bash
npm install vedoy-booking
```

## Eksempel

```js
import { VedoyBooking } from "vedoy-booking";

const booking = new VedoyBooking([{
  id: "booking-1",
  customerName: "Haugesund Bakeri",
  startsAt: "2026-08-24T08:00:00.000Z",
  endsAt: "2026-08-24T09:00:00.000Z",
  status: "confirmed"
}]);

const slots = booking.available({
  date: "2026-08-24",
  workdayStart: "08:00",
  workdayEnd: "16:00",
  durationMinutes: 60
});
```

## API

- `VedoyBooking` – legg til, hent, avbestill og fjern bookinger
- `fromVedoyBookingRow()` – adapter fra database-/Supabase-felter
- `bookingsOverlap()` og `findBookingConflicts()` – konfliktkontroll
- `findAvailableSlots()` – ledige tider med valgfrie buffere

Pakken lagrer ingenting selv. Database, autentisering, betaling, varsler og Google/Microsoft-integrasjoner må kobles til av applikasjonen som bruker biblioteket.

Krever Node.js 18 eller nyere. Lisensiert under MIT.

