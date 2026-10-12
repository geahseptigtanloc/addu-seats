# Gisbert floor 3: placement for the 12 existing QR prints

These 12 prints were made for the previous map but were not attached to chairs. Place them on the **topmost two long tables on the left side** of the current floor-3 map. The positions below use the map's upright orientation. Search the current seat label on the map to confirm each green chair before attaching its print.

| Printed QR image | Current seat | Chair position |
| --- | --- | --- |
| `gisbert-floor3-seat_g3-s001` | `G3-S089` | Topmost long table, upper left |
| `gisbert-floor3-seat_g3-s002` | `G3-S090` | Topmost long table, upper right |
| `gisbert-floor3-seat_g3-s003` | `G3-S091` | Topmost long table, left side |
| `gisbert-floor3-seat_g3-s004` | `G3-S092` | Topmost long table, right side |
| `gisbert-floor3-seat_g3-s005` | `G3-S093` | Topmost long table, lower left |
| `gisbert-floor3-seat_g3-s006` | `G3-S094` | Topmost long table, lower right |
| `gisbert-floor3-seat_g3-s026` | `G3-S095` | Second long table, upper left |
| `gisbert-floor3-seat_g3-s029` | `G3-S096` | Second long table, upper right |
| `gisbert-floor3-seat_g3-s035` | `G3-S097` | Second long table, left side |
| `gisbert-floor3-seat_g3-s036` | `G3-S098` | Second long table, right side |
| `gisbert-floor3-seat_g3-s037` | `G3-S099` | Second long table, lower left |
| `gisbert-floor3-seat_g3-s066` | `G3-S100` | Second long table, lower right |

Only these 12 old codes are reassigned. Other old floor-3 QR codes remain inactive. The QR page will show the **current** seat label after student sign-in; the print's old filename is an inventory identifier. Apply the backend migration and seed the current seat map before placing the prints.

The reservation-QR generator skips these 12 seats so a new reservation QR is not printed for the same chair. Presence re-verification uses a separate `/reverify` QR image with the same current seat identity and still needs to be placed according to the existing break workflow.
