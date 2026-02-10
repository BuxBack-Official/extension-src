# BuxBack - Roblox Cashback Browser Extension

Earn up to **10% cashback** on Roblox catalog purchases. BuxBack leverages Roblox's affiliate system and passes the commission back to you.

## How It Works

1. Browse the Roblox catalog with the extension installed
2. Cashback badges automatically appear on eligible items
3. Click **"Buy with BuxBack"** on any item page
4. Complete the purchase through the BuxBack game
5. Receive your cashback after the pending period

## Features

- **Catalog badges** — See potential cashback on every item while browsing
- **One-click purchasing** — "Buy with BuxBack" button on item detail pages
- **Game pass support** — Earn cashback on game passes too
- **Price breakdown modal** — View price, cashback amount, and effective cost before buying
- **Onboarding page** — Get started quickly with a guided setup

## Cashback Rates

| Item Type | Rate |
|---|---|
| 3D Assets (accessories, bodies, UGC clothing) | 10% |
| Classic Clothing (shirts, pants, t-shirts) | 5% |
| Game Passes | 5% |

## Installation

### Chrome

1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `chrome/` folder

### Firefox

1. Download or clone this repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `firefox/manifest.json`

## Project Structure

```
├── chrome/              # Chrome extension (Manifest V3)
│   ├── background/      # Service worker
│   ├── content/         # Content scripts + styles
│   ├── icons/           # Extension icons
│   ├── onboarding/      # First-install onboarding page
│   ├── popup/           # Extension popup UI
│   └── manifest.json
│
├── firefox/             # Firefox extension (Manifest V3)
│   ├── background/      # Background script
│   ├── content/         # Content scripts + styles
│   ├── icons/           # Extension icons
│   ├── onboarding/      # First-install onboarding page
│   ├── popup/           # Extension popup UI
│   └── manifest.json
```

## Tech Stack

- Vanilla JavaScript — no frameworks or build tools required
- Chrome Extensions API / Firefox WebExtensions API (Manifest V3)
- Roblox deep linking for seamless in-game purchases

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Store install data and game URL |
| `activeTab` | Detect the current tab (Chrome) |
| Host access to `roblox.com` | Inject cashback UI on Roblox pages |

## Why Open Source?

This extension is open source for **transparency**. You can inspect every line of code to verify that BuxBack only does what it claims — inject cashback UI on Roblox pages and route purchases through the affiliate system. No tracking, no data harvesting, no hidden behavior.
