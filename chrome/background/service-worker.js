/**
 * BuxBack Background Service Worker
 * Simple service worker - no auth needed, game handles everything
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

console.log("[BuxBack] Service worker initialized");
