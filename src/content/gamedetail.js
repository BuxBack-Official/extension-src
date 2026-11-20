/**
 * BuxBack Content Script - Game Detail Page
 * Adds cashback buttons to game passes in the Store tab
 */

(function() {
  'use strict';

  // Prevent double initialization from programmatic + declarative injection
  if (window.__buxbackGamedetailLoaded) return;
  window.__buxbackGamedetailLoaded = true;

  // Default rate (overridden by API fetch)
  let GAMEPASS_CASHBACK_RATE = 0.05;
  const GAME_LINK = "https://www.roblox.com/games/118219754091031/BuxBack-Roblox-Cash-Back";

  // Fetch live rates from API with storage cache (5 min TTL)
  async function loadRates() {
    try {
      const cached = await chrome.storage.local.get(['buxback_rates', 'buxback_rates_ts']);
      if (cached.buxback_rates && cached.buxback_rates_ts && Date.now() - cached.buxback_rates_ts < 300000) {
        GAMEPASS_CASHBACK_RATE = cached.buxback_rates.gamepass || 0.05;
        return;
      }
      const res = await fetch('https://buxback.net/api/rates');
      if (res.ok) {
        const data = await res.json();
        GAMEPASS_CASHBACK_RATE = data.gamepass || 0.05;
        await chrome.storage.local.set({ buxback_rates: data, buxback_rates_ts: Date.now() });
      }
    } catch (e) {
      console.log('[BuxBack] Using default rates');
    }
  }
  loadRates();

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

    const nameEl = document.createElement('p');
    nameEl.className = 'buxback-item-name';
    nameEl.textContent = passName;
    body.appendChild(nameEl);

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
      label.textContent = 'Your Cashback (' + Math.round(GAMEPASS_CASHBACK_RATE * 100) + '%)';
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

    const idSection = document.createElement('div');
    idSection.className = 'buxback-id-section';
    const idLabel = document.createElement('label');
    idLabel.textContent = 'Game Pass ID';
    idSection.appendChild(idLabel);
    const copyRow = document.createElement('div');
    copyRow.className = 'buxback-copy-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = passId;
    input.readOnly = true;
    input.id = 'buxback-item-id';
    copyRow.appendChild(input);
    const copyBtn = document.createElement('button');
    copyBtn.className = 'buxback-copy-btn';
    copyBtn.dataset.copy = passId;
    copyBtn.textContent = 'Copy';
    copyRow.appendChild(copyBtn);
    idSection.appendChild(copyRow);
    body.appendChild(idSection);

    const instructions = document.createElement('div');
    instructions.className = 'buxback-instructions';
    const instrP = document.createElement('p');
    const instrStrong = document.createElement('strong');
    instrStrong.textContent = 'How to buy with cashback:';
    instrP.appendChild(instrStrong);
    instructions.appendChild(instrP);
    const ol = document.createElement('ol');
    const steps = [
      'Copy the Game Pass ID above',
      'Open the BuxBack game',
      'Paste the ID and complete your purchase',
      'Cashback will be added to your balance!'
    ];
    steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      ol.appendChild(li);
    });
    instructions.appendChild(ol);
    body.appendChild(instructions);

    const gameBtn = document.createElement('a');
    gameBtn.href = GAME_LINK;
    gameBtn.target = '_blank';
    gameBtn.className = 'buxback-game-btn';
    gameBtn.textContent = 'Continue to BuxBack Game';
    body.appendChild(gameBtn);

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
      navigator.clipboard.writeText(passId).then(() => {
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
   * Create BuxBack button for a game pass
   */
  function createBuxBackButton(passId, passName, price) {
    const cashback = price ? Math.floor(price * GAMEPASS_CASHBACK_RATE) : 0;

    const btn = document.createElement('button');
    btn.className = 'buxback-gamepass-btn';
    btn.dataset.passId = passId;
    const btnText = document.createElement('span');
    btnText.className = 'buxback-gp-btn-text';
    btnText.textContent = 'BuxBack';
    btn.appendChild(btnText);
    if (cashback) {
      const btnCashback = document.createElement('span');
      btnCashback.className = 'buxback-gp-cashback';
      btnCashback.textContent = '+' + cashback;
      btn.appendChild(btnCashback);
    }

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
