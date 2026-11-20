# BuxBack - Roblox Cashback Browser Extension

Earn **up to 30% cashback** on Roblox catalog purchases. BuxBack uses Roblox's affiliate system and passes the commission back to you.

## How It Works

1. Browse the Roblox catalog with the extension installed
2. Cashback badges automatically appear on eligible items
3. Click **"Buy with BuxBack"** on any item page
4. Complete the purchase through the BuxBack game
5. Receive your cashback after the pending period

## Features

- **Catalog badges**: see potential cashback on every item while browsing
- **One-click purchasing**: "Buy with BuxBack" button on item detail pages
- **Game pass support**: earn cashback on game passes too
- **Price breakdown modal**: view price, cashback amount, and effective cost before buying
- **Onboarding page**: get started quickly with a guided setup

## Cashback Rates

| Item Type | Rate |
|---|---|
| 3D Assets (accessories, bodies, UGC clothing) | 30% |
| Classic Clothing (shirts, pants, t-shirts) | 5% |
| Game Passes | 5% |

Rates are fetched live from BuxBack, so the extension always shows the current rate.

## Installation

Install from the Chrome Web Store or Firefox Add-ons, or grab the zips from the [Releases](../../releases) page.

### Build from source

Requires Node.js 18+. No dependencies.

```sh
node build.mjs
```

This creates `dist/chrome/` and `dist/firefox/`.

- **Chrome:** `chrome://extensions/` → enable Developer mode → Load unpacked → select `dist/chrome`
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/firefox/manifest.json`

## Project Structure

```
src/                 # Shared extension code for every browser
  background/        # Background script / service worker
  content/           # Content scripts + styles injected on Roblox pages
  icons/
  onboarding/        # First-install onboarding page
  popup/             # Toolbar popup
  manifest.json      # Shared manifest fields
browsers/
  chrome.json        # Chrome-only manifest fields
  firefox.json       # Firefox-only manifest fields
build.mjs            # Builds dist/<browser> from src + browsers/<browser>.json
```

## Tech Stack

- Vanilla JavaScript, no frameworks or dependencies
- WebExtensions API (Manifest V3), one codebase for Chrome and Firefox
- Roblox deep linking for in-game purchases

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Cache cashback rates and install data |
| `webNavigation` | Detect page changes on Roblox (it's a single-page app) |
| `scripting` | Re-inject the cashback UI after those page changes |
| Host access to `roblox.com` | Show cashback UI on Roblox pages |

## Why Open Source?

This extension is open source for **transparency**. You can inspect every line of code to verify that BuxBack only does what it claims: show cashback UI on Roblox pages and route purchases through the affiliate system. No tracking, no data harvesting, no hidden behavior.

Every release on the Releases page is built automatically from the source in this repo.
