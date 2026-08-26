import type { VercelRequest, VercelResponse } from "@vercel/node";
import { VedoyBooking } from "../src/index.js";

export default function handler(_request: VercelRequest, response: VercelResponse) {
  const engine = new VedoyBooking([{
    id: "vedoy-demo",
    customerName: "Vedøy demo",
    startsAt: "2026-08-27T08:00:00.000Z",
    endsAt: "2026-08-27T09:00:00.000Z",
    status: "confirmed",
  }]);

  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  response.status(200).json({
    service: "vedoy-booking",
    status: "running",
    availableSlots: engine.available({
      date: "2026-08-27",
      workdayStart: "08:00",
      workdayEnd: "12:00",
      durationMinutes: 60,
    }),
  });
}

