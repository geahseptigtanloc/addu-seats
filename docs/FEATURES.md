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
- Use a single table-level seat for each collaborative square table that seats four.
- Use individual seats for long rectangular tables and wall cubicles.
- Evaluate the completed system through functional testing and the System Usability Scale, with a target mean SUS score of at least 70.

## Current Product Roles

### Guest

- Browse the building and floor selector without login.
- Open the public Privacy Policy and Terms of Service from the shared footer or sign-in page.
- Open all four Gisbert floor maps and the Miguel Pro Main Area, Research Nook, and Workspace Room maps.
- Inspect seat availability in frontend preview mode when the API is offline.
- Cannot create, cancel, check out, flag, or manage reservations.

### Student

- Sign in with Google OAuth. Production restricts access to the configured university domain; local testing can explicitly allow any Google email through `ALLOW_ANY_GOOGLE_EMAIL=true`.
- Browse floor maps and live seat states.
- Inspect availability on the map, then physically scan the QR attached to the desired seat or table and confirm the reservation from the scan page.
- Receive a five-minute entry deadline only after the physical QR reservation is created.
- View a short receipt code that is also shown in the front-desk queue.
- Cancel a pending reservation or check out an active reservation.
- Start a five-minute break and extend it twice up to 15 minutes.
- Review the break rules before starting, then track the live countdown, allocated-time segments, final-minute urgency, and extension availability.
- Return from a break by scanning the seat's shared verify QR. The same `/reverify` scan also clears an active ghost-seat report; the student app does not provide an “I'm back” button or call the legacy break-return endpoint. Production printing remains pending.
- Receive a 30-minute break cooldown only after consuming the full 15-minute allowance; shorter breaks must not trigger it.
- See the remaining cooldown as a live countdown before another break becomes available.
- Receive an immediate warning when another student reports their occupied seat as a possible ghost seat. The report can be cleared only through the same physical verify QR used for break return; there is no in-app confirmation shortcut.
- Receive the warning as an immediate modal and persistent notification-bell item from any signed-in page.
- Receive real-time reservation, break-expiry, and flagging updates.
- First-login acceptance of the library terms of use is required by the paper and remains pending.

### Staff

- Receive the staff role from configured `STAFF_EMAILS` during Google login.
- View the real-time pending-entry queue, which updates immediately when a reservation is created, handled, or expires without requiring a page refresh.
- See student name, ID suffix, seat location, and entry countdown.
- Approve or reject entry from the queue.
- Open an authenticated reservation verification URL and approve or reject the reservation.
- Receive silent flagging updates for monitoring.

### Admin

- Use all staff/front-desk capabilities.
- Sign in through Google OAuth from an address configured in `STAFF_EMAILS`.
- Review live reservations and approve entry only after matching the receipt code and checking the student's name and university ID.
- Receive each new pending reservation as an immediate toast and notification-bell badge, with the student, seat, floor, and a link to the front-desk queue.
- Receive new ghost-seat reports as a toast and notification-bell badge from any administrator page.
- Review ghost-seat reports in a compact newest-first list that reveals five more records at a time.
- Open a pending, occupied, or on-break seat from a floor map and void its active reservation, immediately releasing the seat.
- View the responsive occupancy dashboard and open individual floor maps.
- View an immediate seven-day occupancy baseline and heat map calculated from the selected period's real weekday and hourly occupancy patterns.
- Switch dashboard analytics between Gisbert Library and Miguel Pro Learning Commons and review active ghost-seat reports with the exact seat label, building, floor, and reservation holder.
- Confirm a reported reservation as a ghost seat after verification; confirmation voids the reservation, releases the seat, and removes the active report.
- Access role-protected admin routes.
- Target capabilities from the paper include disabling seats for maintenance or reclassification and overriding an automated release only for a verified exceptional case; these remain pending unless confirmed in code.

## Floor Maps And Seats

- Gisbert floor 1: 184 mapped seats.
- Gisbert floor 2: 130 mapped seats.
- Gisbert floor 3: 145 reservable seats. The three chairs inside the lower-left curved front desk are shown as fixtures, not study seats.
- Gisbert floor 4: 128 reservable seats. The chair at the curved front desk is shown as a fixture, not a study seat.
- Total Gisbert capacity: 587 reservable seats.
- Miguel Pro uses area tabs instead of floors: Main Area, Research Nook, and Workspace Room. Together they contain 230 frontend preview seats mapped from the supplied reference. Every visible Miguel Pro chair is an individual clickable seat, including the four chairs around each square table, per the current requested UI behavior. Research Nook furniture appears only on its own tab and is excluded from the Main Area.
- The Main Area includes Collab Hubs 1-7 as interactive rooms. Selecting a hub opens a booking-information modal that links to the official AdDU Library Collab Hub reservation page.
- Seat states: available, pending, occupied, on break, and disabled.
- Stable seat labels identify the building, floor, and seat type, such as `G1-S001`, `G1-T001`, and `G1-C001`.
- Floor-specific Socket.IO namespaces publish `seat_status_update` events.
- Frontend preview coordinates mirror the database seed coordinates.
- The backend seed mirrors all 817 reservable seats: 587 Gisbert seats and 230 Miguel Pro seats. Stable labels are encoded in the development QR tokens so live API records can be joined to the canonical frontend geometry without duplicating map coordinates in the database. Retired front desk chair tokens `G3-C020` through `G3-C022` and `G4-C030` are rejected by the API, and their prior database rows are made unavailable by migrations.
- Before future coordinate changes, preserve the paper's table-level versus seat-level QR assignment rules and its exclusion of informal seating.

## Reservation Integrity Rules

- Reservation creation is bound to the authenticated JWT user.
- Clicking a seat on the public map never creates a reservation and never reveals its physical QR token.
- A reservation can be created only by submitting the token obtained from the physical seat or table QR through the scan-first reservation page.
- Live seat claims use an atomic status update and reject a second in-progress reservation for the same student.
- A selected seat changes from available to pending during the entry window.
- Pending-entry reservations expire automatically after five minutes.
- Front-desk approval changes the reservation to active and the seat to occupied.
- Front-desk rejection releases the seat.
- Physical-seat QR values are matched against `Seat.currentQrToken`. Development tokens are deterministic so the supplied maps and seed stay synchronized; secure production token generation and printing remain pending.
- Breaks begin at five minutes and can be extended by five minutes twice.
- Returning from a break and clearing an active ghost-seat report use one authenticated `POST /reservations/reverify` request with the verify QR's seat token. It returns `flag_cleared` or `break_ended`; production printing remains pending.
- Missing the break deadline before that scan forfeits the reservation and releases the seat.
- The 30-minute cooldown applies only after a student consumes the full 15-minute break and returns on time. A shorter break does not trigger cooldown.
- An occupied seat can be flagged as apparently vacant.
- The reservation holder and administrators receive immediate flag notifications. Active reports persist on the admin dashboard across page reloads and identify the canonical seat label and floor. The backend provides a 10-minute physical-QR re-verification window before automatic eviction, and an administrator can confirm a ghost seat sooner to void the reservation and release the seat.
- A transfer requires checkout from the old seat, a new reservation, and front-desk verification within five minutes. A transfer does not trigger break cooldown.

## Analytics And Forecasting Targets

- Record and display peak periods, frequently used areas, and session lengths for administrators.
- Show a historical weekday/hour baseline as soon as occupancy logs are available; accuracy and coverage improve as more history is collected.
- Use SARIMA as the primary model for hourly occupancy forecasts up to seven days ahead, including a 95% confidence interval.
- Select SARIMA parameters through grid search and AICc.
- Use GBDT/XGBoost as a secondary model with inputs such as day of week, academic-calendar period, floor, and building.
- Validate the secondary model with time-series cross-validation and present peak-hour patterns as a heatmap.

## Delivery Status

| Capability | Current status |
|---|---|---|
| Foundation, schema, auth, environment, and frontend API wiring | Implemented |
| Public map browsing and reservation lifecycle | QR-first reservation flow implemented; production physical QR provisioning and printing remain pending |
| Front-desk entry verification, break timer, cooldown, and flagging | Live authenticated workflow is implemented, including persistent admin report details and confirmed ghost-seat voiding; production physical-QR token provisioning still remains |
| Public legal pages and first-login terms acceptance | Privacy Policy and Terms of Service pages implemented; recorded first-login acceptance remains pending |
| Admin seat disabling and exceptional release override | Not implemented |
| Occupancy logging and admin analytics | Implemented: live occupancy logs and seven admin-only reports cover utilization, peak hours, outcomes, no-shows, session length, break behavior, and location comparison; Miguel Pro area-level grouping remains unavailable because the backend groups by building and floor |
| Occupancy forecasting | Immediate seven-day historical weekday/hour baseline and admin heat map implemented; SARIMA and GBDT/XGBoost research models remain pending |
| Formal functional, concurrency, and SUS evaluation | Pending |

## Non-Regression Checklist

- Public browsing must continue to work without OAuth.
- Protected mutations must require a real backend-issued Google OAuth JWT.
- Public map responses must never expose `Seat.currentQrToken`, and map clicks must never create reservations.
- Production must keep `ALLOW_ANY_GOOGLE_EMAIL` disabled so `SCHOOL_EMAIL_DOMAIN` remains enforced.
- Production and pilot builds must not expose sample identities, browser-local reservation simulations, or fabricated analytics.
- Student, staff, and admin route permissions must remain separate.
- Releasing or expiring a reservation must also release its seat and emit a live update.
- Break and flag timers must be enforced server-side, not only in the browser.
- Break return must ultimately require the physical QR scan specified by the final paper.
- Cooldown must not be applied after a break shorter than 15 minutes.
- Changes to seat coordinates must update both seed and frontend preview data.
- Mapping changes must preserve formal-seat exclusions and the correct table-level or individual-seat assignment.
- New analytics must come from occupancy logs rather than fabricated production values.
- Research-target features must not be described as implemented until the corresponding code and tests exist.
