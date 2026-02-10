/**
 * BuxBack Content Script - Game Detail Page
 * Adds cashback buttons to game passes in the Store tab
 */

(function() {
  'use strict';

  // Rate fetched from API, this is a fallback default
  let GAMEPASS_CASHBACK_RATE = 0.05;

  // Load rates from storage (background script fetches from API)
  browser.storage.local.get('rates').then((result) => {
    if (result.rates) {
      GAMEPASS_CASHBACK_RATE = result.rates.gamepass || GAMEPASS_CASHBACK_RATE;
      console.log('[BuxBack] Gamepass rate loaded:', result.rates.gamepass);
    }
  });
  const GAME_LINK = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";

  // Track processed game passes to avoid duplicates
  const processedPasses = new Set();

  /**
   * Extract game pass ID from a purchase button or link
   */
  function getGamePassIdFromElement(element) {
    // Try data-item-id attribute
    const itemId = element.dataset?.itemId;
    if (itemId) return itemId;

    // Try data-assetid attribute
    const assetId = element.dataset?.assetid;
    if (assetId) return assetId;

    // Try to find in parent container
    const container = element.closest('.store-card, .list-item, [class*="game-pass"]');
    if (container) {
      const link = container.querySelector('a[href*="/game-pass/"]');
      if (link) {
        const match = link.href.match(/\/game-pass\/(\d+)/);
        if (match) return match[1];
      }
    }

    // Try looking at the Purchase button's data attributes
    const purchaseBtn = element.closest('.store-card, .list-item')?.querySelector('.PurchaseButton, [class*="PurchaseButton"]');
    if (purchaseBtn) {
      return purchaseBtn.dataset?.itemId || purchaseBtn.dataset?.assetid;
    }

    return null;
  }

  /**
   * Extract price from a game pass card
   */
  function getPriceFromCard(card) {
    // Look for price text in the card
    const priceEl = card.querySelector('[class*="price"], .text-robux, .robux-price, [class*="Price"]');
    if (priceEl) {
      const match = priceEl.textContent.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
      if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    }

    // Look for price in button text
    const buttons = card.querySelectorAll('button, .btn');
    for (const btn of buttons) {
      const match = btn.textContent.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
      if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    }

    return null;
  }

  /**
   * Extract name from a game pass card
   */
  function getNameFromCard(card) {
    const nameEl = card.querySelector('.item-name, [class*="ItemName"], .store-card-name, h3, h4, a[href*="/game-pass/"]');
    return nameEl ? nameEl.textContent.trim() : 'Game Pass';
  }

  /**
   * Create the modal for a game pass
   */
  function createModal(passId, passName, price) {
    // Remove existing modal
    const existing = document.getElementById('buxback-modal');
    if (existing) existing.remove();

    const cashback = price ? Math.floor(price * GAMEPASS_CASHBACK_RATE) : 0;

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
            <p class="buxback-item-name">${passName}</p>

            <div class="buxback-price-summary">
              ${price ? `
                <div class="buxback-price-row">
                  <span>Price</span>
                  <span class="buxback-price-value">${price.toLocaleString()} Robux</span>
                </div>
              ` : ''}
              ${cashback ? `
                <div class="buxback-price-row buxback-cashback-row">
                  <span>Your Cashback (${Math.round(GAMEPASS_CASHBACK_RATE * 100)}%)</span>
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

            <div class="buxback-id-section">
              <label>Game Pass ID</label>
              <div class="buxback-copy-row">
                <input type="text" value="${passId}" readonly id="buxback-item-id">
                <button class="buxback-copy-btn" data-copy="${passId}">Copy</button>
              </div>
            </div>

            <div class="buxback-instructions">
              <p><strong>How to buy with cashback:</strong></p>
              <ol>
                <li>Copy the Game Pass ID above</li>
                <li>Open the BuxBack game</li>
                <li>Paste the ID and complete your purchase</li>
                <li>Cashback will be added to your balance!</li>
              </ol>
            </div>

            <a href="${GAME_LINK}" target="_blank" class="buxback-game-btn">
              Continue to BuxBack Game
            </a>
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
   * Create BuxBack button for a game pass
   */
  function createBuxBackButton(passId, passName, price) {
    const cashback = price ? Math.floor(price * GAMEPASS_CASHBACK_RATE) : 0;

    const btn = document.createElement('button');
    btn.className = 'buxback-gamepass-btn';
    btn.dataset.passId = passId;
    btn.innerHTML = `
      <span class="buxback-gp-btn-text">BuxBack</span>
      ${cashback ? `<span class="buxback-gp-cashback">+${cashback}</span>` : ''}
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      createModal(passId, passName, price);
    });

    return btn;
  }

  /**
   * Process game pass cards and add BuxBack buttons
   */
  function processGamePasses() {
    // Find game pass containers - Roblox uses various selectors
    const passContainers = document.querySelectorAll(
      '#rbx-passes-container .store-card, ' +
      '#rbx-game-passes .list-item, ' +
      '.game-passes .store-card, ' +
      '[class*="game-pass-card"], ' +
      '.gear-passes-container .list-item'
    );

    console.log('[BuxBack] Found', passContainers.length, 'game pass containers');

    passContainers.forEach((card) => {
      // Get the purchase button to find the pass ID
      const purchaseBtn = card.querySelector('.PurchaseButton, [class*="PurchaseButton"], button[class*="purchase"]');
      if (!purchaseBtn) {
        console.log('[BuxBack] No purchase button found in card');
        return;
      }

      const passId = getGamePassIdFromElement(purchaseBtn);
      if (!passId) {
        console.log('[BuxBack] Could not extract pass ID');
        return;
      }

      // Skip if already processed
      if (processedPasses.has(passId)) return;
      if (card.querySelector('.buxback-gamepass-btn')) return;

      const passName = getNameFromCard(card);
      const price = getPriceFromCard(card);

      console.log('[BuxBack] Processing game pass:', passId, passName, price);

      // Create and insert the BuxBack button
      const buxbackBtn = createBuxBackButton(passId, passName, price);

      // Find the best place to insert the button
      const btnContainer = card.querySelector('.store-card-caption, .item-card-caption, [class*="caption"]');
      if (btnContainer) {
        btnContainer.appendChild(buxbackBtn);
      } else {
        // Fallback: insert after the purchase button
        purchaseBtn.parentElement.appendChild(buxbackBtn);
      }

      processedPasses.add(passId);
    });
  }

  /**
   * Also handle the passes shown in the Store tab list view
   */
  function processStoreTabPasses() {
    // Alternative selectors for passes that might be in a list format
    const storeCards = document.querySelectorAll('#store .store-card, #store .list-item, .tab-pane.store .store-card');

    storeCards.forEach((card) => {
      // Look for links to game-pass pages
      const passLink = card.querySelector('a[href*="/game-pass/"]');
      if (!passLink) return;

      const passIdMatch = passLink.href.match(/\/game-pass\/(\d+)/);
      if (!passIdMatch) return;

      const passId = passIdMatch[1];

      // Skip if already processed
      if (processedPasses.has(passId)) return;
      if (card.querySelector('.buxback-gamepass-btn')) return;

      const passName = getNameFromCard(card);
      const price = getPriceFromCard(card);

      console.log('[BuxBack] Processing store tab pass:', passId, passName, price);

      const buxbackBtn = createBuxBackButton(passId, passName, price);

      // Find insertion point
      const caption = card.querySelector('.store-card-caption, [class*="caption"]');
      if (caption) {
        caption.appendChild(buxbackBtn);
      } else {
        card.appendChild(buxbackBtn);
      }

      processedPasses.add(passId);
    });
  }

  /**
   * Handle dynamically loaded content
   */
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Check if any added nodes are game pass related
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList?.contains('store-card') ||
                  node.classList?.contains('list-item') ||
                  node.id === 'rbx-passes-container' ||
                  node.querySelector?.('.store-card, .list-item, .PurchaseButton')) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        if (shouldProcess) break;
      }

      if (shouldProcess) {
        // Debounce processing
        clearTimeout(window.buxbackProcessTimeout);
        window.buxbackProcessTimeout = setTimeout(() => {
          processGamePasses();
          processStoreTabPasses();
        }, 300);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Handle tab clicks to process passes when Store tab is shown
   */
  function setupTabListener() {
    document.addEventListener('click', (e) => {
      const tabLink = e.target.closest('a[href="#store"], [class*="tab"] a');
      if (tabLink && (tabLink.getAttribute('href') === '#store' || tabLink.textContent.toLowerCase().includes('store'))) {
        // Process passes after tab content loads
        setTimeout(() => {
          processGamePasses();
          processStoreTabPasses();
        }, 500);
        setTimeout(() => {
          processGamePasses();
          processStoreTabPasses();
        }, 1000);
      }
    });
  }

  /**
   * Check if we're on the store tab (via hash)
   */
  function isStoreTabActive() {
    return window.location.hash.includes('store') ||
           document.querySelector('#tab-store.active, .tab-store.active') !== null;
  }

  /**
   * Initialize
   */
  function init() {
    console.log('[BuxBack] Game detail page script loaded');

    // Process immediately
    processGamePasses();
    processStoreTabPasses();

    // Retry for dynamic content
    setTimeout(() => {
      processGamePasses();
      processStoreTabPasses();
    }, 1000);

    setTimeout(() => {
      processGamePasses();
      processStoreTabPasses();
    }, 2000);

    setTimeout(() => {
      processGamePasses();
      processStoreTabPasses();
    }, 3000);

    // If on store tab, process again
    if (isStoreTabActive()) {
      setTimeout(() => {
        processGamePasses();
        processStoreTabPasses();
      }, 500);
    }

    // Set up observers and listeners
    setupObserver();
    setupTabListener();

    // Handle hash changes
    window.addEventListener('hashchange', () => {
      if (isStoreTabActive()) {
        setTimeout(() => {
          processGamePasses();
          processStoreTabPasses();
        }, 500);
      }
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
