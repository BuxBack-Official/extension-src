/**
 * BuxBack Extension Popup
 * Simple info popup - no auth needed, game handles everything
 */

// Update the game link with the correct place ID
const GAME_URL = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";
const CATALOG_URL = "https://www.roblox.com/catalog";

// Handle game button click
document.getElementById("game-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: GAME_URL });
});

// Handle catalog button click
document.getElementById("catalog-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: CATALOG_URL });
});
