/**
 * BuxBack Content Script - Item Detail Page
 * Adds cashback button and modal on individual item pages
 */

(function() {
  'use strict';

  // Prevent double initialization from programmatic + declarative injection
  if (window.__buxbackItempageLoaded) return;
  window.__buxbackItempageLoaded = true;

  // Default rates (overridden by API fetch)
  let CATALOG_CASHBACK_RATE = 0.30;
  let CLASSIC_CLOTHING_CASHBACK_RATE = 0.05;
  let GAMEPASS_CASHBACK_RATE = 0.05;

  // Fetch live rates from API with storage cache (5 min TTL)
  async function loadRates() {
    try {
      const cached = await chrome.storage.local.get(['buxback_rates', 'buxback_rates_ts']);
      if (cached.buxback_rates && cached.buxback_rates_ts && Date.now() - cached.buxback_rates_ts < 300000) {
        CATALOG_CASHBACK_RATE = cached.buxback_rates.catalog || 0.30;
        CLASSIC_CLOTHING_CASHBACK_RATE = cached.buxback_rates.classic || 0.05;
        GAMEPASS_CASHBACK_RATE = cached.buxback_rates.gamepass || 0.05;
        return;
      }
      const res = await fetch('https://buxback.net/api/rates');
      if (res.ok) {
        const data = await res.json();
        CATALOG_CASHBACK_RATE = data.catalog || 0.30;
        CLASSIC_CLOTHING_CASHBACK_RATE = data.classic || 0.05;
        GAMEPASS_CASHBACK_RATE = data.gamepass || 0.05;
        await chrome.storage.local.set({ buxback_rates: data, buxback_rates_ts: Date.now() });
      }
    } catch (e) {
      console.log('[BuxBack] Using default rates');
    }
  }
  loadRates();
  const GAME_LINK = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";
  const PLACE_ID = "118219754091031";

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

  const modal = document.createElement('div');
  modal.id = 'buxback-modal';

  const overlay = document.createElement('div');
  overlay.className = 'buxback-modal-overlay';

  const content = document.createElement('div');
  content.className = 'buxback-modal-content';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'buxback-modal-close';
  closeBtn.textContent = '\u00D7';
  content.appendChild(closeBtn);

  const header = document.createElement('div');
  header.className = 'buxback-modal-header';
  const logo = document.createElement('div');
  logo.className = 'buxback-logo';
  logo.textContent = 'BuxBack';
  header.appendChild(logo);
  const h2 = document.createElement('h2');
  h2.textContent = 'Buy & Earn Cashback';
  header.appendChild(h2);
  content.appendChild(header);

  const body = document.createElement('div');
  body.className = 'buxback-modal-body';

  const itemNameEl = document.createElement('p');
  itemNameEl.className = 'buxback-item-name';
  itemNameEl.textContent = itemName;
  body.appendChild(itemNameEl);

  const priceSummary = document.createElement('div');
  priceSummary.className = 'buxback-price-summary';

  if (price) {
    const row = document.createElement('div');
    row.className = 'buxback-price-row';
    const label = document.createElement('span');
    label.textContent = 'Price';
    const val = document.createElement('span');
    val.className = 'buxback-price-value';
    val.textContent = price.toLocaleString() + ' Robux';
    row.appendChild(label);
    row.appendChild(val);
    priceSummary.appendChild(row);
  }

  if (cashback) {
    const row = document.createElement('div');
    row.className = 'buxback-price-row buxback-cashback-row';
    const label = document.createElement('span');
    label.textContent = 'Your Cashback';
    const val = document.createElement('span');
    val.className = 'buxback-cashback-value';
    val.textContent = '+' + cashback.toLocaleString() + ' Robux';
    row.appendChild(label);
    row.appendChild(val);
    priceSummary.appendChild(row);
  }

  if (price && cashback) {
    const row = document.createElement('div');
    row.className = 'buxback-price-row buxback-total-row';
    const label = document.createElement('span');
    label.textContent = 'You Actually Pay';
    const val = document.createElement('span');
    val.className = 'buxback-total-value';
    val.textContent = (price - cashback).toLocaleString() + ' Robux';
    row.appendChild(label);
    row.appendChild(val);
    priceSummary.appendChild(row);
  }

  body.appendChild(priceSummary);

  const instructions = document.createElement('div');
  instructions.className = 'buxback-instructions';
  const instrP = document.createElement('p');
  const instrStrong = document.createElement('strong');
  instrStrong.textContent = 'Click below to open the game with this item ready to buy:';
  instrP.appendChild(instrStrong);
  instructions.appendChild(instrP);
  body.appendChild(instructions);

  const deepLinkBtn = document.createElement('a');
  deepLinkBtn.href = deepLink;
  deepLinkBtn.className = 'buxback-game-btn buxback-deeplink-btn';
  deepLinkBtn.textContent = 'Open in BuxBack Game';
  body.appendChild(deepLinkBtn);

  const fallback = document.createElement('div');
  fallback.className = 'buxback-fallback';

  const fallbackLabel = document.createElement('p');
  fallbackLabel.className = 'buxback-fallback-label';
  fallbackLabel.textContent = "If the game doesn't open, copy the Item ID:";
  fallback.appendChild(fallbackLabel);

  const copyRow = document.createElement('div');
  copyRow.className = 'buxback-copy-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = itemId;
  input.readOnly = true;
  input.id = 'buxback-item-id';
  copyRow.appendChild(input);
  const copyBtn = document.createElement('button');
  copyBtn.className = 'buxback-copy-btn';
  copyBtn.dataset.copy = itemId;
  copyBtn.textContent = 'Copy';
  copyRow.appendChild(copyBtn);
  fallback.appendChild(copyRow);

  const fallbackLink = document.createElement('a');
  fallbackLink.href = GAME_LINK;
  fallbackLink.target = '_blank';
  fallbackLink.className = 'buxback-fallback-link';
  fallbackLink.textContent = 'Open game manually \u2192';
  fallback.appendChild(fallbackLink);

  body.appendChild(fallback);
  content.appendChild(body);
  overlay.appendChild(content);
  modal.appendChild(overlay);

  document.body.appendChild(modal);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) modal.remove();
  });

  // Close button
  closeBtn.addEventListener('click', () => modal.remove());

  // Copy button
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(itemId).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 2000);
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
  const btnContent = document.createElement('span');
  btnContent.className = 'buxback-btn-content';
  const btnMain = document.createElement('span');
  btnMain.className = 'buxback-btn-main';
  btnMain.textContent = 'Buy with BuxBack';
  btnContent.appendChild(btnMain);
  if (cashback) {
    const btnCashback = document.createElement('span');
    btnCashback.className = 'buxback-btn-cashback';
    btnCashback.textContent = '+' + cashback.toLocaleString() + ' Robux back';
    btnContent.appendChild(btnCashback);
  }
  btn.appendChild(btnContent);

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
