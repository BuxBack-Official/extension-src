/**
 * BuxBack Content Script - Catalog Injection
 * Injects cashback badges on Roblox catalog pages
 */

(function() {
  'use strict';

  // Prevent double initialization from programmatic + declarative injection
  if (window.__buxbackCatalogLoaded) return;
  window.__buxbackCatalogLoaded = true;

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

  // Roblox asset type IDs for classic clothing
  const CLASSIC_CLOTHING_ASSET_TYPES = [2, 11, 12]; // T-Shirt, Shirt, Pants

/**
 * Calculate cashback amount based on item type
 */
function calculateCashback(price, isGamePass = false, isClassicClothing = false) {
  let rate = CATALOG_CASHBACK_RATE;
  if (isGamePass || isClassicClothing) {
    rate = GAMEPASS_CASHBACK_RATE;
  }
  return Math.floor(price * rate);
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Create cashback badge element
 */
function createCashbackBadge(cashbackAmount) {
  const badge = document.createElement("div");
  badge.className = "buxback-badge";
  const span = document.createElement("span");
  span.textContent = "+" + formatNumber(cashbackAmount);
  badge.appendChild(span);
  badge.appendChild(document.createTextNode(" back"));
  return badge;
}

/**
 * Find the item card container from an image
 * Returns { container, isGamePass }
 */
function findItemCard(img) {
  let el = img;
  for (let i = 0; i < 8 && el; i++) {
    // Look for a link to catalog/bundles/game-pass
    const catalogLink = el.querySelector('a[href*="/catalog/"]') || el.querySelector('a[href*="/bundles/"]');
    const gamePassLink = el.querySelector('a[href*="/game-pass/"]');

    if (catalogLink) return { container: el, isGamePass: false };
    if (gamePassLink) return { container: el, isGamePass: true };

    el = el.parentElement;
  }
  return null;
}

/**
 * Check if item should be excluded from cashback
 */
function shouldExclude(container) {
  const text = container.textContent.toLowerCase();

  // Skip limited items (resold by users, not direct purchases)
  if (text.includes('limited')) return true;

  // Skip items with resale indicators
  if (container.querySelector('[class*="resale"]')) return true;
  if (container.querySelector('[class*="limited"]')) return true;

  // Skip free items
  if (text.includes('free')) return true;

  // Skip off-sale items
  if (text.includes('off sale')) return true;

  return false;
}

/**
 * Find price - look for price element near the item name
 */
function findPrice(container) {
  // Look for elements that contain just a price (small text content)
  const allElements = container.querySelectorAll('*');

  for (const el of allElements) {
    // Skip if has many children (not a leaf/price element)
    if (el.children.length > 2) continue;

    const text = el.textContent.trim();
    // Price elements are typically short (just the number)
    if (text.length > 15) continue;

    // Match a number that looks like a price
    const match = text.match(/^[\s]*(\d{1,3}(?:,\d{3})*|\d+)[\s]*$/);
    if (match) {
      const n = parseInt(match[1].replace(/,/g, ''), 10);
      if (n >= 5 && n <= 5000000) {
        return n;
      }
    }
  }
  return null;
}

/**
 * Process a thumbnail image
 */
function processThumbnail(img) {
  // Skip tiny images (icons, avatars) and non-catalog images
  if (img.width > 0 && img.width < 50) return false;

  // Find the item card
  const result = findItemCard(img);
  if (!result) return false;

  const { container, isGamePass } = result;

  // Already processed?
  if (container.dataset.buxback) return false;
  container.dataset.buxback = "1";

  if (container.querySelector('.buxback-badge')) return false;

  // Skip excluded items (limiteds, free, off-sale)
  if (shouldExclude(container)) return false;

  // Find price
  const price = findPrice(container);
  if (!price) return false;

  const cashback = calculateCashback(price, isGamePass);
  if (cashback < 1) return false;

  // Find the thumbnail container - walk up until we find a block-level element
  let badgeTarget = img.parentElement;
  while (badgeTarget && getComputedStyle(badgeTarget).display === 'inline') {
    badgeTarget = badgeTarget.parentElement;
  }

  if (!badgeTarget) return false;

  // Only set position if it's not already positioned
  const pos = getComputedStyle(badgeTarget).position;
  if (pos === 'static') {
    badgeTarget.style.position = 'relative';
  }

  // Create a wrapper for the badge
  const wrapper = document.createElement('div');
  wrapper.className = 'buxback-badge-wrapper';
  wrapper.appendChild(createCashbackBadge(cashback));
  badgeTarget.appendChild(wrapper);

  return true;
}

/**
 * Scan page and inject badges
 */
function injectBadges() {
  // Find all images that look like catalog thumbnails
  const images = document.querySelectorAll('img[src*="rbxcdn.com"], img[src*="roblox.com"]');
  let count = 0;

  images.forEach(img => {
    if (processThumbnail(img)) count++;
  });

  if (count > 0) {
    console.log(`[BuxBack] +${count} badges`);
  }
}

/**
 * Initialize
 */
(function() {
  console.log("[BuxBack] Loaded");

  // Inject immediately
  injectBadges();

  // Watch for ANY DOM changes and inject aggressively
  const observer = new MutationObserver(() => {
    injectBadges();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also on scroll for infinite scroll
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        injectBadges();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

})(); // End IIFE
