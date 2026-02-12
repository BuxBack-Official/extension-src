/**
 * BuxBack Content Script - Item Detail Page
 * Adds cashback button and modal on individual item pages
 */

(function() {
  'use strict';

  // Catalog rate is variable (fetched from API), others are fixed at 5%
  let CATALOG_CASHBACK_RATE = 0.30;
  const CLASSIC_CLOTHING_CASHBACK_RATE = 0.05;
  const GAMEPASS_CASHBACK_RATE = 0.05;

  // Fetch fresh rates from API via background script
  chrome.runtime.sendMessage({ type: "FETCH_RATES" }, (response) => {
    if (response?.rates?.catalog) {
      CATALOG_CASHBACK_RATE = response.rates.catalog;
      console.log('[BuxBack] Catalog rate loaded:', response.rates.catalog);
    }
  });
  const GAME_LINK = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";
  const PLACE_ID = "118219754091031";

  function escapeHTML(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

/**
 * Get item type for LaunchData
 */
function getItemType() {
  if (isGamePassPage()) return "gamepass";
  if (window.location.pathname.startsWith('/bundles/')) return "bundle";
  return "catalog";
}

/**
 * Generate Roblox deep link with LaunchData
 * Format: roblox://placeId=X&launchData=URL_ENCODED_BASE64
 * We Base64 encode to obfuscate the data from easy tampering
 */
function generateRobloxDeepLink(itemId, itemType) {
  const launchData = JSON.stringify({
    itemId: itemId,
    itemType: itemType
  });
  // Base64 encode to obfuscate, then URL encode for safe transmission
  const base64Data = btoa(launchData);
  const encodedData = encodeURIComponent(base64Data);
  return `roblox://placeId=${PLACE_ID}&launchData=${encodedData}`;
}

  // Roblox asset type IDs for classic clothing
  const CLASSIC_CLOTHING_ASSET_TYPES = [2, 11, 12]; // T-Shirt, Shirt, Pants

  // Track current URL to detect navigation
  let currentUrl = window.location.href;
  let initTimeout = null;

/**
 * Check if current page is a gamepass
 */
function isGamePassPage() {
  return /\/game-pass\/\d+/.test(window.location.pathname);
}

/**
 * Check if current page is classic clothing (shirt, pants, t-shirt)
 * Tries to detect via page content since Roblox embeds asset type data
 */
function isClassicClothingPage() {
  // Only check catalog pages (not bundles or gamepasses)
  if (!window.location.pathname.startsWith('/catalog/')) return false;

  // Method 1: Check for Roblox's embedded data in script tags
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    // Look for assetTypeId in React/Roblox data
    const match = content.match(/["']?assetTypeId["']?\s*:\s*(\d+)/i) ||
                  content.match(/["']?AssetTypeId["']?\s*:\s*(\d+)/i);
    if (match) {
      const assetTypeId = parseInt(match[1], 10);
      if (CLASSIC_CLOTHING_ASSET_TYPES.includes(assetTypeId)) {
        return true;
      }
    }
  }

  // Method 2: Check page title/meta for classic clothing keywords
  const title = document.title.toLowerCase();
  const classicKeywords = ['- shirt', '- pants', '- t-shirt', 'classic shirt', 'classic pants'];
  if (classicKeywords.some(kw => title.includes(kw))) {
    return true;
  }

  // Method 3: Check breadcrumb or category indicators
  const breadcrumbs = document.querySelector('[class*="breadcrumb"], [class*="Breadcrumb"]');
  if (breadcrumbs) {
    const breadText = breadcrumbs.textContent.toLowerCase();
    if (breadText.includes('shirts') || breadText.includes('pants') || breadText.includes('t-shirts')) {
      return true;
    }
  }

  return false;
}

/**
 * Get cashback rate based on item type
 */
function getCashbackRate() {
  if (isGamePassPage()) return GAMEPASS_CASHBACK_RATE;
  if (isClassicClothingPage()) return CLASSIC_CLOTHING_CASHBACK_RATE;
  return CATALOG_CASHBACK_RATE;
}

/**
 * Extract item ID from URL
 */
function getItemId() {
  const match = window.location.pathname.match(/\/(catalog|bundles|game-pass)\/(\d+)/);
  return match ? match[2] : null;
}

/**
 * Extract item name from page
 */
function getItemName() {
  const titleEl = document.querySelector('h1, [class*="ItemName"]');
  return titleEl ? titleEl.textContent.trim() : 'Unknown Item';
}

/**
 * Get price from page
 */
function getPrice() {
  // Look for price element
  const priceEl = document.querySelector('[class*="price-row"] [class*="text-robux"]');
  if (priceEl) {
    const match = priceEl.textContent.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
    if (match) return parseInt(match[1].replace(/,/g, ''), 10);
  }

  // Fallback: look for any robux price
  const allText = document.body.innerText;
  const priceMatch = allText.match(/Price[^\d]*(\d{1,3}(?:,\d{3})*|\d+)/i);
  if (priceMatch) return parseInt(priceMatch[1].replace(/,/g, ''), 10);

  return null;
}

/**
 * Create and inject the modal
 */
function createModal() {
  // Remove existing modal
  const existing = document.getElementById('buxback-modal');
  if (existing) existing.remove();

  const itemId = getItemId();
  const itemName = getItemName();
  const price = getPrice();
  const cashbackRate = getCashbackRate();
  const cashback = price ? Math.floor(price * cashbackRate) : 0;
  const itemType = getItemType();
  const deepLink = generateRobloxDeepLink(itemId, itemType);

  const safeItemName = escapeHTML(itemName);
  const safeItemId = escapeHTML(itemId);

  const modal = document.createElement('div');
  modal.id = 'buxback-modal';
  modal.innerHTML = `
    <div class="buxback-modal-overlay">
      <div class="buxback-modal-content">
        <button class="buxback-modal-close">&times;</button>
        <div class="buxback-modal-header">
          <div class="buxback-logo">BuxBack</div>
          <h2>Buy & Earn Cashback</h2>
        </div>
        <div class="buxback-modal-body">
          <p class="buxback-item-name">${safeItemName}</p>

          <div class="buxback-price-summary">
            ${price ? `
              <div class="buxback-price-row">
                <span>Price</span>
                <span class="buxback-price-value">${price.toLocaleString()} Robux</span>
              </div>
            ` : ''}
            ${cashback ? `
              <div class="buxback-price-row buxback-cashback-row">
                <span>Your Cashback</span>
                <span class="buxback-cashback-value">+${cashback.toLocaleString()} Robux</span>
              </div>
            ` : ''}
            ${price && cashback ? `
              <div class="buxback-price-row buxback-total-row">
                <span>You Actually Pay</span>
                <span class="buxback-total-value">${(price - cashback).toLocaleString()} Robux</span>
              </div>
            ` : ''}
          </div>

          <div class="buxback-instructions">
            <p><strong>Click below to open the game with this item ready to buy:</strong></p>
          </div>

          <a href="${deepLink}" class="buxback-game-btn buxback-deeplink-btn">
            Open in BuxBack Game
          </a>

          <div class="buxback-fallback">
            <p class="buxback-fallback-label">If the game doesn't open, copy the Item ID:</p>
            <div class="buxback-copy-row">
              <input type="text" value="${safeItemId}" readonly id="buxback-item-id">
              <button class="buxback-copy-btn" data-copy="${safeItemId}">Copy</button>
            </div>
            <a href="${GAME_LINK}" target="_blank" class="buxback-fallback-link">
              Open game manually →
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on overlay click
  modal.querySelector('.buxback-modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('buxback-modal-overlay')) {
      modal.remove();
    }
  });

  // Close button
  modal.querySelector('.buxback-modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Copy button
  modal.querySelector('.buxback-copy-btn').addEventListener('click', (e) => {
    const id = e.target.dataset.copy;
    navigator.clipboard.writeText(id).then(() => {
      e.target.textContent = 'Copied!';
      setTimeout(() => e.target.textContent = 'Copy', 2000);
    });
  });

  // ESC to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Remove existing BuxBack elements (for cleanup on navigation)
 */
function cleanup() {
  const btn = document.getElementById('buxback-btn');
  if (btn) btn.closest('.buxback-btn-wrapper')?.remove() || btn.remove();

  const modal = document.getElementById('buxback-modal');
  if (modal) modal.remove();
}

/**
 * Create the "Buy with BuxBack" button
 */
function createCashbackButton() {
  // Don't add if already exists for this item
  const existingBtn = document.getElementById('buxback-btn');
  if (existingBtn) {
    // Check if it's for the same item
    const currentItemId = getItemId();
    if (existingBtn.dataset.itemId === currentItemId) return;
    // Different item, remove old button
    cleanup();
  }

  const itemId = getItemId();
  if (!itemId) return;

  // Don't show button if item is already owned
  if (isItemOwned()) {
    console.log('[BuxBack] Item already owned, skipping button');
    cleanup();
    return;
  }

  const price = getPrice();
  const cashbackRate = getCashbackRate();
  const cashback = price ? Math.floor(price * cashbackRate) : 0;

  const btn = document.createElement('button');
  btn.id = 'buxback-btn';
  btn.className = 'buxback-buy-btn';
  btn.dataset.itemId = itemId; // Track which item this button is for
  btn.innerHTML = `
    <span class="buxback-btn-content">
      <span class="buxback-btn-main">Buy with BuxBack</span>
      ${cashback ? `<span class="buxback-btn-cashback">+${cashback.toLocaleString()} Robux back</span>` : ''}
    </span>
  `;

  btn.addEventListener('click', createModal);

  // Try to find Roblox's buy button or Add to cart button
  let inserted = false;

  // First, try to find the Buy button by text content
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    const text = button.textContent.trim().toLowerCase();
    if (text === 'buy' || text === 'add to cart' || text.includes('purchase')) {
      // Found a buy button - insert after it
      const parent = button.parentElement;
      if (parent) {
        const wrapper = document.createElement('div');
        wrapper.className = 'buxback-btn-wrapper';
        wrapper.appendChild(btn);
        // Insert after the Add to cart button if it exists, otherwise after Buy
        const addToCartBtn = Array.from(allButtons).find(b => b.textContent.trim().toLowerCase() === 'add to cart');
        if (addToCartBtn && addToCartBtn.parentElement) {
          addToCartBtn.parentElement.insertBefore(wrapper, addToCartBtn.nextSibling);
        } else {
          parent.insertBefore(wrapper, button.nextSibling);
        }
        inserted = true;
        console.log('[BuxBack] Button inserted after:', button.textContent.trim());
        break;
      }
    }
  }

  // Fallback selectors
  if (!inserted) {
    const fallbackSelectors = [
      '[class*="PurchaseButton"]',
      '[class*="action-button"]',
      '[data-testid="purchase-button"]'
    ];

    for (const selector of fallbackSelectors) {
      const el = document.querySelector(selector);
      if (el && el.parentElement) {
        const wrapper = document.createElement('div');
        wrapper.className = 'buxback-btn-wrapper';
        wrapper.appendChild(btn);
        el.parentElement.insertBefore(wrapper, el.nextSibling);
        inserted = true;
        console.log('[BuxBack] Button inserted via fallback selector:', selector);
        break;
      }
    }
  }

  if (!inserted) {
    // Final fallback: insert after price section
    const priceSection = document.querySelector('[class*="price-row"], [class*="item-price"], [class*="PriceLabel"]');
    if (priceSection && priceSection.parentElement) {
      const wrapper = document.createElement('div');
      wrapper.className = 'buxback-btn-wrapper';
      wrapper.appendChild(btn);
      priceSection.parentElement.insertBefore(wrapper, priceSection.nextSibling);
      console.log('[BuxBack] Button inserted via price fallback');
    } else {
      console.log('[BuxBack] Could not find insertion point');
    }
  }
}

/**
 * Check if we're on an item detail page
 */
function isItemDetailPage() {
  return /\/(catalog|bundles|game-pass)\/\d+/.test(window.location.pathname);
}

/**
 * Check if item is already owned by the user
 */
function isItemOwned() {
  // Look for the main purchase button area - we only care if the PRIMARY action button says "Owned"
  // This avoids false positives from "You own a similar item" messages elsewhere on the page

  // Method 1: Check for Roblox's purchase button that explicitly shows "Owned" state
  // The purchase button is typically in a container with specific classes
  const purchaseButtonSelectors = [
    '[class*="PurchaseButton"] button',
    '[class*="purchase-button"] button',
    '[data-testid="purchase-button"]',
    '[class*="action-button"] button'
  ];

  for (const selector of purchaseButtonSelectors) {
    const btn = document.querySelector(selector);
    if (btn) {
      const text = btn.textContent.trim().toLowerCase();
      if (text === 'owned' || text === 'item owned') {
        console.log('[BuxBack] Item owned detected via purchase button:', text);
        return true;
      }
    }
  }

  // Method 2: Check for a disabled button with "owned" in class (Roblox's owned state)
  const ownedButton = document.querySelector('[class*="PurchaseButton"][class*="owned"], [class*="purchase-button"][class*="owned"]');
  if (ownedButton) {
    console.log('[BuxBack] Item owned detected via owned class on purchase button');
    return true;
  }

  // Method 3: Look for Buy/Get button - if it exists, item is NOT owned
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = btn.textContent.trim().toLowerCase();
    // If there's a Buy or Get button, the item is definitely not owned
    if (text === 'buy' || text === 'get' || text === 'add to cart') {
      console.log('[BuxBack] Buy/Get button found, item not owned');
      return false;
    }
  }

  // Don't assume owned - default to not owned so button shows
  return false;
}

/**
 * Initialize or re-initialize on the current page
 */
function init() {
  console.log('[BuxBack] Checking URL:', window.location.pathname);

  if (!isItemDetailPage()) {
    console.log('[BuxBack] Not an item detail page, cleaning up');
    cleanup();
    return;
  }

  console.log('[BuxBack] Item page detected!');

  // Clear any pending init
  if (initTimeout) {
    clearTimeout(initTimeout);
  }

  // Try immediately
  createCashbackButton();

  // Retry a few times for React hydration
  setTimeout(createCashbackButton, 500);
  setTimeout(createCashbackButton, 1000);
  setTimeout(createCashbackButton, 2000);
  setTimeout(createCashbackButton, 3000);
}

/**
 * Handle URL changes (for SPA navigation)
 */
function handleUrlChange() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    console.log('[BuxBack] URL changed:', currentUrl, '->', newUrl);
    currentUrl = newUrl;
    init();
  }
}

/**
 * Set up navigation detection
 */
function setupNavigationDetection() {
  // Method 1: Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    console.log('[BuxBack] popstate detected');
    setTimeout(handleUrlChange, 100);
  });

  // Method 2: Intercept pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    console.log('[BuxBack] pushState detected');
    setTimeout(handleUrlChange, 100);
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    console.log('[BuxBack] replaceState detected');
    setTimeout(handleUrlChange, 100);
  };

  // Method 3: MutationObserver as backup (watches for major DOM changes)
  let lastCheck = 0;
  const observer = new MutationObserver(() => {
    // Throttle checks to avoid performance issues
    const now = Date.now();
    if (now - lastCheck < 500) return;
    lastCheck = now;

    // Check if URL changed
    if (window.location.href !== currentUrl) {
      handleUrlChange();
    } else if (isItemDetailPage() && !document.getElementById('buxback-btn')) {
      // URL same but button missing - try to add it
      createCashbackButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Start everything
console.log('[BuxBack] Itempage script loaded');
setupNavigationDetection();
init();

})(); // End IIFE
