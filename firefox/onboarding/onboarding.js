/**
 * BuxBack Onboarding Page (Firefox)
 */

const API_BASE_URL = "https://www.buxback.net";

// Handle Get Started button
document.getElementById("get-started-btn").addEventListener("click", (e) => {
  e.preventDefault();
  window.open(`${API_BASE_URL}/register?extension=true`, "_blank");
});

// Handle Learn More button
document.getElementById("learn-more-btn").addEventListener("click", (e) => {
  e.preventDefault();
  window.open(`${API_BASE_URL}/help`, "_blank");
});

console.log("[BuxBack] Onboarding page loaded");
