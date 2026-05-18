(function () {
  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80';
  const FILTERS = [
    { key: 'all', label: 'All vault picks' },
    { key: 'video', label: 'Video-led' },
    { key: 'quick', label: 'Quick cook' },
    { key: 'vegetarian', label: 'Vegetarian' },
    { key: 'dessert', label: 'Desserts' }
  ];

  const CUISINES = ['', 'Italian', 'Indian', 'Chinese', 'Mexican', 'Japanese', 'Mediterranean', 'Thai'];

  let state = {
    currentPage: 0,
    currentLimit: 36,
    currentFilter: 'all',
    currentCuisine: '',
    searchTerm: '',
    hasMoreRecipes: true
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTitle(recipe) {
    return recipe.name || recipe.recipe_name || recipe.title || 'Untitled Recipe';
  }

  function getImage(recipe) {
    return recipe.image || recipe.image_url || recipe.thumbnail_url || recipe.photo || FALLBACK_IMAGE;
  }

  function getSummary(recipe) {
    return recipe.description || recipe.summary || recipe.subtitle || 'Adaptive recipe card powered by MH Horizon.';
  }

  function getMeta(recipe) {
    return [
      recipe.cuisine,
      recipe.course || recipe.category || recipe.subcategory,
      recipe.servings || recipe.serves,
      recipe.prep_time || recipe.time
    ].filter(Boolean).slice(0, 4);
  }

  function hasVideo(recipe) {
    return Boolean(recipe.video_url || recipe.video || recipe.youtube_url || recipe.youtube || recipe.videoLink);
  }

  function appMarkup() {
    const plannerReturn = sessionStorage.getItem('mealPlannerReturnDate');

    return `
      ${plannerReturn ? `
        <div class="planner-return panel">
          <div>
            <strong>Planner handoff is active</strong>
            <p class="library-message">Pick a recipe and send it straight back into your meal plan for ${escapeHtml(plannerReturn)}.</p>
          </div>
          <a class="btn btn-outline" href="meal-planner.html"><i class="fas fa-arrow-left"></i> Back to planner</a>
        </div>
      ` : ''}

      <section class="panel search-panel">
        <div class="search-row">
          <input id="library-search" class="form-control" type="search" placeholder="Search by dish, cuisine, ingredient, or cooking style">
          <button id="library-search-btn" class="btn btn-primary" type="button"><i class="fas fa-search"></i> Search</button>
        </div>
        <div class="filter-bar" id="library-filters">
          ${FILTERS.map(filter => `<button class="filter-pill${filter.key === state.currentFilter ? ' active' : ''}" type="button" data-filter="${filter.key}">${filter.label}</button>`).join('')}
        </div>
      </section>

      <section class="library-layout">
        <div class="library-results">
          <article class="panel">
            <div class="panel-body">
              <div class="section-heading">
                <div>
                  <span class="hero-kicker-inline"><i class="fas fa-star"></i> Discovery feed</span>
                  <h2>Recipe vault</h2>
                </div>
                <p class="library-message" id="library-message">Exploring the full RecipifyHub recipe vault.</p>
              </div>
              <div id="recipe-grid" class="recipe-grid"></div>
              <div class="action-row" style="justify-content:center;">
                <button id="load-more-btn" class="btn btn-outline" type="button">Load more recipes</button>
              </div>
            </div>
          </article>
        </div>

        <aside class="library-side">
          <article class="panel filter-panel">
            <div class="panel-body">
              <div>
                <span class="hero-kicker-inline"><i class="fas fa-sliders"></i> Refine</span>
                <h2>Recipe filters</h2>
              </div>
              <select id="cuisine-filter" class="form-control">
                ${CUISINES.map(cuisine => `<option value="${cuisine}">${cuisine || 'All cuisines'}</option>`).join('')}
              </select>
              <button id="clear-filters-btn" class="btn btn-ghost" type="button"><i class="fas fa-rotate-left"></i> Reset view</button>
            </div>
          </article>

          <article class="panel filter-panel">
            <div class="panel-body">
              <div>
                <span class="hero-kicker-inline"><i class="fas fa-chart-line"></i> At a glance</span>
                <h2>Library snapshot</h2>
              </div>
              <div class="stat-grid">
                <div class="stat-card"><span>Recipe feed</span><strong>Live</strong></div>
                <div class="stat-card"><span>Current mode</span><strong id="mode-label">Vault</strong></div>
                <div class="stat-card"><span>Cuisine lens</span><strong id="cuisine-label">Any</strong></div>
              </div>
            </div>
          </article>
        </aside>
      </section>
    `;
  }

  function buildQueryAcrossCollections(query) {
    const collections = window.RecipifyDB.getRecipeCollections();
    const perCollection = Math.ceil(state.currentLimit / collections.length);
    return Promise.all(collections.map(collection => window.RecipifyDB.fetchRecipes(collection, query, perCollection, 0)));
  }

  async function loadFilteredRecipes() {
    if (state.searchTerm) {
      return window.RecipifyDB.searchAllRecipes(state.searchTerm, state.currentLimit, state.currentPage * state.currentLimit);
    }

    if (state.currentCuisine) {
      return window.RecipifyDB.getRecipesByCuisine(state.currentCuisine, state.currentLimit, state.currentPage * state.currentLimit);
    }

    if (state.currentFilter === 'video') {
      return window.RecipifyDB.getVideoRecipes(state.currentLimit);
    }

    if (state.currentFilter === 'quick') {
      const results = await buildQueryAcrossCollections({
        $or: [
          { prep_time: { $regex: 'minutes', $options: 'i' } },
          { prep_time: { $regex: '\\b([0-9]|1[0-9]|2[0-9]|30)\\s', $options: 'i' } }
        ]
      });
      const data = results.flatMap(result => result.success && result.data ? result.data : []);
      return { success: true, data, metadata: { hasMore: false } };
    }

    if (state.currentFilter === 'vegetarian') {
      const results = await buildQueryAcrossCollections({
        $or: [
          { diet: { $regex: 'vegetarian', $options: 'i' } },
          { tags: { $regex: 'vegetarian', $options: 'i' } },
          { category: { $regex: 'vegetarian', $options: 'i' } }
        ]
      });
      const data = results.flatMap(result => result.success && result.data ? result.data : []);
      return { success: true, data, metadata: { hasMore: false } };
    }

    if (state.currentFilter === 'dessert') {
      const results = await buildQueryAcrossCollections({
        $or: [
          { subcategory: { $regex: 'cake|dessert|sweet', $options: 'i' } },
          { category: { $regex: 'dessert|sweet|cake', $options: 'i' } },
          { tags: { $regex: 'dessert|sweet|cake', $options: 'i' } },
          { name: { $regex: 'cake|pie|cookie|dessert|sweet', $options: 'i' } }
        ]
      });
      const data = results.flatMap(result => result.success && result.data ? result.data : []);
      return { success: true, data, metadata: { hasMore: false } };
    }

    return window.RecipifyDB.getFeaturedRecipes(state.currentLimit, state.currentPage * state.currentLimit);
  }

  function updateMessage() {
    const message = document.getElementById('library-message');
    const modeLabel = document.getElementById('mode-label');
    const cuisineLabel = document.getElementById('cuisine-label');

    if (state.searchTerm) {
      message.textContent = `Search results for "${state.searchTerm}" across the full recipe vault.`;
      modeLabel.textContent = 'Search';
    } else if (state.currentCuisine) {
      message.textContent = `Browsing ${state.currentCuisine} recipes across the RecipifyHub vault.`;
      modeLabel.textContent = 'Cuisine';
    } else {
      const activeFilter = FILTERS.find(filter => filter.key === state.currentFilter);
      message.textContent = activeFilter && activeFilter.key !== 'all'
        ? `${activeFilter.label} recipes curated for quick discovery.`
        : 'Exploring the full RecipifyHub recipe vault.';
      modeLabel.textContent = activeFilter ? activeFilter.label : 'Vault';
    }

    cuisineLabel.textContent = state.currentCuisine || 'Any';
  }

  function normalizeRecipe(recipe) {
    if (recipe.source_collection) {
      return recipe;
    }

    return window.RecipifyDB.normalizeRecipeData(
      recipe,
      recipe.collection || (state.currentFilter === 'video' ? 'recipe_with_video' : 'recipes')
    );
  }

  function plannerAction(recipe) {
    if (!sessionStorage.getItem('mealPlannerReturnDate')) {
      return '';
    }

    return `
      <button class="btn btn-outline" type="button" data-plan-id="${escapeHtml(recipe.id || recipe._id)}" data-plan-collection="${escapeHtml(recipe.source_collection)}">
        <i class="fas fa-calendar-plus"></i> Add to planner
      </button>
    `;
  }

  function createCard(recipe) {
    const title = getTitle(recipe);
    const summary = getSummary(recipe);
    const image = getImage(recipe);
    const meta = getMeta(recipe);

    return `
      <article class="panel library-card">
        <div class="card-visual">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
          ${hasVideo(recipe) ? `
            <div class="card-badges">
              <span class="collection-chip"><i class="fas fa-circle-play"></i>Video recipe</span>
            </div>
          ` : ''}
        </div>
        <div class="panel-body">
          <div class="cluster-wrap">
            ${meta.map(item => `<span class="recipe-chip">${escapeHtml(item)}</span>`).join('')}
          </div>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="card-summary">${escapeHtml(summary)}</p>
          </div>
          <div class="card-actions">
            <a class="btn btn-primary" href="recipe.html?id=${encodeURIComponent(recipe.id || recipe._id)}&collection=${encodeURIComponent(recipe.source_collection)}">
              <i class="fas fa-eye"></i> View Recipe
            </a>
            ${plannerAction(recipe)}
          </div>
        </div>
      </article>
    `;
  }

  function attachCardActions(recipes) {
    document.querySelectorAll('[data-plan-id]').forEach(button => {
      button.addEventListener('click', () => {
        const recipe = recipes.find(item => String(item.id || item._id) === button.dataset.planId);
        if (!recipe) return;

        sessionStorage.setItem('mealPlannerRecipe', JSON.stringify({
          id: String(recipe.id || recipe._id),
          _id: String(recipe.id || recipe._id),
          title: getTitle(recipe),
          name: getTitle(recipe),
          collection: recipe.source_collection,
          image: getImage(recipe),
          date: sessionStorage.getItem('mealPlannerReturnDate'),
          mealType: sessionStorage.getItem('mealPlannerMealType') || 'dinner'
        }));

        window.location.href = 'meal-planner.html';
      });
    });
  }

  async function renderRecipes(reset) {
    const recipeGrid = document.getElementById('recipe-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (reset) {
      recipeGrid.innerHTML = `
        <div class="loading-state">
          <div class="status-spinner"></div>
          <div>
            <h2>Refreshing the vault</h2>
            <p>Loading premium recipe cards for your discovery feed.</p>
          </div>
        </div>
      `;
    }

    loadMoreBtn.disabled = true;
    updateMessage();

    try {
      const result = await loadFilteredRecipes();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'Unable to load recipes');
      }

      const recipes = result.data.map(normalizeRecipe);
      state.hasMoreRecipes = !!result.metadata?.hasMore;
      loadMoreBtn.style.display = state.hasMoreRecipes ? 'inline-flex' : 'none';

      if (!recipes.length && reset) {
        recipeGrid.innerHTML = `
          <div class="empty-grid">
            <div>
              <h2>No recipes matched this view</h2>
              <p>Try another filter, cuisine, or search phrase.</p>
            </div>
          </div>
        `;
        return;
      }

      const markup = recipes.map(createCard).join('');
      if (reset) {
        recipeGrid.innerHTML = markup;
      } else {
        recipeGrid.insertAdjacentHTML('beforeend', markup);
      }

      attachCardActions(recipes);
    } catch (error) {
      console.error('Library load error:', error);
      recipeGrid.innerHTML = `
        <div class="error-grid">
          <div>
            <h2>We could not load the recipe vault</h2>
            <p>${escapeHtml(error.message || 'Please try again in a moment.')}</p>
          </div>
        </div>
      `;
      loadMoreBtn.style.display = 'none';
    } finally {
      loadMoreBtn.disabled = false;
    }
  }

  function resetAndRender() {
    state.currentPage = 0;
    state.hasMoreRecipes = true;
    renderRecipes(true);
  }

  async function init() {
    await window.RecipifyComponents.initComponents();
    document.getElementById('library-app').innerHTML = appMarkup();

    const params = new URLSearchParams(window.location.search);
    state.searchTerm = params.get('search') || '';
    state.currentFilter = params.get('filter') || 'all';

    const searchInput = document.getElementById('library-search');
    const searchButton = document.getElementById('library-search-btn');
    const cuisineFilter = document.getElementById('cuisine-filter');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    searchInput.value = state.searchTerm;

    document.querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        state.currentFilter = button.dataset.filter;
        state.searchTerm = '';
        searchInput.value = '';
        resetAndRender();
      });
    });

    searchButton.addEventListener('click', () => {
      state.searchTerm = searchInput.value.trim();
      resetAndRender();
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        state.searchTerm = searchInput.value.trim();
        resetAndRender();
      }
    });

    cuisineFilter.addEventListener('change', () => {
      state.currentCuisine = cuisineFilter.value;
      resetAndRender();
    });

    clearFiltersBtn.addEventListener('click', () => {
      state = { ...state, currentPage: 0, currentFilter: 'all', currentCuisine: '', searchTerm: '', hasMoreRecipes: true };
      searchInput.value = '';
      cuisineFilter.value = '';
      document.querySelectorAll('[data-filter]').forEach(item => {
        item.classList.toggle('active', item.dataset.filter === 'all');
      });
      renderRecipes(true);
    });

    loadMoreBtn.addEventListener('click', () => {
      state.currentPage += 1;
      renderRecipes(false);
    });

    renderRecipes(true);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
