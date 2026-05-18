(function () {
  const VOICE_PREFERENCE_KEY = 'recipifyhub-cook-voice-settings';
  const SPEECH_RECOGNITION = window.SpeechRecognition || window.webkitSpeechRecognition;
  const DYNAMIC_COPY = {
    en: {
      subtitle: '{ingredients} ingredients • {steps} steps • {source} source',
      emptyLaunch: 'Open cook mode from a recipe page to bring ingredients and instructions into this focused workspace.',
      loadError: 'This recipe could not be loaded for cook mode.',
      noIngredients: 'No structured ingredients were found for this recipe.',
      noSteps: 'No instructions available for this recipe yet.',
      stepCounter: 'Step {current} of {total}',
      stepTitle: 'Step {current}',
      stepPreview: 'Step {index}: {preview}',
      recentCommandEmpty: 'No recent command yet.',
      voicePersonaNote: '{name} keeps the pace {tone}.',
      timerRunning: 'Running',
      timerPaused: 'Paused',
      timerCompleted: 'Done',
      timerRemaining: '{time} remaining',
      timerStarted: '{label} started for {minutes} minutes.',
      timerPausedToast: '{label} paused.',
      timerResumed: '{label} resumed.',
      timerReset: '{label} reset.',
      timerRemoved: '{label} removed.',
      timerCompletedToast: '{label} is done.',
      wakeLockEnabled: 'Screen wake lock enabled.',
      wakeLockDisabled: 'Screen wake lock released.',
      wakeLockUnavailable: 'Keep-awake is not supported in this browser.',
      progressReset: 'Cook mode progress has been reset.',
      commandNotRecognized: 'I did not catch a matching command.',
      voiceUnsupported: 'Voice commands are not supported in this browser.',
      speechUnsupported: 'Speech playback is not supported in this browser.',
      heardCommand: 'Heard: {command}',
      helpResponse: 'Try next, previous, dobara, timer start karo 10 min ke liye, roko timer, dobara shuru karo timer, timer reset karo, ingredients padho, or timer ka status batao.',
      timersEmpty: 'No timers running yet.',
      timerHintLabel: 'Start {minutes} min timer',
      timerHintFallback: 'Step timer',
      timerSummaryEmpty: 'There are no active timers right now.',
      timerSummaryMany: '{count} timers are active.',
      movedToStep: 'Moved to step {step}.',
      listeningOn: 'Listening for commands...',
      listeningOff: 'Ready for hands-free control.',
      commandCenterNote: 'Multiple voice personas and Hindi or English control are ready here.',
      speakIngredientsLabel: 'Ingredients: {items}',
      speakTimersLabel: 'Timers: {items}',
      recipeSpeakIntro: 'Step {step}. {text}',
      ingredientsMissingSpeak: 'There are no structured ingredients to read yet.',
      timerResolvedNone: 'There is no matching timer for that command.',
      stopVoiceToast: 'Voice playback stopped.',
      awake: 'Awake',
      keepAwake: 'Keep awake',
      speakTimersButton: 'Speak timers'
    },
    hi: {
      subtitle: '{ingredients} सामग्री • {steps} स्टेप • {source} स्रोत',
      emptyLaunch: 'इस फोकस्ड वर्कस्पेस में सामग्री और निर्देश लाने के लिए कुक मोड किसी रेसिपी पेज से खोलें।',
      loadError: 'यह रेसिपी कुक मोड के लिए लोड नहीं हो सकी।',
      noIngredients: 'इस रेसिपी में संरचित सामग्री नहीं मिली।',
      noSteps: 'इस रेसिपी के लिए निर्देश अभी उपलब्ध नहीं हैं।',
      stepCounter: 'स्टेप {current} / {total}',
      stepTitle: 'स्टेप {current}',
      stepPreview: 'स्टेप {index}: {preview}',
      recentCommandEmpty: 'अभी तक कोई कमांड नहीं मिली।',
      voicePersonaNote: '{name} {tone} अंदाज़ में गाइड करता है।',
      timerRunning: 'चालू',
      timerPaused: 'रुका',
      timerCompleted: 'पूरा',
      timerRemaining: '{time} बाकी',
      timerStarted: '{label} {minutes} मिनट के लिए शुरू हुआ।',
      timerPausedToast: '{label} रोक दिया गया है।',
      timerResumed: '{label} फिर से चालू है।',
      timerReset: '{label} रीसेट हो गया है।',
      timerRemoved: '{label} हटा दिया गया है।',
      timerCompletedToast: '{label} पूरा हो गया है।',
      wakeLockEnabled: 'स्क्रीन जागृत रखी जाएगी।',
      wakeLockDisabled: 'स्क्रीन जागृत मोड बंद हो गया।',
      wakeLockUnavailable: 'इस ब्राउज़र में स्क्रीन जागृत रखने का सपोर्ट नहीं है।',
      progressReset: 'कुक मोड प्रोग्रेस रीसेट कर दी गई है।',
      commandNotRecognized: 'यह कमांड समझ में नहीं आई।',
      voiceUnsupported: 'इस ब्राउज़र में वॉइस कमांड समर्थित नहीं हैं।',
      speechUnsupported: 'इस ब्राउज़र में वॉइस प्लेबैक समर्थित नहीं है।',
      heardCommand: 'सुना गया: {command}',
      helpResponse: 'आप बोल सकते हैं: aagla, pichla, dobara, timer start karo 10 min ke liye, roko timer, dobara shuru karo timer, timer reset karo, ingredients padho, या timer ka status batao।',
      timersEmpty: 'अभी कोई टाइमर चालू नहीं है।',
      timerHintLabel: '{minutes} मिनट का टाइमर शुरू करें',
      timerHintFallback: 'स्टेप टाइमर',
      timerSummaryEmpty: 'अभी कोई सक्रिय टाइमर नहीं है।',
      timerSummaryMany: '{count} टाइमर अभी सक्रिय हैं।',
      movedToStep: 'स्टेप {step} पर पहुँच गए।',
      listeningOn: 'कमांड सुनी जा रही है...',
      listeningOff: 'हैंड्स-फ्री कंट्रोल के लिए तैयार।',
      commandCenterNote: 'यहाँ कई वॉइस पर्सोना और हिंदी या अंग्रेज़ी कंट्रोल उपलब्ध हैं।',
      speakIngredientsLabel: 'सामग्री: {items}',
      speakTimersLabel: 'टाइमर: {items}',
      recipeSpeakIntro: 'स्टेप {step}. {text}',
      ingredientsMissingSpeak: 'पढ़ने के लिए संरचित सामग्री उपलब्ध नहीं है।',
      timerResolvedNone: 'उस कमांड के लिए कोई टाइमर नहीं मिला।',
      stopVoiceToast: 'वॉइस प्लेबैक बंद कर दिया गया।',
      awake: 'जागृत',
      keepAwake: 'जागृत रखें',
      speakTimersButton: 'टाइमर पढ़ें'
    }
  };

  const VOICE_SHORTCUTS = {
    en: ['Next / aagla / aage', 'Previous / pichla / peche', 'Repeat / dobara', 'Timer start karo 10 min ke liye', 'Pause / roko timer', 'Dobara shuru karo timer', 'Timer reset karo', 'Ingredients padho', 'Timer ka status batao'],
    hi: ['aagla / aage', 'pichla / peche', 'dobara', 'timer start karo 10 min ke liye', 'roko timer', 'dobara shuru karo timer', 'timer reset karo', 'ingredients padho', 'timer ka status batao']
  };

  const PERSONAS = {
    calm: {
      id: 'calm',
      label: { en: 'Calm Guide', hi: 'शांत गाइड' },
      tone: { en: 'measured and smooth', hi: 'धीमा और सहज' },
      rate: 0.96,
      pitch: 1.0,
      keywords: {
        en: ['google', 'microsoft', 'natural', 'aria', 'zira', 'online', 'desktop', 'samantha'],
        hi: ['hindi', 'google', 'microsoft', 'heera', 'swara', 'aditi', 'india', 'online']
      }
    },
    mentor: {
      id: 'mentor',
      label: { en: 'Chef Mentor', hi: 'शेफ मेंटर' },
      tone: { en: 'confident and warm', hi: 'आत्मविश्वास और गर्मजोशी वाला' },
      rate: 1.0,
      pitch: 0.96,
      keywords: {
        en: ['microsoft', 'google', 'natural', 'davis', 'daniel', 'guy', 'rishi', 'online'],
        hi: ['hindi', 'microsoft', 'google', 'india', 'heera', 'aditi', 'kalpana']
      }
    },
    fast: {
      id: 'fast',
      label: { en: 'Fast Coach', hi: 'फास्ट कोच' },
      tone: { en: 'quick and energetic', hi: 'तेज़ और ऊर्जावान' },
      rate: 1.08,
      pitch: 1.02,
      keywords: {
        en: ['google', 'microsoft', 'natural', 'aria', 'jenny', 'online'],
        hi: ['hindi', 'google', 'microsoft', 'india', 'online']
      }
    },
    hindi: {
      id: 'hindi',
      label: { en: 'Hindi Saathi', hi: 'हिंदी साथी' },
      tone: { en: 'Indian and conversational', hi: 'भारतीय और बातचीत जैसा' },
      rate: 0.94,
      pitch: 1.01,
      keywords: {
        en: ['india', 'google', 'microsoft', 'natural', 'online'],
        hi: ['hindi', 'google', 'microsoft', 'heera', 'swara', 'aditi', 'india', 'online']
      }
    }
  };

  document.addEventListener('DOMContentLoaded', initCookMode);

  function initCookMode() {
    window.RecipifyComponents?.initComponents?.();

    const refs = {
      cookTitle: document.getElementById('cook-title'),
      cookSubtitle: document.getElementById('cook-subtitle'),
      cookEmpty: document.getElementById('cook-empty'),
      cookApp: document.getElementById('cook-app'),
      ingredientList: document.getElementById('ingredient-list'),
      stepList: document.getElementById('step-list'),
      stepCounter: document.getElementById('step-counter'),
      stepTitle: document.getElementById('step-title'),
      stepBody: document.getElementById('step-body'),
      stepProgressFill: document.getElementById('step-progress-fill'),
      stepProgressLabel: document.getElementById('step-progress-label'),
      stepTimerHints: document.getElementById('step-timer-hints'),
      timerList: document.getElementById('timer-list'),
      timerForm: document.getElementById('timer-form'),
      timerLabel: document.getElementById('timer-label'),
      timerMinutes: document.getElementById('timer-minutes'),
      wakeLock: document.getElementById('wake-lock'),
      resetProgress: document.getElementById('reset-progress'),
      prevStep: document.getElementById('prev-step'),
      nextStep: document.getElementById('next-step'),
      speakStep: document.getElementById('speak-step'),
      stopSpeaking: document.getElementById('stop-speaking'),
      voiceHeading: document.getElementById('voice-heading'),
      voiceDescription: document.getElementById('voice-description'),
      voicePersonaNote: document.getElementById('voice-persona-note'),
      voiceLanguage: document.getElementById('voice-language'),
      voicePersona: document.getElementById('voice-persona'),
      toggleListening: document.getElementById('toggle-listening'),
      speakIngredients: document.getElementById('speak-ingredients'),
      speakTimers: document.getElementById('speak-timers'),
      voiceStatus: document.getElementById('voice-status'),
      voiceStatusText: document.getElementById('voice-status-text'),
      voiceTranscript: document.getElementById('voice-transcript'),
      voiceShortcuts: document.getElementById('voice-shortcuts')
    };

    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('id');
    const collection = normalizeCollection(params.get('collection'));
    const state = createInitialState(recipeId, collection);

    loadVoicePreferences(state);
    hydrateVoiceControls(refs, state);
    bindStaticEvents(refs, state);
    bindVoiceEvents(refs, state);
    applyStaticLabels(refs, state);
    loadAvailableVoices(state);

    window.speechSynthesis?.addEventListener?.('voiceschanged', () => loadAvailableVoices(state));
    window.addEventListener('recipify:language-changed', async () => {
      applyStaticLabels(refs, state);
      if (state.currentRecipe) {
        await applyCookModeLanguage(state);
      }
      renderEverything(refs, state);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.keepAwakeRequested) {
        requestWakeLock(refs, state);
      }
    });
    window.addEventListener('beforeunload', () => cleanupVoiceAndWakeLock(state));

    if (!recipeId || !collection) {
      showEmptyState(refs, copyText('emptyLaunch'));
      return;
    }

    loadRecipeIntoCookMode(refs, state).catch(error => {
      console.error('Cook mode load failed:', error);
      showEmptyState(refs, copyText('loadError'));
    });
  }

  function createInitialState(recipeId, collection) {
    return {
      recipeId,
      collection,
      progressKey: recipeId ? `recipifyhub-cook-progress:${recipeId}:${collection}` : '',
      ingredients: [],
      steps: [],
      currentStep: 0,
      checked: {},
      timers: [],
      currentRecipe: null,
      normalizedRecipe: null,
      baseTitle: '',
      displayTitle: '',
      originalIngredients: [],
      originalSteps: [],
      voices: [],
      speaking: false,
      recognition: null,
      listening: false,
      manuallyStoppedRecognition: false,
      keepAwakeHandle: null,
      keepAwakeRequested: false,
      persona: 'calm',
      voiceLanguage: currentUiLanguage(),
      lastTranscript: '',
      tickHandle: null
    };
  }

  function currentUiLanguage() {
    return window.RecipifyComponents?.getCurrentLanguage?.() === 'hi' ? 'hi' : 'en';
  }

  function translateShared(text) {
    return window.RecipifyComponents?.translateText
      ? window.RecipifyComponents.translateText(text, currentUiLanguage())
      : text;
  }

  function copyText(key, replacements, languageOverride) {
    const language = languageOverride || currentUiLanguage();
    const template = DYNAMIC_COPY[language]?.[key] || DYNAMIC_COPY.en[key] || key;
    return Object.entries(replacements || {}).reduce((value, [token, replacement]) => (
      value.replace(new RegExp(`\\{${token}\\}`, 'g'), String(replacement))
    ), template);
  }

  function showToast(message, type) {
    window.RecipifyComponents?.showToast?.(message, type || 'info');
  }

  function normalizeCollection(collection) {
    if (!collection) {
      return '';
    }

    return window.RecipifyDB?.normalizeCollectionName
      ? window.RecipifyDB.normalizeCollectionName(collection)
      : String(collection).trim();
  }

  function loadVoicePreferences(state) {
    try {
      const saved = JSON.parse(localStorage.getItem(VOICE_PREFERENCE_KEY) || '{}');
      if (saved.persona && PERSONAS[saved.persona]) {
        state.persona = saved.persona;
      }
      if (saved.voiceLanguage === 'hi' || saved.voiceLanguage === 'en') {
        state.voiceLanguage = saved.voiceLanguage;
      }
    } catch (error) {
      console.error('Unable to load cook mode voice preferences:', error);
    }
  }

  function saveVoicePreferences(state) {
    localStorage.setItem(VOICE_PREFERENCE_KEY, JSON.stringify({
      persona: state.persona,
      voiceLanguage: state.voiceLanguage
    }));
  }

  function hydrateVoiceControls(refs, state) {
    refs.voiceLanguage.innerHTML = `
      <option value="en">${translateShared('English')}</option>
      <option value="hi">${translateShared('Hindi')}</option>
    `;

    refs.voicePersona.innerHTML = Object.values(PERSONAS).map(persona => `
      <option value="${persona.id}">${persona.label[currentUiLanguage()] || persona.label.en}</option>
    `).join('');

    refs.voiceLanguage.value = state.voiceLanguage;
    refs.voicePersona.value = state.persona;
  }

  function applyStaticLabels(refs, state) {
    refs.prevStep.innerHTML = `<i class="fas fa-chevron-left"></i> ${translateShared('Previous')}`;
    refs.speakStep.innerHTML = `<i class="fas fa-volume-high"></i> ${translateShared('Read aloud')}`;
    refs.stopSpeaking.innerHTML = `<i class="fas fa-volume-xmark"></i> ${currentUiLanguage() === 'hi' ? 'वॉइस बंद करें' : 'Stop voice'}`;
    refs.nextStep.innerHTML = `${translateShared('Next')} <i class="fas fa-chevron-right"></i>`;
    refs.voiceHeading.textContent = translateShared('Command center');
    refs.voiceDescription.textContent = copyText('commandCenterNote');
    refs.toggleListening.innerHTML = state.listening
      ? `<i class="fas fa-microphone-slash"></i> ${translateShared('Stop listening')}`
      : `<i class="fas fa-microphone-lines"></i> ${translateShared('Start listening')}`;
    refs.speakIngredients.innerHTML = `<i class="fas fa-list-check"></i> ${translateShared('Speak ingredients')}`;
    refs.speakTimers.innerHTML = `<i class="fas fa-stopwatch"></i> ${copyText('speakTimersButton')}`;
    refs.voiceStatusText.textContent = state.listening ? copyText('listeningOn') : copyText('listeningOff');
    refs.voiceTranscript.textContent = state.lastTranscript || copyText('recentCommandEmpty');
    refs.timerLabel.placeholder = currentUiLanguage() === 'hi' ? 'आराम, बेक, धीमी आँच' : 'Rest, bake, simmer';
    refs.wakeLock.innerHTML = state.keepAwakeHandle
      ? `<i class="fas fa-check"></i> ${copyText('awake')}`
      : `<i class="fas fa-mobile-screen"></i> ${copyText('keepAwake')}`;

    hydrateVoiceControls(refs, state);
    renderVoiceShortcuts(refs);
    updateVoicePersonaNote(refs, state);
  }

  function updateVoicePersonaNote(refs, state) {
    const persona = PERSONAS[state.persona] || PERSONAS.calm;
    refs.voicePersonaNote.textContent = copyText('voicePersonaNote', {
      name: persona.label[currentUiLanguage()] || persona.label.en,
      tone: persona.tone[currentUiLanguage()] || persona.tone.en
    });
  }

  function renderVoiceShortcuts(refs) {
    refs.voiceShortcuts.innerHTML = (VOICE_SHORTCUTS[currentUiLanguage()] || VOICE_SHORTCUTS.en)
      .map(item => `<span class="voice-pill">${item}</span>`)
      .join('');
  }

  function showEmptyState(refs, message) {
    refs.cookApp.classList.add('hidden');
    refs.cookEmpty.classList.remove('hidden');
    refs.cookEmpty.textContent = message;
  }

  function bindStaticEvents(refs, state) {
    refs.prevStep.addEventListener('click', () => goToStep(state, refs, state.currentStep - 1));
    refs.nextStep.addEventListener('click', () => goToStep(state, refs, state.currentStep + 1));
    refs.speakStep.addEventListener('click', () => speakCurrentStep(state, refs));
    refs.stopSpeaking.addEventListener('click', () => stopSpeaking(state));
    refs.speakIngredients.addEventListener('click', () => speakIngredients(state, refs));
    refs.speakTimers.addEventListener('click', () => speakTimerSummary(state, refs));
    refs.wakeLock.addEventListener('click', () => toggleWakeLock(refs, state));
    refs.resetProgress.addEventListener('click', () => resetProgress(refs, state));

    refs.timerForm.addEventListener('submit', event => {
      event.preventDefault();
      const label = refs.timerLabel.value.trim() || translateShared('Timer label');
      const minutes = Math.max(Number(refs.timerMinutes.value || 1), 1);
      createTimer(state, refs, label, minutes);
      refs.timerLabel.value = '';
    });
  }

  function bindVoiceEvents(refs, state) {
    refs.voiceLanguage.addEventListener('change', () => {
      state.voiceLanguage = refs.voiceLanguage.value === 'hi' ? 'hi' : 'en';
      saveVoicePreferences(state);
      updateVoicePersonaNote(refs, state);
      if (state.recognition) {
        state.recognition.lang = getRecognitionLanguage(state);
      }
    });

    refs.voicePersona.addEventListener('change', () => {
      state.persona = PERSONAS[refs.voicePersona.value] ? refs.voicePersona.value : 'calm';
      saveVoicePreferences(state);
      updateVoicePersonaNote(refs, state);
    });

    refs.toggleListening.addEventListener('click', () => {
      if (state.listening) {
        stopListening(state, refs, true);
      } else {
        startListening(state, refs);
      }
    });
  }

  async function loadRecipeIntoCookMode(refs, state) {
    const result = await window.RecipifyDB.getRecipeById(state.recipeId, state.collection);
    if (!result.success || !result.data) {
      showEmptyState(refs, copyText('loadError'));
      return;
    }

    state.currentRecipe = result.data;
    state.normalizedRecipe = window.RecipifyDB.normalizeRecipeData(result.data, state.collection);
    state.baseTitle = state.normalizedRecipe.name || state.normalizedRecipe.recipe_name || 'Cook mode';
    state.originalIngredients = dedupeItems(extractIngredients(state.currentRecipe, state.normalizedRecipe));
    state.originalSteps = dedupeItems(extractSteps(state.currentRecipe, state.normalizedRecipe));
    if (!state.originalSteps.length && state.normalizedRecipe?.description) {
      state.originalSteps = [String(state.normalizedRecipe.description).trim()];
    }

    await applyCookModeLanguage(state);

    restoreProgress(state);
    refs.cookTitle.textContent = state.displayTitle || state.baseTitle;
    refs.cookApp.classList.remove('hidden');
    refs.cookEmpty.classList.add('hidden');
    renderEverything(refs, state);

    if (state.tickHandle) {
      window.clearInterval(state.tickHandle);
    }
    state.tickHandle = window.setInterval(() => tickTimers(state, refs), 1000);
  }

  function renderEverything(refs, state) {
    refs.cookTitle.textContent = state.displayTitle || state.baseTitle || 'Cook mode';
    renderSubtitle(refs, state);
    renderIngredients(refs, state);
    renderSteps(refs, state);
    renderTimers(refs, state);
    applyStaticLabels(refs, state);
  }

  async function applyCookModeLanguage(state) {
    state.displayTitle = state.baseTitle;
    state.ingredients = Array.isArray(state.originalIngredients) ? state.originalIngredients.slice() : [];
    state.steps = Array.isArray(state.originalSteps) ? state.originalSteps.slice() : [];

    if (currentUiLanguage() !== 'hi') {
      return;
    }

    if (!window.RecipifyComponents?.translateDynamicText || !window.RecipifyComponents?.translateDynamicList) {
      return;
    }

    const [translatedTitle, translatedIngredients, translatedSteps] = await Promise.all([
      window.RecipifyComponents.translateDynamicText(state.baseTitle, 'hi'),
      window.RecipifyComponents.translateDynamicList(state.originalIngredients, 'hi'),
      window.RecipifyComponents.translateDynamicList(state.originalSteps, 'hi')
    ]);

    state.displayTitle = translatedTitle || state.baseTitle;
    state.ingredients = translatedIngredients?.length ? translatedIngredients : state.originalIngredients.slice();
    state.steps = translatedSteps?.length ? translatedSteps : state.originalSteps.slice();
  }

  function renderSubtitle(refs, state) {
    refs.cookSubtitle.textContent = copyText('subtitle', {
      ingredients: state.ingredients.length,
      steps: Math.max(state.steps.length, 1),
      source: (state.collection || 'recipe').replace(/_/g, ' ')
    });
  }

  function renderIngredients(refs, state) {
    refs.ingredientList.innerHTML = state.ingredients.length
      ? state.ingredients.map((ingredient, index) => `
          <label class="ingredient-check">
            <input type="checkbox" data-ingredient="${index}" ${state.checked[index] ? 'checked' : ''}>
            <span>${escapeHtml(String(ingredient))}</span>
          </label>
        `).join('')
      : `<div class="empty-state">${copyText('noIngredients')}</div>`;

    refs.ingredientList.querySelectorAll('[data-ingredient]').forEach(input => {
      input.addEventListener('change', () => {
        state.checked[input.dataset.ingredient] = input.checked;
        persistProgress(state);
      });
    });
  }

  function renderSteps(refs, state) {
    const total = Math.max(state.steps.length, 1);
    const boundedIndex = Math.min(Math.max(state.currentStep, 0), total - 1);
    state.currentStep = boundedIndex;

    const stepText = state.steps[boundedIndex] || copyText('noSteps');
    const progress = Math.round(((boundedIndex + 1) / total) * 100);
    refs.stepCounter.textContent = copyText('stepCounter', { current: boundedIndex + 1, total });
    refs.stepTitle.textContent = copyText('stepTitle', { current: boundedIndex + 1 });
    refs.stepBody.textContent = stepText;
    refs.stepProgressFill.style.width = `${progress}%`;
    refs.stepProgressLabel.textContent = `${progress}%`;

    refs.stepList.innerHTML = state.steps.length
      ? state.steps.map((step, index) => `
          <button type="button" class="${index === boundedIndex ? 'active' : ''}" data-step-index="${index}">
            ${copyText('stepPreview', { index: index + 1, preview: truncateText(step, 84) })}
          </button>
        `).join('')
      : `<div class="empty-state">${copyText('noSteps')}</div>`;

    refs.stepList.querySelectorAll('[data-step-index]').forEach(button => {
      button.addEventListener('click', () => goToStep(state, refs, Number(button.dataset.stepIndex)));
    });

    renderStepTimerHints(refs, state, stepText);
  }

  function renderStepTimerHints(refs, state, stepText) {
    const hints = extractStepTimerHints(stepText).slice(0, 3);
    refs.stepTimerHints.innerHTML = hints.map((hint, index) => `
      <button type="button" class="voice-pill" data-step-timer="${index}">
        ${copyText('timerHintLabel', { minutes: hint.minutes })}
      </button>
    `).join('');

    refs.stepTimerHints.querySelectorAll('[data-step-timer]').forEach(button => {
      button.addEventListener('click', () => {
        const hint = hints[Number(button.dataset.stepTimer)];
        createTimer(state, refs, hint.label || `${copyText('timerHintFallback')} ${state.currentStep + 1}`, hint.minutes);
      });
    });
  }

  function renderTimers(refs, state) {
    const timers = state.timers.slice().sort((left, right) => left.createdAt - right.createdAt);
    const pauseLabel = currentUiLanguage() === 'hi' ? 'रोकें' : 'Pause';
    const startLabel = currentUiLanguage() === 'hi' ? 'शुरू करें' : 'Start';
    const resetLabel = currentUiLanguage() === 'hi' ? 'रीसेट' : 'Reset';
    const removeLabel = currentUiLanguage() === 'hi' ? 'हटाएँ' : 'Remove';
    refs.timerList.innerHTML = timers.length
      ? timers.map((timer, index) => {
          const remainingMs = getRemainingMs(timer);
          const progress = Math.max(2, Math.round(((timer.durationMs - remainingMs) / Math.max(timer.durationMs, 1)) * 100));
          const statusLabel = timer.status === 'running'
            ? copyText('timerRunning')
            : timer.status === 'paused'
              ? copyText('timerPaused')
              : copyText('timerCompleted');

          return `
            <div class="timer-item" data-timer-id="${timer.id}">
              <div class="timer-item-head">
                <strong>${escapeHtml(timer.label)}</strong>
                <span class="timer-state">${statusLabel}</span>
              </div>
              <div>
                <strong>${formatDuration(remainingMs)}</strong>
                <p class="support-note">${copyText('timerRemaining', { time: formatDuration(remainingMs) })}</p>
              </div>
              <div class="timer-progress"><span style="width:${Math.min(progress, 100)}%"></span></div>
              <div class="timer-controls">
                ${timer.status === 'running'
                  ? `<button class="btn btn-outline" type="button" data-timer-pause="${index}"><i class="fas fa-pause"></i> ${pauseLabel}</button>`
                  : `<button class="btn btn-outline" type="button" data-timer-resume="${index}"><i class="fas fa-play"></i> ${startLabel}</button>`}
                <button class="btn btn-ghost" type="button" data-timer-reset="${index}"><i class="fas fa-rotate-left"></i> ${resetLabel}</button>
                <button class="btn btn-danger" type="button" data-timer-remove="${index}"><i class="fas fa-trash"></i> ${removeLabel}</button>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="empty-state">${copyText('timersEmpty')}</div>`;

    refs.timerList.querySelectorAll('[data-timer-pause]').forEach(button => {
      button.addEventListener('click', () => pauseTimer(state, refs, Number(button.dataset.timerPause)));
    });
    refs.timerList.querySelectorAll('[data-timer-resume]').forEach(button => {
      button.addEventListener('click', () => resumeTimer(state, refs, Number(button.dataset.timerResume)));
    });
    refs.timerList.querySelectorAll('[data-timer-reset]').forEach(button => {
      button.addEventListener('click', () => resetTimer(state, refs, Number(button.dataset.timerReset)));
    });
    refs.timerList.querySelectorAll('[data-timer-remove]').forEach(button => {
      button.addEventListener('click', () => removeTimer(state, refs, Number(button.dataset.timerRemove)));
    });
  }

  function persistProgress(state) {
    if (!state.progressKey) {
      return;
    }

    localStorage.setItem(state.progressKey, JSON.stringify({
      currentStep: state.currentStep,
      checked: state.checked,
      timers: state.timers.map(snapshotTimer)
    }));
  }

  function restoreProgress(state) {
    if (!state.progressKey) {
      return;
    }

    try {
      const saved = JSON.parse(localStorage.getItem(state.progressKey) || '{}');
      state.currentStep = Math.min(Number(saved.currentStep || 0), Math.max(state.steps.length - 1, 0));
      state.checked = saved.checked && typeof saved.checked === 'object' ? saved.checked : {};
      state.timers = Array.isArray(saved.timers) ? saved.timers.map(reviveTimer).filter(Boolean) : [];
    } catch (error) {
      console.error('Unable to restore cook mode progress:', error);
      state.checked = {};
      state.timers = [];
    }
  }

  function snapshotTimer(timer) {
    return {
      id: timer.id,
      label: timer.label,
      durationMs: timer.durationMs,
      remainingMs: getRemainingMs(timer),
      status: timer.status,
      startedAt: timer.status === 'running' ? Date.now() : null,
      createdAt: timer.createdAt
    };
  }

  function reviveTimer(timer) {
    if (!timer || !timer.label) {
      return null;
    }

    const revived = {
      id: timer.id || generateId(),
      label: timer.label,
      durationMs: Math.max(Number(timer.durationMs) || 600000, 60000),
      remainingMs: Math.max(Number(timer.remainingMs) || 600000, 0),
      status: ['running', 'paused', 'completed'].includes(timer.status) ? timer.status : 'running',
      startedAt: timer.startedAt ? Number(timer.startedAt) : null,
      createdAt: Number(timer.createdAt) || Date.now()
    };

    if (revived.status === 'running' && revived.startedAt) {
      const elapsed = Date.now() - revived.startedAt;
      revived.remainingMs = Math.max(revived.remainingMs - elapsed, 0);
      revived.startedAt = Date.now();
      if (revived.remainingMs === 0) {
        revived.status = 'completed';
      }
    }

    if (revived.status === 'completed') {
      revived.remainingMs = 0;
    }

    return revived;
  }

  function getRemainingMs(timer) {
    if (timer.status !== 'running') {
      return Math.max(timer.remainingMs, 0);
    }

    return Math.max(timer.remainingMs - (Date.now() - timer.startedAt), 0);
  }

  function createTimer(state, refs, label, minutes) {
    const durationMs = Math.max(Number(minutes) || 1, 1) * 60000;
    state.timers.push({
      id: generateId(),
      label,
      durationMs,
      remainingMs: durationMs,
      status: 'running',
      startedAt: Date.now(),
      createdAt: Date.now()
    });
    renderTimers(refs, state);
    persistProgress(state);
    showToast(copyText('timerStarted', { label, minutes: Math.max(Number(minutes) || 1, 1) }), 'success');
  }

  function pauseTimer(state, refs, index) {
    const timer = state.timers[index];
    if (!timer) {
      return;
    }

    timer.remainingMs = getRemainingMs(timer);
    timer.status = 'paused';
    timer.startedAt = null;
    renderTimers(refs, state);
    persistProgress(state);
    showToast(copyText('timerPausedToast', { label: timer.label }), 'info');
  }

  function resumeTimer(state, refs, index) {
    const timer = state.timers[index];
    if (!timer) {
      return;
    }

    timer.remainingMs = timer.status === 'completed' ? timer.durationMs : Math.max(timer.remainingMs, 1000);
    timer.status = 'running';
    timer.startedAt = Date.now();
    renderTimers(refs, state);
    persistProgress(state);
    showToast(copyText('timerResumed', { label: timer.label }), 'success');
  }

  function resetTimer(state, refs, index) {
    const timer = state.timers[index];
    if (!timer) {
      return;
    }

    timer.remainingMs = timer.durationMs;
    timer.status = 'paused';
    timer.startedAt = null;
    renderTimers(refs, state);
    persistProgress(state);
    showToast(copyText('timerReset', { label: timer.label }), 'info');
  }

  function removeTimer(state, refs, index) {
    const timer = state.timers[index];
    if (!timer) {
      return;
    }

    state.timers.splice(index, 1);
    renderTimers(refs, state);
    persistProgress(state);
    showToast(copyText('timerRemoved', { label: timer.label }), 'info');
  }

  function tickTimers(state, refs) {
    let didChange = false;

    state.timers.forEach(timer => {
      if (timer.status !== 'running') {
        return;
      }

      const remainingMs = getRemainingMs(timer);
      if (remainingMs > 0) {
        return;
      }

      timer.remainingMs = 0;
      timer.status = 'completed';
      timer.startedAt = null;
      didChange = true;

      if (navigator.vibrate) {
        navigator.vibrate([140, 80, 140]);
      }

      showToast(copyText('timerCompletedToast', { label: timer.label }), 'success');
      speakText(state, refs, copyText('timerCompletedToast', { label: timer.label }, state.voiceLanguage), {
        responseLanguage: state.voiceLanguage,
        pauseListening: false
      });
    });

    if (didChange) {
      persistProgress(state);
    }

    renderTimers(refs, state);
  }

  function goToStep(state, refs, nextIndex, speakAfter) {
    if (!state.steps.length) {
      return;
    }

    state.currentStep = Math.min(Math.max(nextIndex, 0), state.steps.length - 1);
    renderSteps(refs, state);
    persistProgress(state);

    if (speakAfter) {
      speakCurrentStep(state, refs, true);
    }
  }

  function resetProgress(refs, state) {
    state.currentStep = 0;
    state.checked = {};
    renderEverything(refs, state);
    persistProgress(state);
    showToast(copyText('progressReset'), 'info');
  }

  async function toggleWakeLock(refs, state) {
    if (state.keepAwakeHandle) {
      await releaseWakeLock(refs, state, true);
      return;
    }

    state.keepAwakeRequested = true;
    await requestWakeLock(refs, state);
  }

  async function requestWakeLock(refs, state) {
    if (!('wakeLock' in navigator)) {
      showToast(copyText('wakeLockUnavailable'), 'info');
      return;
    }

    try {
      state.keepAwakeHandle = await navigator.wakeLock.request('screen');
      state.keepAwakeHandle.addEventListener('release', () => {
        state.keepAwakeHandle = null;
        applyStaticLabels(refs, state);
      });
      refs.wakeLock.innerHTML = `<i class="fas fa-check"></i> ${copyText('awake')}`;
      showToast(copyText('wakeLockEnabled'), 'success');
    } catch (error) {
      console.error('Wake lock request failed:', error);
      showToast(copyText('wakeLockUnavailable'), 'info');
    }
  }

  async function releaseWakeLock(refs, state, notify) {
    try {
      await state.keepAwakeHandle?.release?.();
    } catch (error) {
      console.error('Wake lock release failed:', error);
    }
    state.keepAwakeHandle = null;
    state.keepAwakeRequested = false;
    refs.wakeLock.innerHTML = `<i class="fas fa-mobile-screen"></i> ${copyText('keepAwake')}`;
    if (notify) {
      showToast(copyText('wakeLockDisabled'), 'info');
    }
  }

  function cleanupVoiceAndWakeLock(state) {
    try {
      state.recognition?.stop?.();
    } catch (error) {
      console.error('Recognition shutdown failed:', error);
    }
    window.speechSynthesis?.cancel?.();
    state.keepAwakeHandle?.release?.();
  }

  function loadAvailableVoices(state) {
    if (!window.speechSynthesis) {
      return;
    }

    state.voices = window.speechSynthesis.getVoices() || [];
  }

  function getPersona(state) {
    return PERSONAS[state.persona] || PERSONAS.calm;
  }

  function pickVoice(state, responseLanguage, text) {
    const voices = state.voices || [];
    if (!voices.length) {
      return null;
    }

    const persona = getPersona(state);
    const wantsHindi = responseLanguage === 'hi' || /[\u0900-\u097F]/.test(String(text || ''));
    const localeMatcher = wantsHindi
      ? voice => /^hi/i.test(voice.lang) || /^en-IN/i.test(voice.lang)
      : voice => /^en/i.test(voice.lang);
    const keywords = wantsHindi ? persona.keywords.hi : persona.keywords.en;

    const scored = voices
      .filter(localeMatcher)
      .map(voice => ({ voice, score: scoreVoice(voice, keywords, wantsHindi) }))
      .sort((left, right) => right.score - left.score);

    return scored[0]?.voice || voices[0];
  }

  function scoreVoice(voice, keywords, wantsHindi) {
    const name = `${voice.name} ${voice.lang}`.toLowerCase();
    let score = 0;

    if (wantsHindi && /^hi/i.test(voice.lang)) {
      score += 70;
    } else if (!wantsHindi && /^en-IN/i.test(voice.lang)) {
      score += 70;
    } else if (!wantsHindi && /^en/i.test(voice.lang)) {
      score += 50;
    }

    if (!voice.localService) {
      score += 8;
    }

    keywords.forEach((keyword, index) => {
      if (name.includes(keyword)) {
        score += 20 - index;
      }
    });

    if (/natural|neural|online/.test(name)) {
      score += 8;
    }

    return score;
  }

  function speakText(state, refs, text, options) {
    if (!('speechSynthesis' in window)) {
      showToast(copyText('speechUnsupported'), 'info');
      return Promise.resolve(false);
    }

    const configuration = options || {};
    const responseLanguage = configuration.responseLanguage || state.voiceLanguage;
    const persona = getPersona(state);
    const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalizedText) {
      return Promise.resolve(false);
    }

    const shouldResumeListening = configuration.pauseListening !== false && state.listening;
    if (shouldResumeListening) {
      stopListening(state, refs, false, true);
    }

    window.speechSynthesis.cancel();
    state.speaking = true;

    return new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(normalizedText);
      const selectedVoice = pickVoice(state, responseLanguage, normalizedText);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = responseLanguage === 'hi' ? 'hi-IN' : 'en-US';
      }

      utterance.rate = persona.rate;
      utterance.pitch = persona.pitch;
      utterance.volume = 1;
      utterance.onend = () => {
        state.speaking = false;
        if (shouldResumeListening) {
          startListening(state, refs, false);
        }
        resolve(true);
      };
      utterance.onerror = error => {
        console.error('Speech playback failed:', error);
        state.speaking = false;
        if (shouldResumeListening) {
          startListening(state, refs, false);
        }
        resolve(false);
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  function stopSpeaking(state) {
    if (!window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();
    state.speaking = false;
    showToast(copyText('stopVoiceToast'), 'info');
  }

  function speakCurrentStep(state, refs, withLeadIn) {
    const currentStepText = state.steps[state.currentStep] || copyText('noSteps');
    const message = withLeadIn
      ? copyText('recipeSpeakIntro', { step: state.currentStep + 1, text: currentStepText }, state.voiceLanguage)
      : currentStepText;

    return speakText(state, refs, message, { responseLanguage: state.voiceLanguage });
  }

  function speakIngredients(state, refs) {
    if (!state.ingredients.length) {
      showToast(copyText('ingredientsMissingSpeak'), 'info');
      return speakText(state, refs, copyText('ingredientsMissingSpeak', null, state.voiceLanguage), { responseLanguage: state.voiceLanguage });
    }

    const payload = state.ingredients.join('. ');
    return speakText(state, refs, copyText('speakIngredientsLabel', { items: payload }, state.voiceLanguage), { responseLanguage: state.voiceLanguage });
  }

  function speakTimerSummary(state, refs) {
    const activeTimers = state.timers.filter(timer => timer.status !== 'completed');
    if (!activeTimers.length) {
      showToast(copyText('timerSummaryEmpty'), 'info');
      return speakText(state, refs, copyText('timerSummaryEmpty', null, state.voiceLanguage), { responseLanguage: state.voiceLanguage });
    }

    const summary = activeTimers.map(timer => `${timer.label}: ${formatDuration(getRemainingMs(timer))}`).join('. ');
    return speakText(state, refs, copyText('speakTimersLabel', { items: summary }, state.voiceLanguage), { responseLanguage: state.voiceLanguage });
  }

  function ensureRecognition(state, refs) {
    if (state.recognition || !SPEECH_RECOGNITION) {
      return state.recognition;
    }

    const recognition = new SPEECH_RECOGNITION();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = getRecognitionLanguage(state);

    recognition.onresult = event => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript?.trim();
      if (!transcript) {
        return;
      }

      state.lastTranscript = copyText('heardCommand', { command: transcript });
      refs.voiceTranscript.textContent = state.lastTranscript;
      handleVoiceCommand(state, refs, transcript);
    };

    recognition.onerror = event => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopListening(state, refs, true);
        showToast(copyText('voiceUnsupported'), 'info');
        return;
      }

      setVoiceStatus(refs, state, copyText('commandNotRecognized'), false);
    };

    recognition.onend = () => {
      if (state.listening && !state.manuallyStoppedRecognition) {
        try {
          recognition.lang = getRecognitionLanguage(state);
          recognition.start();
          return;
        } catch (error) {
          console.error('Speech recognition restart failed:', error);
        }
      }

      state.listening = false;
      refs.toggleListening.innerHTML = `<i class="fas fa-microphone-lines"></i> ${translateShared('Start listening')}`;
      setVoiceStatus(refs, state, copyText('listeningOff'), false);
    };

    state.recognition = recognition;
    return recognition;
  }

  function getRecognitionLanguage(state) {
    return state.voiceLanguage === 'hi' ? 'hi-IN' : 'en-US';
  }

  function startListening(state, refs, manual) {
    const userTriggered = manual !== false;
    const recognition = ensureRecognition(state, refs);
    if (!recognition) {
      setVoiceStatus(refs, state, copyText('voiceUnsupported'), false);
      showToast(copyText('voiceUnsupported'), 'info');
      return;
    }

    try {
      state.manuallyStoppedRecognition = false;
      state.listening = true;
      recognition.lang = getRecognitionLanguage(state);
      recognition.start();
      refs.toggleListening.innerHTML = `<i class="fas fa-microphone-slash"></i> ${translateShared('Stop listening')}`;
      setVoiceStatus(refs, state, copyText('listeningOn'), true);
      if (userTriggered) {
        showToast(copyText('listeningOn'), 'success');
      }
    } catch (error) {
      if (!/already started/i.test(String(error.message || error))) {
        console.error('Speech recognition start failed:', error);
        showToast(copyText('voiceUnsupported'), 'info');
      }
    }
  }

  function stopListening(state, refs, manual, silent) {
    state.manuallyStoppedRecognition = manual !== false;
    state.listening = false;

    try {
      state.recognition?.stop?.();
    } catch (error) {
      console.error('Speech recognition stop failed:', error);
    }

    refs.toggleListening.innerHTML = `<i class="fas fa-microphone-lines"></i> ${translateShared('Start listening')}`;
    setVoiceStatus(refs, state, copyText('listeningOff'), false);
    if (!silent) {
      showToast(copyText('listeningOff'), 'info');
    }
  }

  function setVoiceStatus(refs, state, message, listening) {
    refs.voiceStatus.classList.toggle('is-listening', !!listening);
    refs.voiceStatus.classList.toggle('is-ready', !listening);
    refs.voiceStatusText.textContent = message;
    refs.voiceTranscript.textContent = state.lastTranscript || copyText('recentCommandEmpty');
  }

  function handleVoiceCommand(state, refs, transcript) {
    const command = normalizeCommand(transcript);
    if (!command) {
      return;
    }

    if (matchesAny(command, ['help', 'commands', 'मदद', 'सहायता'])) {
      speakText(state, refs, copyText('helpResponse', null, state.voiceLanguage), { responseLanguage: state.voiceLanguage });
      return;
    }

    if (matchesAny(command, ['stop listening', 'stop command', 'सुनना बंद', 'कमांड बंद'])) {
      stopListening(state, refs, true);
      return;
    }

    if (matchesAny(command, ['stop voice', 'stop speaking', 'चुप', 'रुको'])) {
      stopSpeaking(state);
      return;
    }

    const requestedStep = extractStepNumber(command);
    if (requestedStep && matchesAny(command, ['step', 'स्टेप'])) {
      goToStep(state, refs, requestedStep - 1, true);
      showToast(copyText('movedToStep', { step: requestedStep }), 'success');
      return;
    }

    if (matchesAny(command, ['next', 'aagla', 'agla', 'aage', 'आगे', 'अगला'])) {
      goToStep(state, refs, state.currentStep + 1, true);
      return;
    }

    if (matchesAny(command, ['previous', 'back', 'pichla', 'pichha', 'peche', 'peeche', 'पिछला', 'पीछे'])) {
      goToStep(state, refs, state.currentStep - 1, true);
      return;
    }

    if (matchesAny(command, ['repeat', 'again', 'dobara', 'दोबारा'])) {
      speakCurrentStep(state, refs, true);
      return;
    }

    if (matchesAny(command, ['ingredient', 'ingredients', 'सामग्री'])) {
      speakIngredients(state, refs);
      return;
    }

    if (matchesAny(command, ['timer status', 'timer ka status batao', 'active timers', 'how many timers', 'टाइमर स्टेटस', 'टाइमर का स्टेटस बताओ'])) {
      speakTimerSummary(state, refs);
      return;
    }

    if (matchesAny(command, ['pause', 'roko timer', 'timer rok', 'टाइमर रोक', 'रोक दो'])) {
      const timerIndex = resolveTimerIndexFromCommand(state, command);
      if (timerIndex === -1) {
        showToast(copyText('timerResolvedNone'), 'info');
        return;
      }
      pauseTimer(state, refs, timerIndex);
      return;
    }

    if (matchesAny(command, ['resume timer', 'continue timer', 'dobara shuru karo timer', 'timer dobara shuru karo', 'टाइमर फिर शुरू', 'टाइमर चालू'])) {
      const timerIndex = resolveTimerIndexFromCommand(state, command);
      if (timerIndex === -1) {
        showToast(copyText('timerResolvedNone'), 'info');
        return;
      }
      resumeTimer(state, refs, timerIndex);
      return;
    }

    if (matchesAny(command, ['reset timer', 'timer reset karo', 'restart timer', 'टाइमर रीसेट', 'रीसेट करो'])) {
      const timerIndex = resolveTimerIndexFromCommand(state, command);
      if (timerIndex === -1) {
        showToast(copyText('timerResolvedNone'), 'info');
        return;
      }
      resetTimer(state, refs, timerIndex);
      return;
    }

    if (matchesAny(command, ['remove timer', 'delete timer', 'टाइमर हटाओ'])) {
      const timerIndex = resolveTimerIndexFromCommand(state, command);
      if (timerIndex === -1) {
        showToast(copyText('timerResolvedNone'), 'info');
        return;
      }
      removeTimer(state, refs, timerIndex);
      return;
    }

    if (matchesAny(command, ['start timer', 'set timer', 'timer start', 'timer start karo', 'timer start karo 10 min ke liye', 'टाइमर शुरू', 'टाइमर सेट'])) {
      const minutes = extractMinutesFromCommand(command) || Number(refs.timerMinutes.value || 10);
      createTimer(state, refs, currentUiLanguage() === 'hi' ? `स्टेप ${state.currentStep + 1} टाइमर` : `Step ${state.currentStep + 1} timer`, minutes);
      return;
    }

    showToast(copyText('commandNotRecognized'), 'info');
    setVoiceStatus(refs, state, copyText('commandNotRecognized'), false);
  }

  function resolveTimerIndexFromCommand(state, command) {
    if (!state.timers.length) {
      return -1;
    }

    const spokenIndex = extractStepNumber(command);
    if (spokenIndex && state.timers[spokenIndex - 1]) {
      return spokenIndex - 1;
    }

    const runningIndex = state.timers.findIndex(timer => timer.status === 'running');
    if (runningIndex >= 0) {
      return runningIndex;
    }

    return state.timers.length ? 0 : -1;
  }

  function normalizeCommand(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchesAny(text, patterns) {
    return patterns.some(pattern => text.includes(pattern));
  }

  function extractStepNumber(text) {
    const numericMatch = String(text).match(/\b(\d+)\b/);
    if (numericMatch) {
      return Number(numericMatch[1]);
    }

    return extractNumberWordValue(text);
  }

  function extractMinutesFromCommand(text) {
    const numericMatch = String(text).match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|minute|minutes|min|mins|घंटा|घंटे|मिनट)/i);
    if (numericMatch) {
      const value = Number(numericMatch[1]);
      const unit = numericMatch[2].toLowerCase();
      return unit.includes('hour') || unit.includes('hr') || unit.includes('घंट') ? Math.round(value * 60) : Math.round(value);
    }

    const numberFromWords = extractNumberWordValue(text);
    if (numberFromWords != null) {
      return /hour|hr|घंट/.test(text) ? Math.round(numberFromWords * 60) : Math.max(Math.round(numberFromWords), 1);
    }

    return null;
  }

  function extractNumberWordValue(text) {
    const normalized = normalizeCommand(text);
    const words = normalized.split(' ');
    for (let index = 0; index < words.length; index += 1) {
      const current = words[index];
      const next = words[index + 1];
      const combined = next ? `${current} ${next}` : current;

      if (Object.prototype.hasOwnProperty.call(ENGLISH_NUMBER_WORDS, combined)) return ENGLISH_NUMBER_WORDS[combined];
      if (Object.prototype.hasOwnProperty.call(HINDI_NUMBER_WORDS, combined)) return HINDI_NUMBER_WORDS[combined];
      if (Object.prototype.hasOwnProperty.call(LATINIZED_HINDI_NUMBERS, combined)) return LATINIZED_HINDI_NUMBERS[combined];
      if (Object.prototype.hasOwnProperty.call(ENGLISH_NUMBER_WORDS, current)) return ENGLISH_NUMBER_WORDS[current];
      if (Object.prototype.hasOwnProperty.call(HINDI_NUMBER_WORDS, current)) return HINDI_NUMBER_WORDS[current];
      if (Object.prototype.hasOwnProperty.call(LATINIZED_HINDI_NUMBERS, current)) return LATINIZED_HINDI_NUMBERS[current];
    }

    return null;
  }

  function extractIngredients(recipe, normalized) {
    const combinedFromPairs = buildIngredientPairs(recipe.ingredients_name, recipe.ingredients_quantity);
    const candidates = [
      normalized?.ingredients,
      recipe.ingredients,
      recipe.ingredientLines,
      recipe.ingredients_list,
      recipe.ingredientsList,
      recipe.extendedIngredients,
      recipe.components?.flatMap(component => component.ingredients || []),
      recipe.recipeIngredient,
      recipe.raw_ingredients,
      combinedFromPairs
    ];

    for (const candidate of candidates) {
      const parsed = normalizeIngredientList(candidate);
      if (parsed.length) {
        return parsed;
      }
    }

    return [];
  }

  function buildIngredientPairs(namesValue, quantitiesValue) {
    if (!namesValue || !quantitiesValue) {
      return [];
    }

    const names = String(namesValue).split(/\s{2,}|\n/).map(item => item.trim()).filter(Boolean);
    const quantities = String(quantitiesValue).split(/\s{2,}|\n/).map(item => item.trim()).filter(Boolean);
    return names.map((name, index) => quantities[index] ? `${quantities[index]} ${name}` : name);
  }

  function normalizeIngredientList(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap(item => {
        if (!item) return [];
        if (typeof item === 'string') return parseList(item);
        if (typeof item === 'object') {
          const quantity = [item.quantity, item.amount, item.metricQuantity, item.usQuantity].filter(Boolean).join(' ');
          const descriptor = item.text || item.original || item.originalString || item.name || item.ingredient || item.description;
          return parseList([quantity, descriptor].filter(Boolean).join(' ').trim());
        }
        return parseList(String(item));
      });
    }

    if (typeof value === 'object') {
      if (Array.isArray(value.ingredients)) return normalizeIngredientList(value.ingredients);
      if (Array.isArray(value.items)) return normalizeIngredientList(value.items);
      return normalizeIngredientList(Object.values(value));
    }

    return parseList(value);
  }

  function extractSteps(recipe, normalized) {
    const candidates = [
      normalized?.directions,
      normalized?.cooking_method,
      recipe.instructions,
      recipe.steps,
      recipe.method,
      recipe.directions,
      recipe.analyzedInstructions,
      recipe.preparation,
      recipe.recipeInstructions,
      recipe.instructions_list,
      recipe.cooking_method
    ];

    for (const candidate of candidates) {
      const parsed = normalizeStepList(candidate);
      if (parsed.length) {
        return parsed;
      }
    }

    return [];
  }

  function normalizeStepList(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap(item => {
        if (typeof item === 'string') return parseList(item);
        if (item && typeof item === 'object') {
          if (Array.isArray(item.steps)) return normalizeStepList(item.steps);
          return parseList(item.text || item.description || item.step || item.instruction || item.direction || item.name);
        }
        return [];
      });
    }

    if (typeof value === 'object') {
      return normalizeStepList(Object.values(value));
    }

    return parseList(value);
  }

  function parseList(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap(item => parseList(item));
    }

    const text = String(value).trim();
    if (!text) {
      return [];
    }

    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        return JSON.parse(text.replace(/'/g, '"')).flatMap(item => parseList(item));
      } catch (error) {
        console.error('Failed to parse embedded list:', error);
      }
    }

    return text
      .split(/\r?\n|[•●▪]|(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(item => item.trim().replace(/^\d+[\).:-]\s*/, ''))
      .filter(Boolean);
  }

  function dedupeItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = String(item).toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function extractStepTimerHints(stepText) {
    const hints = [];
    const matcher = /\b(bake|rest|simmer|boil|steam|roast|cook|proof|chill|freeze|marinate)?[^.]*?(\d+)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/gi;
    let match;

    while ((match = matcher.exec(String(stepText || '')))) {
      const unit = match[3].toLowerCase();
      const value = Number(match[2]);
      const minutes = unit.includes('hour') || unit.includes('hr') ? value * 60 : value;
      hints.push({
        label: match[1] ? `${match[1]} timer` : copyText('timerHintFallback'),
        minutes: Math.max(minutes, 1)
      });
    }

    return hints;
  }

  function truncateText(text, limit) {
    const value = String(text || '');
    return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateId() {
    return window.crypto?.randomUUID?.() || `timer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const ENGLISH_NUMBER_WORDS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90
  };

  const HINDI_NUMBER_WORDS = {
    'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9,
    'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17, 'अठारह': 18,
    'उन्नीस': 19, 'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50, 'साठ': 60, 'आधा': 0.5
  };

  const LATINIZED_HINDI_NUMBERS = {
    ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9,
    das: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, bees: 20, tees: 30, chalis: 40,
    pachaas: 50, saath: 60, aadha: 0.5
  };
})();
