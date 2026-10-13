# Gisbert floor 3: placement for the 12 existing QR prints

These 12 prints were made for the previous map but were not attached to chairs. They are now assigned to **12 separated seats across the floor**, rather than two adjacent six-seat tables. The positions below use the map's upright orientation: the door is at the upper left and stairs are at the lower left. Search the current seat label on the map to confirm each green chair before attaching its print.

| Printed QR image | Map and scan label | Chair position |
| --- | --- | --- |
| `gisbert-floor3-seat_g3-s001` | `G3-S001` | Rightmost of the three bottom round tables, upper-right chair |
| `gisbert-floor3-seat_g3-s002` | `G3-S002` | Left wall cubicles, second chair from the top |
| `gisbert-floor3-seat_g3-s003` | `G3-S003` | Fourth six-seat long table from the top on the left, right-side chair |
| `gisbert-floor3-seat_g3-s004` | `G3-S004` | First computer station along the top, upper-left chair |
| `gisbert-floor3-seat_g3-s005` | `G3-S005` | Leftmost of the three narrow lower tables, upper-left chair |
| `gisbert-floor3-seat_g3-s006` | `G3-S006` | Middle-left round table, upper-left chair |
| `gisbert-floor3-seat_g3-s026` | `G3-S026` | Left-hand bench at the bottom, lower-left chair |
| `gisbert-floor3-seat_g3-s029` | `G3-S029` | Third six-seat long table from the top on the left, left-side chair |
| `gisbert-floor3-seat_g3-s035` | `G3-S035` | Rightmost diamond-shaped square table, upper-left chair |
| `gisbert-floor3-seat_g3-s036` | `G3-S036` | Left wall cubicles, second chair from the bottom |
| `gisbert-floor3-seat_g3-s037` | `G3-S037` | Upper-right round table, upper-left chair |
| `gisbert-floor3-seat_g3-s066` | `G3-S066` | Fifth (lowest) six-seat long table on the left, lower-right chair |

Only these 12 old codes are reassigned. Other old floor-3 QR codes remain inactive. The map, seat search, scan page, and receipts show the same label printed on each QR. The database still uses its existing seat identities internally so reservation history stays attached to the right chair. Wait until the live API shows these scattered third-floor labels before placing the prints. Backend startup adds missing third-floor seats from the checked-in map without changing existing seat statuses or reservations.

The other third-floor chairs and cubicles use the remaining numbers in the `G3-S001` to `G3-S120` display sequence. The 12 chairs that lost the printed labels take the previous labels of the 12 destination chairs; every other visible label stays where it was. Their existing database QR tokens are unchanged. If any displaced chair's QR image was already printed, regenerate that chair's image to match its new visible label before attaching it.

The reservation-QR generator skips these 12 seats so a new reservation QR is not printed for the same chair. Presence re-verification uses a separate `/reverify` QR image labeled with the same visible seat number and still needs to be placed according to the existing break workflow.
