# Gisbert floor 3: placement for the 12 existing QR prints

These 12 prints were made for the previous map but were not attached to chairs. Place them on the **topmost two long tables on the left side** of the current floor-3 map. The positions below use the map's upright orientation. Search the current seat label on the map to confirm each green chair before attaching its print.

| Printed QR image | Map and scan label | Chair position |
| --- | --- | --- |
| `gisbert-floor3-seat_g3-s001` | `G3-S001` | Topmost long table, upper left |
| `gisbert-floor3-seat_g3-s002` | `G3-S002` | Topmost long table, upper right |
| `gisbert-floor3-seat_g3-s003` | `G3-S003` | Topmost long table, left side |
| `gisbert-floor3-seat_g3-s004` | `G3-S004` | Topmost long table, right side |
| `gisbert-floor3-seat_g3-s005` | `G3-S005` | Topmost long table, lower left |
| `gisbert-floor3-seat_g3-s006` | `G3-S006` | Topmost long table, lower right |
| `gisbert-floor3-seat_g3-s026` | `G3-S026` | Second long table, upper left |
| `gisbert-floor3-seat_g3-s029` | `G3-S029` | Second long table, upper right |
| `gisbert-floor3-seat_g3-s035` | `G3-S035` | Second long table, left side |
| `gisbert-floor3-seat_g3-s036` | `G3-S036` | Second long table, right side |
| `gisbert-floor3-seat_g3-s037` | `G3-S037` | Second long table, lower left |
| `gisbert-floor3-seat_g3-s066` | `G3-S066` | Second long table, lower right |

Only these 12 old codes are reassigned. Other old floor-3 QR codes remain inactive. The map, seat search, scan page, and receipts show the same label printed on each QR. The database still uses its existing seat identities internally so reservation history stays attached to the right chair. Wait until the live API shows the 120 current third-floor seats before placing the prints. Backend startup adds missing third-floor seats from the checked-in map without changing existing seat statuses or reservations.

The other third-floor chairs and cubicles use the remaining numbers in the `G3-S001` to `G3-S120` display sequence. Their existing database QR tokens are unchanged; new QR image filenames use the visible label while the encoded scan URL still points to the correct existing seat.

The reservation-QR generator skips these 12 seats so a new reservation QR is not printed for the same chair. Presence re-verification uses a separate `/reverify` QR image labeled with the same visible seat number and still needs to be placed according to the existing break workflow.
