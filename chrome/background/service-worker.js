/**
 * BuxBack Background Service Worker
 * Simple service worker - no auth needed, game handles everything
 */

const GAME_URL = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";
const RATES_API = "https://www.buxback.net/api/rates";

const DEFAULT_RATES = { catalog: 0.30, classic: 0.05, gamepass: 0.05 };

/**
 * Fetch cashback rates from API and cache in storage
 */
async function fetchRates() {
  try {
    const res = await fetch(RATES_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rates = await res.json();
    await chrome.storage.local.set({ rates });
    console.log("[BuxBack] Rates updated:", rates);
  } catch (err) {
    console.warn("[BuxBack] Failed to fetch rates, using defaults:", err.message);
    const { rates } = await chrome.storage.local.get("rates");
    if (!rates) {
      await chrome.storage.local.set({ rates: DEFAULT_RATES });
    }
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open onboarding page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/onboarding.html"),
    });

    // Store installation timestamp
    chrome.storage.local.set({
      installedAt: Date.now(),
      gameUrl: GAME_URL,
    });
  }

  // Fetch rates on install/update
  fetchRates();

  // Refresh rates every 30 minutes
  chrome.alarms.create("refreshRates", { periodInMinutes: 30 });
});

/**
 * Handle alarms
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshRates") {
    fetchRates();
  }
});

/**
 * Also fetch rates on service worker startup
 */
fetchRates();

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_GAME_URL") {
    sendResponse({ gameUrl: GAME_URL });
    return true;
  }

  if (message.type === "OPEN_GAME") {
    chrome.tabs.create({ url: GAME_URL });
    sendResponse({ success: true });
    return true;
  }
});

console.log("[BuxBack] Service worker initialized");
