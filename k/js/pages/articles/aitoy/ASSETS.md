# Article assets: Reverse-Engineering a No-Name ESP32 Board

Photos live in `figures/` beside this file and are referenced from `aitoy.js`. The article's slug is `reverse-engineering-esp32`; the folder keeps its original name.

## Figures (`figures/`)

**amazon_screenshot.png** (1259×671) — the Amazon listing: "XiaoZhi AI Voice Chat Module ESP32-S3 Built-in CH340X INMP441 MAX9835", brand Knoruley, £14.34. Used at the top of the article to make the point that the same board is sold under several names at different prices.

**board_front.jpg** (718×757) — front of the board: S3-N16R8 module, INMP441 mic top left, buttons labelled WiFi reset / volume+ / volume− / BOOT / EN down the right edge, USB-C and the two JST plugs on the left, slide switch and battery LEDs at the bottom.

**board_back.jpg** (682×578) — back of the board: PIR header (GND / OUT / VCC), `bat` and `speaker` labels for the JST plugs, `on-off` switch, and the part number `ESP32S3-AI V2.2 (303ESP32AI2)`.

The front and back photos sit side by side in an `art-cols` row; on phones they stack.

## Would still be nice

- `serial-first-boot.png` — a screenshot of the test firmware's serial output after the PSRAM fix (chip model, `PSRAM: 8386279 bytes`, the test menu).
- `ptt-demo.jpg` — the finished thing in use, a hand on the BOOT button, LED lit.

Add either with one `photo()` call in `aitoy.js`.
