/**
 * BuxBack Background Script (Firefox)
 * Simple background script - no auth needed, game handles everything
 */

const GAME_URL = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";

/**
 * Handle extension installation
 */
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open onboarding page on first install
    browser.tabs.create({
      url: browser.runtime.getURL("onboarding/onboarding.html"),
    });

    // Store installation timestamp
    browser.storage.local.set({
      installedAt: Date.now(),
      gameUrl: GAME_URL,
    });
  }
});

/**
 * Handle messages from content scripts
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_GAME_URL") {
    sendResponse({ gameUrl: GAME_URL });
    return true;
  }

  if (message.type === "OPEN_GAME") {
    browser.tabs.create({ url: GAME_URL });
    sendResponse({ success: true });
    return true;
  }
});

console.log("[BuxBack] Background script initialized");
