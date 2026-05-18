document.addEventListener('DOMContentLoaded', () => {
  if (window.RecipifyComponents && typeof window.RecipifyComponents.initComponents === 'function') {
    window.RecipifyComponents.initComponents();
    return;
  }

  const savedTheme = localStorage.getItem('recipifyhub-theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
});
