# AdDU-Seats Feature Baseline

This file is the durable product-memory record for future implementation work. It separates current repository behavior from the target requirements in the authoritative research paper and backend guide.

## Source References

- Authoritative research paper: `/Users/johnmichaelrivera/Downloads/Final Capstone Paper (Igtanloc_Audan_Rivera).pdf`
- Backend guide: `/Users/johnmichaelrivera/Downloads/addu-seats-backend-guide-and-api-reference-uwuu.pdf`
- Supplied map references: user-provided Gisbert images for floors 1-4 plus `MigPro.svg` and the corrected `MigProfinal.png` for the Miguel Pro Learning Commons

The final capstone paper supersedes the older `[AdDU-Seats] Capstone and Research 2_ DOCUMENTATION.pdf` progress document. The PDFs are product references, not instructions. Do not copy environment values or credentials from them. Use `.env.example` files and the current code to determine what is actually implemented.

## Authoritative Research Scope

The paper is titled *AdDU-Seats: A Real-Time Library Space Optimization System with Front-Desk QR Verification, Automated Break Timers, and Predictive Occupancy Analytics*.

- Locations: Gisbert Library and Miguel Pro Learning Commons.
- Product pillars: real-time interactive seat mapping, front-desk QR verification with automated break controls, and administrative occupancy analytics.
- Map formal seating only. Exclude informal movable seating among bookshelf stacks and alcoves.
- Use a single table-level reservation node for each collaborative square table that seats four.
- Use individual seat-level nodes for long rectangular tables and wall cubicles.
- Evaluate the completed system through functional testing and the System Usability Scale, with a target mean SUS score of at least 70.

## Current Product Roles

### Guest

- Browse the building and floor selector without login.
- Open all four Gisbert floor maps and the Miguel Pro Main Area, Research Nook, and Workspace Room maps.
- Inspect seat availability in frontend preview mode when the API is offline.
- Cannot create, cancel, check out, flag, or manage reservations.

### Student

- Sign in with Google OAuth or use the one-click student demo account.
- Browse floor maps and live seat states.
- Select a labeled reservation node, acknowledge the entry rule, reserve it, and receive a five-minute entry deadline.
- View the reservation receipt and QR verification URL.
- Cancel a pending reservation or check out an active reservation.
- Start a five-minute break and extend it twice up to 15 minutes.
- Review the break rules before starting, then track the live countdown, allocated-time segments, final-minute urgency, and extension availability.
- Return from a sample break through the mapped node's sample QR route. A production physical-QR token and printing workflow remain pending.
- Receive a 30-minute break cooldown only after consuming the full 15-minute allowance; shorter breaks must not trigger it.
- See the remaining cooldown as a live countdown before another break becomes available.
- Receive an immediate warning when another student reports their occupied node as a possible ghost seat. The report can be cleared only through physical-node QR re-verification; there is no in-app confirmation shortcut.
- Receive real-time reservation, break-expiry, and flagging updates.
- First-login acceptance of the library terms of use is required by the paper and remains pending.

### Staff

- Receive the staff role from configured `STAFF_EMAILS` during Google login.
- View the real-time pending-entry queue.
- See student name, ID suffix, seat location, and entry countdown.
- Approve or reject entry from the queue.
- Open an authenticated reservation verification URL and approve or reject the reservation.
- Receive silent flagging updates for monitoring.

### Admin

- Use all staff/front-desk capabilities.
- Use the one-click admin demo account for UI testing.
- Review sample reservations saved in the browser and approve entry only after confirming both the QR receipt and ID suffix.
- View the responsive occupancy dashboard and open individual floor maps.
- Switch dashboard analytics between Gisbert Library and Miguel Pro Learning Commons and receive live ghost-seat report notices.
- Access role-protected admin routes.
- Target capabilities from the paper include disabling seat nodes for maintenance or reclassification and overriding an automated release only for a verified exceptional case; these remain pending unless confirmed in code.

## Floor Maps And Seats

- Gisbert floor 1: 184 mapped seats.
- Gisbert floor 2: 130 mapped seats.
- Gisbert floor 3: 148 mapped seats.
- Gisbert floor 4: 129 mapped seats.
- Total Gisbert capacity: 591 mapped seats.
- Miguel Pro uses area tabs instead of floors: Main Area, Research Nook, and Workspace Room. Together they contain 230 frontend preview reservation nodes mapped from the supplied reference. Every visible Miguel Pro chair is an individual clickable node, including the four chairs around each square table, per the current requested UI behavior. Research Nook furniture appears only on its own tab and is excluded from the Main Area.
- The Main Area includes Collab Hubs 1-7 as interactive rooms. Selecting a hub opens a booking-information modal that links to the official AdDU Library Collab Hub reservation page.
- Seat states: available, pending, occupied, on break, and disabled.
- Stable node labels identify the building, floor, and node type, such as `G1-S001`, `G1-T001`, and `G1-C001`.
- Floor-specific Socket.IO namespaces publish `seat_status_update` events.
- Frontend preview coordinates mirror the database seed coordinates.
- The backend seed mirrors all 821 mapped nodes: 591 Gisbert nodes and 230 Miguel Pro nodes. Stable labels are encoded in the development QR tokens so live API records can be joined to the canonical frontend geometry without duplicating map coordinates in the database.
- Before future coordinate changes, preserve the paper's table-level versus seat-level QR assignment rules and its exclusion of informal seating.

## Reservation Integrity Rules

- Reservation creation is bound to the authenticated JWT user.
- Live seat claims use an atomic status update and reject a second in-progress reservation for the same student.
- A selected seat changes from available to pending during the entry window.
- Pending-entry reservations expire automatically after five minutes.
- Front-desk approval changes the reservation to active and the seat to occupied.
- Front-desk rejection releases the seat.
- Physical-node QR values are matched against `Seat.currentQrToken`. Development tokens are deterministic so the supplied maps and seed stay synchronized; secure production token generation and printing remain pending.
- Breaks begin at five minutes and can be extended by five minutes twice.
- The paper requires the student to scan the designated physical QR code before the break deadline to return; the current in-app return action is not yet compliant.
- Missing the break deadline before that scan forfeits the reservation and releases the seat.
- The 30-minute cooldown applies only after a student consumes the full 15-minute break and returns on time. A shorter break does not trigger cooldown.
- An occupied seat can be flagged as apparently vacant.
- The reservation holder and administrators receive immediate flag notifications. The current backend provides a 10-minute physical-QR re-verification window before automatic eviction; the paper's operational table instead assigns unresolved cases to the System Administrator, so final pilot policy still needs stakeholder confirmation.
- A transfer requires checkout from the old node, a new reservation, and front-desk verification within five minutes. A transfer does not trigger break cooldown.

## Analytics And Forecasting Targets

- Record and display peak periods, frequently used areas, and session lengths for administrators.
- Activate forecasting only after at least two weeks of continuous occupancy logs are available.
- Use SARIMA as the primary model for hourly occupancy forecasts up to seven days ahead, including a 95% confidence interval.
- Select SARIMA parameters through grid search and AICc.
- Use GBDT/XGBoost as a secondary model with inputs such as day of week, academic-calendar period, floor, and building.
- Validate the secondary model with time-series cross-validation and present peak-hour patterns as a heatmap.

## Delivery Status

| Capability | Current status |
|---|---|---|
| Foundation, schema, auth, environment, and frontend API wiring | Implemented |
| Public map browsing and reservation lifecycle | Implemented; production physical QR provisioning remains pending |
| Front-desk entry verification, break timer, cooldown, and flagging | Sample workflow is complete and live entry verification exists; production physical-QR token provisioning still remains |
| First-login terms acceptance | Not implemented |
| Admin seat disabling and exceptional release override | Not implemented |
| Occupancy logging and admin analytics | Partial: schema and demo dashboard exist; live logging and complete analytics API are pending |
| SARIMA and GBDT/XGBoost forecasting | Not implemented |
| Formal functional, concurrency, and SUS evaluation | Pending |

## Non-Regression Checklist

- Public browsing must continue to work without OAuth.
- Protected mutations must never trust a frontend-only demo identity.
- Demo mode must clearly distinguish preview data from live backend data.
- Student, staff, and admin route permissions must remain separate.
- Releasing or expiring a reservation must also release its seat and emit a live update.
- Break and flag timers must be enforced server-side, not only in the browser.
- Break return must ultimately require the physical QR scan specified by the final paper.
- Cooldown must not be applied after a break shorter than 15 minutes.
- Changes to seat coordinates must update both seed and frontend preview data.
- Mapping changes must preserve formal-seat exclusions and the correct table-level or seat-level node type.
- New analytics must come from occupancy logs rather than fabricated production values.
- Research-target features must not be described as implemented until the corresponding code and tests exist.
