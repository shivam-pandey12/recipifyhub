const RECIPIFY_THEME_KEY = 'recipifyhub-theme';
const RECIPIFY_LANGUAGE_KEY = 'recipifyhub-language';
const RECIPIFY_COOKIE_CONSENT_KEY = 'recipifyhub-cookie-consent';
const RECIPIFY_USER_KEY = 'user';
const RECIPIFY_AUTH_CACHE_KEY = 'recipifyhub-auth-cache';
const RECIPIFY_AUTH_CACHE_TTL_MS = 120000;
const NEWSLETTER_STORAGE_KEY = 'recipifyhub-newsletter-subscribers';
const NEWSLETTER_LAST_EMAIL_KEY = 'recipifyhub-newsletter-last-email';
const FEEDBACK_ROOT_ID = 'recipify-feedback-root';
const DYNAMIC_TRANSLATION_CACHE_PREFIX = 'recipifyhub-dynamic-translation:';
const RECIPIFY_MARK_SRC = 'favicon-192x192.png';
let activeConfirmResolver = null;
let sharedObserversBound = false;
let translationObserver = null;
let authRefreshPromise = null;
const ORIGINAL_TEXT_NODES = new WeakMap();
const ORIGINAL_ATTRIBUTE_VALUES = new WeakMap();
const DYNAMIC_TRANSLATION_MEMORY = new Map();

const TEXT_TRANSLATIONS = {
  hi: {
    'Home': 'होम',
    'Recipes': 'रेसिपी',
    'Planner': 'प्लानर',
    'Nutrition': 'पोषण',
    'Calculator': 'कैलकुलेटर',
    'Cook Mode': 'कुक मोड',
    'Restaurants': 'रेस्टोरेंट',
    'Login': 'लॉगिन',
    'Profile': 'प्रोफाइल',
    'My Profile': 'मेरी प्रोफाइल',
    'Browse Recipes': 'रेसिपी देखें',
    'Logout': 'लॉगआउट',
    'Explore': 'एक्सप्लोर',
    'Tools': 'टूल्स',
    'Stay Updated': 'अपडेट पाते रहें',
    'Recipe Library': 'रेसिपी लाइब्रेरी',
    'Add Recipe': 'रेसिपी जोड़ें',
    'Nutrition Studio': 'न्यूट्रिशन स्टूडियो',
    'Kitchen Calculators': 'किचन कैलकुलेटर',
    'Weather': 'मौसम',
    'Privacy': 'प्राइवेसी',
    'Terms': 'नियम',
    'Cookies': 'कुकीज़',
    'Powered by MH Horizon': 'MH Horizon द्वारा संचालित',
    'Receive recipe drops, premium workflow updates, and product notes from MH Horizon.': 'MH Horizon से रेसिपी अपडेट, प्रीमियम वर्कफ़्लो अपडेट और प्रोडक्ट नोट्स पाएँ।',
    'Session + cookie aware': 'सेशन और कुकी समर्थित',
    'Premium food discovery, planning, nutrition, and cooking workflows. Powered by MH Horizon.': 'प्रीमियम फूड डिस्कवरी, प्लानिंग, पोषण और कुकिंग वर्कफ़्लो। MH Horizon द्वारा संचालित।',
    'This email is already subscribed on this device.': 'यह ईमेल इस डिवाइस पर पहले से सब्सक्राइब है।',
    'Subscription saved. Expect curated updates from MH Horizon.': 'सब्सक्रिप्शन सेव हो गया। MH Horizon से चुने हुए अपडेट मिलेंगे।',
    'Subscription could not be saved right now.': 'अभी सब्सक्रिप्शन सेव नहीं हो सका।',
    'Enter an email address to subscribe.': 'सब्सक्राइब करने के लिए ईमेल पता लिखें।',
    'Enter a valid email address.': 'कृपया सही ईमेल पता लिखें।',
    'Please confirm': 'कृपया पुष्टि करें',
    'Cancel': 'रद्द करें',
    'Continue': 'जारी रखें',
    'Switch language': 'भाषा बदलें',
    'Open user menu': 'यूज़र मेनू खोलें',
    'Toggle theme': 'थीम बदलें',
    'Email address': 'ईमेल पता',
    'Your email': 'आपका ईमेल',
    'Premium cook mode': 'प्रीमियम कुक मोड',
    'Loading recipe...': 'रेसिपी लोड हो रही है...',
    'Focused cooking flow with progress memory, timers, and spoken guidance. Powered by MH Horizon.': 'प्रोग्रेस मेमोरी, टाइमर और बोली गई गाइडेंस के साथ केंद्रित कुकिंग अनुभव। MH Horizon द्वारा संचालित।',
    'Open cook mode from a recipe page to bring ingredients and instructions into this focused workspace.': 'इस फोकस्ड वर्कस्पेस में सामग्री और निर्देश लाने के लिए कुक मोड किसी रेसिपी पेज से खोलें।',
    'Ingredients': 'सामग्री',
    'Checklist': 'चेकलिस्ट',
    'All steps': 'सभी स्टेप',
    'Previous': 'पिछला',
    'Read aloud': 'आवाज़ में पढ़ें',
    'Next': 'अगला',
    'Timers': 'टाइमर',
    'Utility rail': 'यूटिलिटी रेल',
    'Timer label': 'टाइमर लेबल',
    'Minutes': 'मिनट',
    'Start timer': 'टाइमर शुरू करें',
    'Keep awake': 'स्क्रीन जागृत रखें',
    'Reset progress': 'प्रगति रीसेट करें',
    'No timers running yet.': 'अभी कोई टाइमर चालू नहीं है।',
    'Voice assistant': 'वॉइस असिस्टेंट',
    'Command center': 'कमांड सेंटर',
    'Voice persona': 'वॉइस पर्सोना',
    'Voice language': 'आवाज़ की भाषा',
    'Start listening': 'सुनना शुरू करें',
    'Stop listening': 'सुनना बंद करें',
    'Speak ingredients': 'सामग्री पढ़ें',
    'Voice shortcuts': 'वॉइस शॉर्टकट',
    'Calm Guide': 'शांत गाइड',
    'Chef Mentor': 'शेफ मेंटर',
    'Fast Coach': 'तेज़ कोच',
    'Hindi Saathi': 'हिंदी साथी',
    'English': 'अंग्रेज़ी',
    'Hindi': 'हिंदी',
    'Ready for hands-free control.': 'हैंड्स-फ़्री कंट्रोल के लिए तैयार।',
    'Listening for commands...': 'कमांड सुन रहा है...',
    'Voice commands are not supported in this browser.': 'इस ब्राउज़र में वॉइस कमांड समर्थित नहीं हैं।',
    'Speech playback is not supported in this browser.': 'इस ब्राउज़र में स्पीच प्लेबैक समर्थित नहीं है।',
    'Multiple voice personas and Hindi/English control are ready here.': 'कई वॉइस पर्सोना और हिंदी/अंग्रेज़ी कंट्रोल यहाँ तैयार हैं।',
    'Login or create your RecipifyHub account to save recipes, plan meals, and personalize your cooking workflow.': 'रेसिपी सेव करने, मील प्लान बनाने और अपनी कुकिंग वर्कफ़्लो को पर्सनलाइज़ करने के लिए RecipifyHub अकाउंट में लॉगिन करें या नया अकाउंट बनाएँ।',
    'Member access': 'मेंबर एक्सेस',
    'Authentication': 'प्रमाणीकरण',
    'Enter your workspace': 'अपने वर्कस्पेस में जाएँ',
    'Use your username or email with your password. The page will redirect you back to the right place after login.': 'अपने यूज़रनेम या ईमेल के साथ पासवर्ड इस्तेमाल करें। लॉगिन के बाद पेज आपको सही जगह पर वापस ले जाएगा।',
    'Register': 'रजिस्टर',
    'Username or email': 'यूज़रनेम या ईमेल',
    'Password': 'पासवर्ड',
    'Create account': 'अकाउंट बनाएँ'
  }
};
  
const NAV_LINKS = [
  { href: 'recipify', label: 'Home', icon: 'fa-home' },
  { href: 'allrecipe', label: 'Recipes', icon: 'fa-book-open' },
  { href: 'meal-planner', label: 'Planner', icon: 'fa-calendar-alt' },
  { href: 'nutritionanalysis', label: 'Nutrition', icon: 'fa-chart-pie' },
  { href: 'calculator', label: 'Calculator', icon: 'fa-calculator' },
  { href: 'cookmode', label: 'Cook Mode', icon: 'fa-fire' },
  { href: 'restaurants', label: 'Restaurants', icon: 'fa-store' }
];

function getCurrentTheme() {
  return localStorage.getItem(RECIPIFY_THEME_KEY) || 'light';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStoredUser() {
  try {
    const user = JSON.parse(sessionStorage.getItem(RECIPIFY_USER_KEY) || 'null');
    return user && typeof user === 'object' && (user.username || user.email) ? user : null;
  } catch (error) {
    console.error('Unable to read stored user session:', error);
    sessionStorage.removeItem(RECIPIFY_USER_KEY);
    return null;
  }
}

function readAuthCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(RECIPIFY_AUTH_CACHE_KEY) || 'null');
    return cached && typeof cached === 'object' ? cached : null;
  } catch (error) {
    console.error('Unable to read auth cache:', error);
    sessionStorage.removeItem(RECIPIFY_AUTH_CACHE_KEY);
    return null;
  }
}

function storeAuthCache(user, metadata = {}) {
  const safeUser = user && typeof user === 'object' && (user.username || user.email) ? user : null;
  const payload = {
    isAuthenticated: !!safeUser,
    user: safeUser,
    userId: metadata.userId || safeUser?.id || safeUser?._id || null,
    updatedAt: Date.now()
  };

  try {
    sessionStorage.setItem(RECIPIFY_AUTH_CACHE_KEY, JSON.stringify(payload));
    if (safeUser) {
      sessionStorage.setItem(RECIPIFY_USER_KEY, JSON.stringify(safeUser));
    } else {
      sessionStorage.removeItem(RECIPIFY_USER_KEY);
    }
  } catch (error) {
    console.error('Unable to store auth cache:', error);
  }

  return payload;
}

function clearStoredAuth() {
  sessionStorage.removeItem(RECIPIFY_AUTH_CACHE_KEY);
  sessionStorage.removeItem(RECIPIFY_USER_KEY);
}

function getCachedAuthUser() {
  const authCache = readAuthCache();
  if (authCache?.user && (authCache.user.username || authCache.user.email)) {
    return authCache.user;
  }

  return getStoredUser();
}

function hasFreshAuthCache() {
  const authCache = readAuthCache();
  if (!authCache?.updatedAt) {
    return false;
  }

  return (Date.now() - Number(authCache.updatedAt)) < RECIPIFY_AUTH_CACHE_TTL_MS;
}

function getUserDisplayName(user) {
  if (!user) {
    return 'Profile';
  }

  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || 'Profile';
}

function getUserAvatar(user) {
  return user?.profileImageUrl || 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png';
}

function normalizeLanguage(language) {
  return language === 'hi' ? 'hi' : 'en';
}

function getCurrentLanguage() {
  return normalizeLanguage(localStorage.getItem(RECIPIFY_LANGUAGE_KEY) || 'en');
}

function translateText(value, language = getCurrentLanguage()) {
  const normalizedLanguage = normalizeLanguage(language);
  if (normalizedLanguage === 'en') {
    return value;
  }

  return TEXT_TRANSLATIONS[normalizedLanguage]?.[value] || value;
}

function updateLanguageControls() {
  const currentLanguage = getCurrentLanguage();
  document.documentElement.lang = currentLanguage === 'hi' ? 'hi' : 'en';
  document.querySelectorAll('[data-language-label]').forEach(label => {
    label.textContent = currentLanguage === 'hi' ? 'हिं' : 'EN';
  });
  document.querySelectorAll('[data-language-toggle]').forEach(button => {
    button.setAttribute('aria-label', translateText('Switch language', currentLanguage));
    button.setAttribute('title', translateText('Switch language', currentLanguage));
  });
}

function translateTextNode(node, language) {
  if (!node || !node.nodeValue) {
    return;
  }

  const original = ORIGINAL_TEXT_NODES.get(node) ?? node.nodeValue;
  if (!ORIGINAL_TEXT_NODES.has(node)) {
    ORIGINAL_TEXT_NODES.set(node, original);
  }

  const trimmed = original.trim();
  if (!trimmed) {
    return;
  }

  const translated = translateText(trimmed, language);
  node.nodeValue = translated === trimmed ? original : original.replace(trimmed, translated);
}

function translateAttributes(root, language) {
  if (!root?.querySelectorAll) {
    return;
  }

  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(element => {
    const originals = ORIGINAL_ATTRIBUTE_VALUES.get(element) || {};
    ['placeholder', 'title', 'aria-label'].forEach(attribute => {
      if (!element.hasAttribute(attribute)) {
        return;
      }

      if (!(attribute in originals)) {
        originals[attribute] = element.getAttribute(attribute);
      }

      const originalValue = originals[attribute];
      element.setAttribute(attribute, translateText(originalValue, language));
    });
    ORIGINAL_ATTRIBUTE_VALUES.set(element, originals);
  });
}

function translateDeclaredContent(root, language) {
  if (!root) {
    return;
  }

  const declaredNodes = [];
  if (root.nodeType === Node.ELEMENT_NODE && (root.hasAttribute('data-i18n-en') || root.hasAttribute('data-i18n-hi'))) {
    declaredNodes.push(root);
  }

  if (root.querySelectorAll) {
    declaredNodes.push(...root.querySelectorAll('[data-i18n-en],[data-i18n-hi]'));
  }

  declaredNodes.forEach(element => {
    const englishValue = element.getAttribute('data-i18n-en') || element.textContent || '';
    const translatedValue = language === 'hi'
      ? element.getAttribute('data-i18n-hi') || translateText(englishValue, language)
      : englishValue;

    element.textContent = translatedValue;
  });
}

function translateDocument(root = document.body, language = getCurrentLanguage()) {
  if (!root) {
    return;
  }

  const normalizedLanguage = normalizeLanguage(language);
  updateLanguageControls();

  const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }

      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parent.closest?.('[data-i18n-en],[data-i18n-hi]')) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  while (treeWalker.nextNode()) {
    textNodes.push(treeWalker.currentNode);
  }

  textNodes.forEach(node => translateTextNode(node, normalizedLanguage));
  translateAttributes(root, normalizedLanguage);
  translateDeclaredContent(root, normalizedLanguage);
}

function applyLanguage(language = getCurrentLanguage()) {
  const normalizedLanguage = normalizeLanguage(language);
  localStorage.setItem(RECIPIFY_LANGUAGE_KEY, normalizedLanguage);
  document.body?.setAttribute('data-language', normalizedLanguage);
  translateDocument(document.body, normalizedLanguage);
  window.dispatchEvent(new CustomEvent('recipify:language-changed', {
    detail: { language: normalizedLanguage }
  }));
  return normalizedLanguage;
}

async function translateDynamicText(value, targetLanguage = getCurrentLanguage()) {
  const normalizedLanguage = normalizeLanguage(targetLanguage);
  const sourceText = String(value ?? '');
  const trimmedText = sourceText.trim();

  if (!trimmedText || normalizedLanguage === 'en') {
    return sourceText;
  }

  const cacheKey = `${normalizedLanguage}:${trimmedText}`;
  if (DYNAMIC_TRANSLATION_MEMORY.has(cacheKey)) {
    return DYNAMIC_TRANSLATION_MEMORY.get(cacheKey);
  }

  try {
    const cached = sessionStorage.getItem(`${DYNAMIC_TRANSLATION_CACHE_PREFIX}${cacheKey}`);
    if (cached) {
      DYNAMIC_TRANSLATION_MEMORY.set(cacheKey, cached);
      return cached;
    }
  } catch (error) {
    console.error('Unable to read translation cache:', error);
  }

  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${normalizedLanguage}&dt=t&q=${encodeURIComponent(trimmedText)}`
    );

    if (!response.ok) {
      throw new Error(`Translation request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map(part => Array.isArray(part) ? (part[0] || '') : '').join('').trim()
      : '';
    const finalText = translated || sourceText;

    DYNAMIC_TRANSLATION_MEMORY.set(cacheKey, finalText);
    try {
      sessionStorage.setItem(`${DYNAMIC_TRANSLATION_CACHE_PREFIX}${cacheKey}`, finalText);
    } catch (cacheError) {
      console.error('Unable to store translation cache:', cacheError);
    }

    return finalText;
  } catch (error) {
    console.error('Dynamic translation failed:', error);
    return sourceText;
  }
}

async function translateDynamicList(values, targetLanguage = getCurrentLanguage()) {
  if (!Array.isArray(values) || !values.length) {
    return Array.isArray(values) ? values : [];
  }

  return Promise.all(values.map(value => translateDynamicText(value, targetLanguage)));
}

function applyTheme(theme = 'light') {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = normalizedTheme;
  document.body.classList.toggle('theme-classic', normalizedTheme === 'light');
  localStorage.setItem(RECIPIFY_THEME_KEY, normalizedTheme);

  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    const icon = button.querySelector('i');
    const label = button.querySelector('[data-theme-label]');

    if (icon) {
      icon.className = normalizedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    if (label) {
      label.textContent = normalizedTheme === 'dark' ? 'Light' : 'Dark';
    }

    button.setAttribute(
      'aria-label',
      normalizedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  });
}

function toggleTheme() {
  applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
}

function ensureFeedbackUI() {
  let root = document.getElementById(FEEDBACK_ROOT_ID);
  if (root) {
    return root;
  }

  root = document.createElement('div');
  root.id = FEEDBACK_ROOT_ID;
  root.innerHTML = `
    <div class="site-toast-stack" aria-live="polite" aria-atomic="true"></div>
    <div class="site-dialog-backdrop" data-site-dialog-backdrop>
      <div class="site-dialog" role="alertdialog" aria-modal="true" aria-labelledby="site-dialog-title" aria-describedby="site-dialog-message">
        <span class="site-dialog-badge" aria-hidden="true"><i class="fas fa-shield-heart"></i></span>
        <div class="site-dialog-copy">
          <h3 id="site-dialog-title">Please confirm</h3>
          <p id="site-dialog-message">Choose how you want to continue.</p>
        </div>
        <div class="site-dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-cancel>Cancel</button>
          <button type="button" class="btn btn-primary" data-dialog-confirm>Continue</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const dialogBackdrop = root.querySelector('[data-site-dialog-backdrop]');
  const cancelButton = root.querySelector('[data-dialog-cancel]');
  const confirmButton = root.querySelector('[data-dialog-confirm]');

  const resolveDialog = value => {
    dialogBackdrop.classList.remove('is-open');
    document.body.style.removeProperty('overflow');

    if (activeConfirmResolver) {
      const resolve = activeConfirmResolver;
      activeConfirmResolver = null;
      resolve(value);
    }
  };

  cancelButton.addEventListener('click', () => resolveDialog(false));
  confirmButton.addEventListener('click', () => resolveDialog(true));
  dialogBackdrop.addEventListener('click', event => {
    if (event.target === dialogBackdrop) {
      resolveDialog(false);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialogBackdrop.classList.contains('is-open')) {
      resolveDialog(false);
    }
  });

  return root;
}

function getFeedbackElements() {
  const root = ensureFeedbackUI();
  return {
    toastStack: root.querySelector('.site-toast-stack'),
    dialogBackdrop: root.querySelector('[data-site-dialog-backdrop]'),
    dialogTitle: root.querySelector('#site-dialog-title'),
    dialogMessage: root.querySelector('#site-dialog-message'),
    dialogCancel: root.querySelector('[data-dialog-cancel]'),
    dialogConfirm: root.querySelector('[data-dialog-confirm]')
  };
}

function showToast(message, type = 'info', options = {}) {
  const { title = '', duration = 3200 } = options;
  const language = getCurrentLanguage();
  const { toastStack } = getFeedbackElements();
  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };
  const normalizedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';

  const toast = document.createElement('div');
  toast.className = `site-toast site-toast--${normalizedType}`;

  const icon = document.createElement('span');
  icon.className = 'site-toast__icon';
  icon.innerHTML = `<i class="fas ${iconMap[normalizedType]}"></i>`;

  const copy = document.createElement('div');
  copy.className = 'site-toast__copy';

  if (title) {
    const toastTitle = document.createElement('strong');
    toastTitle.className = 'site-toast__title';
    toastTitle.textContent = translateText(title, language);
    copy.appendChild(toastTitle);
  }

  const toastMessage = document.createElement('p');
  toastMessage.className = 'site-toast__message';
  toastMessage.textContent = translateText(message, language);
  copy.appendChild(toastMessage);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'site-toast__close';
  closeButton.setAttribute('aria-label', 'Dismiss notification');
  closeButton.innerHTML = '<i class="fas fa-xmark"></i>';

  let removalTimer = null;
  const removeToast = () => {
    if (removalTimer) {
      clearTimeout(removalTimer);
    }
    toast.remove();
  };

  closeButton.addEventListener('click', removeToast);

  toast.append(icon, copy, closeButton);
  toastStack.appendChild(toast);
  removalTimer = setTimeout(removeToast, duration);

  return toast;
}

function confirmAction(options = {}) {
  const {
    title = 'Please confirm',
    message = 'Choose how you want to continue.',
    confirmText = 'Continue',
    cancelText = 'Cancel',
    danger = false
  } = options;
  const elements = getFeedbackElements();
  const language = getCurrentLanguage();

  if (activeConfirmResolver) {
    activeConfirmResolver(false);
    activeConfirmResolver = null;
  }

  elements.dialogTitle.textContent = translateText(title, language);
  elements.dialogMessage.textContent = translateText(message, language);
  elements.dialogCancel.textContent = translateText(cancelText, language);
  elements.dialogConfirm.textContent = translateText(confirmText, language);
  elements.dialogConfirm.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;

  elements.dialogBackdrop.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    elements.dialogConfirm.focus();
  });

  return new Promise(resolve => {
    activeConfirmResolver = resolve;
  });
}

function mountSharedAssets() {
  if (!document.getElementById('recipify-shared-styles')) {
    const sharedStyles = document.createElement('link');
    sharedStyles.id = 'recipify-shared-styles';
    sharedStyles.rel = 'stylesheet';
    sharedStyles.href = 'styles.css';
    document.head.appendChild(sharedStyles);
  }

  if (!document.getElementById('recipify-theme-styles')) {
    const themeStyles = document.createElement('link');
    themeStyles.id = 'recipify-theme-styles';
    themeStyles.rel = 'stylesheet';
    themeStyles.href = 'theme-classic.css';
    document.head.appendChild(themeStyles);
  }

  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fontAwesome);
  }
}

function isActiveLink(href) {
  const path = window.location.pathname.split('/').pop() || 'recipify';
  if (href === 'recipify') {
    return path === '' || path === 'recipify' || path === '/';
  }

  return path === href;
}

function buildGuestAuthMarkup() {
  return `
    <a href="login" class="btn btn-outline">
      <i class="fas fa-right-to-bracket"></i>
      <span>Login</span>
    </a>
  `;
}

function buildUserAuthMarkup(user) {
  const displayName = escapeHtml(getUserDisplayName(user));
  const avatar = escapeHtml(getUserAvatar(user));

  return `
    <div class="user-dropdown">
      <button class="user-menu-trigger" type="button" aria-label="Open user menu">
        <img src="${avatar}" alt="${displayName}" class="user-avatar">
        <span>${displayName}</span>
        <i class="fas fa-chevron-down"></i>
      </button>
      <div class="user-dropdown-menu">
        <a href="profile" class="dropdown-item"><i class="fas fa-user"></i> My Profile</a>
        <a href="allrecipe" class="dropdown-item"><i class="fas fa-book-open"></i> Browse Recipes</a>
        <a href="meal-planner" class="dropdown-item"><i class="fas fa-calendar-alt"></i> Planner</a>
        <a href="#" class="dropdown-item" data-logout-link><i class="fas fa-right-from-bracket"></i> Logout</a>
      </div>
    </div>
  `;
}

function getAuthMarkup(user) {
  return user ? buildUserAuthMarkup(user) : buildGuestAuthMarkup();
}

function createNavbar() {
  const navbar = document.createElement('nav');
  navbar.className = 'recipify-navbar';

  navbar.innerHTML = `
    <div class="navbar-container">
      <div class="navbar-brand">
        <a href="recipify" aria-label="Go to RecipifyHub home">
          <span class="brand-icon">
            <img src="${RECIPIFY_MARK_SRC}" alt="" class="brand-logo-mark" aria-hidden="true">
          </span>
          <span class="brand-copy">
            <span class="brand-text">RecipifyHub</span>
            <span class="brand-meta">Powered by MH Horizon</span>
          </span>
        </a>
      </div>
      <div class="navbar-links">
        ${NAV_LINKS.map(link => `
          <a href="${link.href}" class="nav-link${isActiveLink(link.href) ? ' active' : ''}">
            <i class="fas ${link.icon}"></i>
            <span>${link.label}</span>
          </a>
        `).join('')}
      </div>
      <div class="navbar-actions">
        <button class="language-toggle-btn" type="button" data-language-toggle aria-label="Switch language" title="Switch language">
          <i class="fas fa-language"></i>
          <span data-language-label>EN</span>
        </button>
        <button class="theme-toggle-btn" type="button" data-theme-toggle aria-label="Toggle theme">
          <i class="fas fa-moon"></i>
        </button>
        <div class="auth-slot" id="auth-links-placeholder">
          ${getAuthMarkup(getStoredUser())}
        </div>
        <button class="navbar-toggle" type="button" aria-label="Open menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  `;

  bindNavbarInteractions(navbar);
  return navbar;
}

function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'recipify-footer';
  footer.innerHTML = `
    <div class="footer-container">
      <section class="footer-section">
        <div class="footer-brand">
          <span class="footer-icon">
            <img src="${RECIPIFY_MARK_SRC}" alt="" class="footer-logo-mark" aria-hidden="true">
          </span>
          <div>
            <h3>RecipifyHub</h3>
            <p>Premium food discovery, planning, nutrition, and cooking workflows. Powered by MH Horizon.</p>
          </div>
        </div>
        <div class="cluster">
          <span class="pill"><i class="fas fa-language"></i> Hindi + English ready</span>
          <span class="pill"><i class="fas fa-cookie-bite"></i> Session + cookie aware</span>
        </div>
        <div class="social-links" style="margin-top: 1rem;">
          <a href="profile" class="social-link" aria-label="Profile"><i class="fas fa-user"></i></a>
          <a href="meal-planner" class="social-link" aria-label="Planner"><i class="fas fa-calendar-alt"></i></a>
          <a href="nutritionanalysis" class="social-link" aria-label="Nutrition"><i class="fas fa-chart-pie"></i></a>
          <a href="cookmode" class="social-link" aria-label="Cook Mode"><i class="fas fa-fire"></i></a>
        </div>
      </section>
      <section class="footer-section">
        <h3>Explore</h3>
        <ul class="footer-links">
          <li><a href="recipify">Home</a></li>
          <li><a href="allrecipe">Recipe Library</a></li>
          <li><a href="restaurants">Restaurants</a></li>
          <li><a href="recipe_input">Add Recipe</a></li>
          <li><a href="profile">Profile</a></li>
        </ul>
      </section>
      <section class="footer-section">
        <h3>Tools</h3>
        <ul class="footer-links">
          <li><a href="nutritionanalysis">Nutrition Studio</a></li>
          <li><a href="calculator">Kitchen Calculators</a></li>
          <li><a href="meal-planner">Planner</a></li>
          <li><a href="cookmode">Cook Mode</a></li>
          <li><a href="weather">Weather</a></li>
        </ul>
      </section>
      <section class="footer-section">
        <h3>Stay Updated</h3>
        <p>Receive recipe drops, premium workflow updates, and product notes from MH Horizon.</p>
        <form class="subscribe-form" novalidate>
          <div class="subscribe-input-row">
            <input type="email" placeholder="Your email" class="subscribe-input form-control" aria-label="Email address">
            <button type="submit" class="subscribe-btn" aria-label="Subscribe">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
          <p class="subscribe-status" aria-live="polite"></p>
        </form>
      </section>
    </div>
    <div class="footer-bottom">
      <p>&copy; ${new Date().getFullYear()} <strong>RecipifyHub</strong>. Crafted for ambitious home cooks and culinary explorers.</p>
      <p>
        <a href="privacy">Privacy</a>
        &nbsp;&bull;&nbsp;
        <a href="terms">Terms</a>
        &nbsp;&bull;&nbsp;
        <a href="cookies">Cookies</a>
        &nbsp;&bull;&nbsp;
        <strong>Powered by MH Horizon</strong>
      </p>
    </div>
  `;

  bindFooterInteractions(footer);
  return footer;
}

function bindNavbarInteractions(navbar) {
  const navLinks = navbar.querySelector('.navbar-links');
  const toggle = navbar.querySelector('.navbar-toggle');
  const themeButton = navbar.querySelector('[data-theme-toggle]');
  const languageButton = navbar.querySelector('[data-language-toggle]');

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  if (themeButton) {
    themeButton.addEventListener('click', toggleTheme);
  }

  if (languageButton) {
    languageButton.addEventListener('click', () => {
      applyLanguage(getCurrentLanguage() === 'hi' ? 'en' : 'hi');
    });
  }

  document.addEventListener('click', event => {
    const dropdown = navbar.querySelector('.user-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
      dropdown.classList.remove('active');
    }
  });

  updateAuthUI(navbar);
  updateLanguageControls();
}

function applyAuthState(user) {
  const isAuthenticated = !!user;
  const profileHref = isAuthenticated ? 'profile' : 'login';
  const displayName = isAuthenticated ? getUserDisplayName(user) : translateText('Profile', getCurrentLanguage());

  document.querySelectorAll('[data-auth-guest]').forEach(element => {
    element.classList.toggle('hidden', isAuthenticated);
  });

  document.querySelectorAll('[data-auth-user]').forEach(element => {
    element.classList.toggle('hidden', !isAuthenticated);
  });

  document.querySelectorAll('[data-auth-profile-link]').forEach(element => {
    element.setAttribute('href', profileHref);
  });

  document.querySelectorAll('[data-auth-display-name]').forEach(element => {
    element.textContent = displayName;
  });
}

async function fetchCurrentUser() {
  const cachedUser = getCachedAuthUser();

  if (cachedUser && hasFreshAuthCache()) {
    return cachedUser;
  }

  if (authRefreshPromise) {
    return authRefreshPromise;
  }

  authRefreshPromise = (async () => {
    try {
      const authResponse = await fetch('/api/auth/check-auth', {
        credentials: 'include',
        cache: 'no-store'
      });

      if (!authResponse.ok) {
        if ([401, 403].includes(authResponse.status)) {
          clearStoredAuth();
          return null;
        }

        return cachedUser;
      }

      const authStatus = await authResponse.json();
      if (!authStatus.success || !authStatus.isAuthenticated) {
        clearStoredAuth();
        return null;
      }

      if (cachedUser) {
        storeAuthCache(cachedUser, { userId: authStatus.userId });
        return cachedUser;
      }

      const response = await fetch('/api/user/profile', {
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (result.success && result.user) {
        storeAuthCache(result.user, { userId: authStatus.userId });
        return result.user;
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      return cachedUser;
    } finally {
      authRefreshPromise = null;
    }

    return cachedUser;
  })();

  return authRefreshPromise;
}

function bindAuthPlaceholderEvents(authPlaceholder) {
  if (!authPlaceholder) {
    return;
  }

  const dropdown = authPlaceholder.querySelector('.user-dropdown');
  const trigger = authPlaceholder.querySelector('.user-menu-trigger');
  const logoutLink = authPlaceholder.querySelector('[data-logout-link]');

  if (trigger && dropdown) {
    trigger.addEventListener('click', () => dropdown.classList.toggle('active'));
  }

  if (logoutLink) {
    logoutLink.addEventListener('click', async event => {
      event.preventDefault();
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });

        if (response.ok) {
          clearStoredAuth();
          applyAuthState(null);
          window.dispatchEvent(new CustomEvent('recipify:auth-changed', {
            detail: { isAuthenticated: false }
          }));
          window.location.href = 'recipify';
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }
}

function renderAuthMarkup(authPlaceholder, user) {
  if (!authPlaceholder) {
    return;
  }

  authPlaceholder.innerHTML = getAuthMarkup(user);
  bindAuthPlaceholderEvents(authPlaceholder);
  translateDocument(authPlaceholder, getCurrentLanguage());
}

async function updateAuthUI(scope = document) {
  const authPlaceholder = scope.querySelector ? scope.querySelector('#auth-links-placeholder') : document.querySelector('#auth-links-placeholder');
  if (!authPlaceholder) {
    return;
  }

  const cachedUser = getCachedAuthUser();
  renderAuthMarkup(authPlaceholder, cachedUser);
  applyAuthState(cachedUser);

  const user = await fetchCurrentUser();
  renderAuthMarkup(authPlaceholder, user);
  applyAuthState(user);
}

function bindFooterInteractions(scope = document) {
  const subscribeForm = scope.querySelector('.subscribe-form');
  if (!subscribeForm || subscribeForm.dataset.bound === 'true') {
    return;
  }

  subscribeForm.dataset.bound = 'true';
  const emailInput = subscribeForm.querySelector('.subscribe-input');
  const subscribeButton = subscribeForm.querySelector('.subscribe-btn');
  const statusElement = subscribeForm.querySelector('.subscribe-status');

  try {
    const savedEmail = localStorage.getItem(NEWSLETTER_LAST_EMAIL_KEY);
    if (savedEmail) {
      emailInput.value = savedEmail;
    }
  } catch (error) {
    console.error('Unable to restore newsletter email:', error);
  }

  subscribeForm.addEventListener('submit', event => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      setSubscriptionStatus(statusElement, 'Enter an email address to subscribe.', 'error');
      return;
    }

    if (!emailPattern.test(email)) {
      setSubscriptionStatus(statusElement, 'Enter a valid email address.', 'error');
      return;
    }

    subscribeButton.disabled = true;

    try {
      const existingSubscribers = JSON.parse(localStorage.getItem(NEWSLETTER_STORAGE_KEY) || '[]');
      const subscribers = Array.isArray(existingSubscribers) ? existingSubscribers : [];
      const alreadySubscribed = subscribers.includes(email);

      if (!alreadySubscribed) {
        subscribers.push(email);
        localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(subscribers));
      }

      localStorage.setItem(NEWSLETTER_LAST_EMAIL_KEY, email);
      setSubscriptionStatus(
        statusElement,
        alreadySubscribed
          ? 'This email is already subscribed on this device.'
          : 'Subscription saved. Expect curated updates from MH Horizon.',
        'success'
      );
    } catch (error) {
      console.error('Unable to save newsletter subscription:', error);
      setSubscriptionStatus(statusElement, 'Subscription could not be saved right now.', 'error');
    } finally {
      subscribeButton.disabled = false;
    }
  });
}

function setSubscriptionStatus(statusElement, message, type) {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.classList.remove('is-error', 'is-success');
  statusElement.classList.add(type === 'error' ? 'is-error' : 'is-success');
}

function createCookieBanner() {
  const banner = document.createElement('div');
  banner.className = 'cookie-banner hidden';
  banner.innerHTML = `
    <div>
      <strong>Session + cookie notice</strong>
      <p style="margin: 0.35rem 0 0;">
        RecipifyHub uses essential cookies for login sessions and optional storage for theme, newsletter, and planning helpers.
        Read more in our <a href="cookies"><strong>cookies policy</strong></a>.
      </p>
    </div>
    <div class="cookie-actions">
      <a href="privacy" class="btn btn-ghost">Privacy</a>
      <button type="button" class="btn btn-primary" data-cookie-accept>Accept</button>
    </div>
  `;

  banner.querySelector('[data-cookie-accept]').addEventListener('click', () => {
    localStorage.setItem(RECIPIFY_COOKIE_CONSENT_KEY, 'accepted');
    document.cookie = 'recipifyhub_cookie_consent=accepted; max-age=31536000; path=/; SameSite=Lax';
    banner.classList.add('hidden');
  });

  return banner;
}

function ensureCookieBanner() {
  const consent = localStorage.getItem(RECIPIFY_COOKIE_CONSENT_KEY);
  if (consent === 'accepted') {
    return;
  }

  let banner = document.querySelector('.cookie-banner');
  if (!banner) {
    banner = createCookieBanner();
    document.body.appendChild(banner);
  }

  banner.classList.remove('hidden');
}

function bindSharedObservers() {
  if (sharedObserversBound) {
    return;
  }

  sharedObserversBound = true;

  window.addEventListener('focus', () => updateAuthUI(document));
  window.addEventListener('pageshow', () => updateAuthUI(document));
  window.addEventListener('storage', event => {
    if ([RECIPIFY_LANGUAGE_KEY, RECIPIFY_THEME_KEY].includes(event.key)) {
      if (event.key === RECIPIFY_THEME_KEY) {
        applyTheme(getCurrentTheme());
      } else {
        applyLanguage(getCurrentLanguage());
      }
    }
  });
  window.addEventListener('recipify:auth-changed', event => {
    if (event.detail?.isAuthenticated) {
      storeAuthCache(event.detail.user || getStoredUser(), { userId: event.detail.user?.id || event.detail.user?._id || null });
    } else {
      clearStoredAuth();
    }

    updateAuthUI(document);
  });
  window.addEventListener('recipify:language-changed', () => applyAuthState(getCachedAuthUser()));

  if (!translationObserver && document.body) {
    translationObserver = new MutationObserver(mutations => {
      if (getCurrentLanguage() === 'en') {
        return;
      }

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node, getCurrentLanguage());
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateDocument(node, getCurrentLanguage());
          }
        });
      });
    });

    translationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

function createRecipeCard(recipe) {
  const title = recipe.name || recipe.recipe_name || recipe.title || 'Untitled recipe';
  const description = recipe.description || recipe.summary || 'Open the recipe to see the full cooking guide.';
  const image = recipe.image || recipe.image_url || recipe.thumbnail_url || 'https://via.placeholder.com/640x420?text=Recipe';
  const collection = recipe.source_collection || recipe.collection || '';
  const recipeId = recipe.id || recipe._id;
  const prepTime = recipe.prep_time || recipe.time || recipe.total_time || recipe.cook_time || '';
  const servings = recipe.servings || recipe.yield || recipe.serves || '';
  const cuisine = Array.isArray(recipe.cuisine) ? recipe.cuisine[0] : recipe.cuisine;

  const card = document.createElement('article');
  card.className = 'panel compact site-reveal';
  card.innerHTML = `
    <div style="aspect-ratio: 1.2 / 0.8; overflow: hidden; border-radius: 22px 22px 0 0;">
      <img src="${image}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/640x420?text=Recipe'">
    </div>
    <div class="panel-body stack">
      <div class="cluster">
        ${cuisine ? `<span class="pill"><i class="fas fa-globe"></i> ${cuisine}</span>` : ''}
      </div>
      <div>
        <h3>${title}</h3>
        <p>${description.length > 135 ? `${description.slice(0, 132)}...` : description}</p>
      </div>
      <div class="cluster">
        ${prepTime ? `<span class="pill"><i class="far fa-clock"></i> ${prepTime}</span>` : ''}
        ${servings ? `<span class="pill"><i class="fas fa-users"></i> ${servings}</span>` : ''}
      </div>
      <a class="btn btn-primary" href="recipe?id=${encodeURIComponent(recipeId)}${collection ? `&collection=${encodeURIComponent(collection)}` : ''}">
        <i class="fas fa-arrow-right"></i>
        <span>Open Recipe</span>
      </a>
    </div>
  `;

  return card;
}

function initComponents() {
  mountSharedAssets();
  applyTheme(getCurrentTheme());
  document.body.classList.add('site-chrome');
  ensureFeedbackUI();

  if (!document.querySelector('.recipify-navbar')) {
    document.body.prepend(createNavbar());
  }

  if (!document.querySelector('.recipify-footer')) {
    document.body.appendChild(createFooter());
  }

  ensureCookieBanner();
  bindSharedObservers();
  applyAuthState(getStoredUser());
  updateAuthUI(document);
  applyLanguage(getCurrentLanguage());
}

document.addEventListener('DOMContentLoaded', () => {
  mountSharedAssets();
  applyTheme(getCurrentTheme());
  updateLanguageControls();
});

window.RecipifyComponents = {
  applyTheme,
  applyLanguage,
  confirmAction,
  createNavbar,
  createFooter,
  createRecipeCard,
  getCurrentLanguage,
  initComponents,
  showToast,
  translateDynamicList,
  translateDynamicText,
  translateDocument,
  translateText,
  updateAuthUI
};

