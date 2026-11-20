/**
 * BuxBack Background Script
 * Simple background script - no auth needed, game handles everything
 */

const GAME_URL = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";

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
});

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

/**
 * Handle SPA navigations on Roblox (React client-side routing)
 * Content scripts only auto-inject on full page loads, not pushState navigations.
 * This detects SPA navigations and programmatically injects the right scripts.
 */
const CATALOG_URL_RE = /^https:\/\/(www|web)\.roblox\.com\/(catalog|bundles)/;
const GAME_URL_RE = /^https:\/\/(www|web)\.roblox\.com\/games\//;

chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only

  const url = details.url;
  const tabId = details.tabId;

  try {
    if (CATALOG_URL_RE.test(url)) {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/styles.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/catalog.js', 'content/itempage.js'] });
    } else if (GAME_URL_RE.test(url)) {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/styles.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/gamedetail.js'] });
    }
  } catch (e) {
    console.log('[BuxBack] Script injection failed:', e);
  }
});

console.log("[BuxBack] Background initialized");
