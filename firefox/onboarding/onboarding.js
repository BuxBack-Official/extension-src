/**
 * BuxBack Onboarding Page (Firefox)
 */

// For development, use localhost. For production, use your deployed URL
const API_BASE_URL = "http://localhost:3000"; // Change to https://buxback.vercel.app for production

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
