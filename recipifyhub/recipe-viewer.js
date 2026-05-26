(function () {
  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
  const HIGHLIGHT_SKIP = new Set([
    '_id', 'id', '__v', 'name', 'title', 'recipe_name', 'recipe_title', 'label',
    'description', 'summary', 'subtitle', 'intro', 'story', 'overview',
    'image', 'image_url', 'thumbnail_url', 'photo', 'photo_url', 'thumb', 'images', 'gallery',
    'ingredients', 'ingredient', 'ingredientLines', 'ingredient_lines', 'ingredients_name', 'ingredients_quantity',
    'instructions', 'instruction', 'directions', 'direction', 'steps', 'method', 'methods',
    'preparation', 'procedure', 'how_to_make', 'recipe_directions',
    'nutrition', 'nutrients', 'nutrition_facts', 'macros',
    'source_collection', 'video_url', 'youtube_url', 'video', 'url', 'link', 'source_url', 'recipe_url'
  ]);

  const qs = (selector) => document.querySelector(selector);
  const app = () => document.getElementById('recipe-app');
  const viewerState = {
    recipe: null,
    metricsResult: null,
    ratingsResult: null,
    saved: false
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isPresent(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }

  function firstPresent() {
    return Array.from(arguments).find(isPresent);
  }

  function humanize(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  function parseLooseJson(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) return null;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      try {
        return JSON.parse(trimmed.replace(/'/g, '"'));
      } catch (innerError) {
        return null;
      }
    }
  }

  function objectToLine(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const main = firstPresent(value.text, value.name, value.label, value.value, value.description, value.ingredient, value.step, value.direction);
    const quantity = [value.quantity, value.qty, value.amount, value.unit].filter(isPresent).map((part) => String(part).trim()).join(' ');
    if (main && quantity) return `${quantity} ${String(main).trim()}`.trim();
    if (main) return String(main).trim();
    return Object.entries(value)
      .filter(([, innerValue]) => isPresent(innerValue) && typeof innerValue !== 'object')
      .slice(0, 5)
      .map(([key, innerValue]) => `${humanize(key)}: ${String(innerValue).trim()}`)
      .join(' | ');
  }

  function asText(value) {
    if (!isPresent(value)) return '';
    if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ');
    if (typeof value === 'object') return objectToLine(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value).trim();
  }

  function splitList(value, mode) {
    if (!isPresent(value)) return [];
    if (Array.isArray(value)) return value.flatMap((item) => splitList(item, mode));
    if (typeof value === 'object') {
      const line = objectToLine(value);
      return line ? [line] : Object.values(value).flatMap((item) => splitList(item, mode));
    }
    if (typeof value !== 'string') return [String(value)];

    const parsed = parseLooseJson(value);
    if (parsed) return splitList(parsed, mode);

    const trimmed = value.trim();
    if (!trimmed) return [];

    const parts = mode === 'steps'
      ? (trimmed.includes('\n') ? trimmed.split(/\r?\n+/) : trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
      : trimmed.split(/\r?\n+|[|]/);

    return parts
      .map((item) => item.replace(/^[\-*.\d)\s]+/, '').trim())
      .filter(Boolean);
  }

  function uniqueLines(lines) {
    const seen = new Set();
    return lines.filter((line) => {
      const normalized = line.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function getTitle(recipe) {
    return firstPresent(recipe.name, recipe.title, recipe.recipe_name, recipe.recipe_title, recipe.label, recipe.slug) || 'Untitled Recipe';
  }

  function getDescription(recipe) {
    const value = firstPresent(recipe.description, recipe.summary, recipe.subtitle, recipe.intro, recipe.story, recipe.notes, recipe.overview);
    return value ? String(value).trim() : 'This recipe is ready to explore with RecipifyHub and MH Horizon.';
  }

  function getImage(recipe) {
    const choice = firstPresent(
      recipe.image, recipe.image_url, recipe.thumbnail_url, recipe.photo, recipe.photo_url, recipe.thumb,
      Array.isArray(recipe.images) ? recipe.images[0] : null,
      Array.isArray(recipe.gallery) ? recipe.gallery[0] : null
    );
    if (typeof choice === 'string' && choice.trim()) return choice;
    if (choice && typeof choice === 'object') return firstPresent(choice.url, choice.src) || FALLBACK_IMAGE;
    return FALLBACK_IMAGE;
  }

  function getVideoUrl(recipe) {
    return firstPresent(recipe.video_url, recipe.video, recipe.youtube_url, recipe.youtube, recipe.videoLink) || '';
  }

  function getSourceUrl(recipe) {
    return firstPresent(recipe.source_url, recipe.recipe_url, recipe.url, recipe.link, recipe.source) || '';
  }

  function getVideoAsset(videoUrl) {
    if (!isPresent(videoUrl)) return null;

    try {
      const parsed = new URL(String(videoUrl).trim(), window.location.href);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      const pathParts = parsed.pathname.split('/').filter(Boolean);

      if (host === 'youtu.be') {
        const id = pathParts[0];
        if (id) {
          return {
            type: 'iframe',
            src: `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`,
            title: 'Recipe video player'
          };
        }
      }

      if (host.includes('youtube.com')) {
        const id = parsed.searchParams.get('v')
          || pathParts[pathParts.indexOf('embed') + 1]
          || pathParts[pathParts.indexOf('shorts') + 1]
          || pathParts[pathParts.indexOf('live') + 1];
        if (id) {
          return {
            type: 'iframe',
            src: `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`,
            title: 'Recipe video player'
          };
        }
      }

      if (host.includes('vimeo.com')) {
        const id = [...pathParts].reverse().find((part) => /^\d+$/.test(part));
        if (id) {
          return {
            type: 'iframe',
            src: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
            title: 'Recipe video player'
          };
        }
      }

      if (/\.(mp4|webm|ogg|m4v)$/i.test(parsed.pathname)) {
        return {
          type: 'video',
          src: parsed.href,
          title: 'Recipe video player'
        };
      }

      return {
        type: 'iframe',
        src: parsed.href,
        title: 'Recipe video player'
      };
    } catch (error) {
      console.error('Unable to normalize recipe video URL:', error);
      return null;
    }
  }

  function renderVideoPlayer(videoAsset, title) {
    if (!videoAsset) return '';

    if (videoAsset.type === 'video') {
      return `
        <div class="video-shell">
          <video controls preload="metadata" playsinline>
            <source src="${escapeHtml(videoAsset.src)}">
            Your browser does not support embedded video playback.
          </video>
        </div>
      `;
    }

    return `
      <div class="video-shell">
        <iframe
          src="${escapeHtml(videoAsset.src)}"
          title="${escapeHtml(title)} video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen>
        </iframe>
      </div>
    `;
  }

  function pairIngredientFields(recipe) {
    if (!isPresent(recipe.ingredients_name) || !isPresent(recipe.ingredients_quantity)) return [];
    const names = splitList(recipe.ingredients_name);
    const quantities = splitList(recipe.ingredients_quantity);
    return names.map((name, index) => [quantities[index], name].filter(Boolean).join(' ').trim()).filter(Boolean);
  }

  function collectIngredients(recipe) {
    let lines = pairIngredientFields(recipe);
    [
      recipe.ingredients,
      recipe.ingredientLines,
      recipe.ingredient_lines,
      recipe.ingredient_list,
      recipe.ingredients_list,
      recipe.components,
      recipe.shopping_list
    ].forEach((candidate) => {
      lines = lines.concat(splitList(candidate));
    });

    Object.entries(recipe).forEach(([key, value]) => {
      const normalized = key.toLowerCase();
      if (normalized.includes('ingredient') && !normalized.includes('image')) {
        lines = lines.concat(splitList(value));
      }
    });

    return uniqueLines(lines).slice(0, 160);
  }

  function collectSteps(recipe) {
    let lines = [];
    [
      recipe.instructions,
      recipe.instruction,
      recipe.directions,
      recipe.direction,
      recipe.steps,
      recipe.method,
      recipe.methods,
      recipe.procedure,
      recipe.preparation,
      recipe.how_to_make,
      recipe.recipe_directions
    ].forEach((candidate) => {
      lines = lines.concat(splitList(candidate, 'steps'));
    });

    Object.entries(recipe).forEach(([key, value]) => {
      const normalized = key.toLowerCase();
      if (normalized.includes('instruction') || normalized.includes('direction') || normalized.includes('method') || normalized.includes('step')) {
        lines = lines.concat(splitList(value, 'steps'));
      }
    });

    return uniqueLines(lines).slice(0, 160);
  }

  function normalizeNutritionKey(key) {
    const map = {
      calories: 'Calories',
      calorie: 'Calories',
      protein: 'Protein',
      proteins: 'Protein',
      carbohydrates: 'Carbs',
      carbohydrate: 'Carbs',
      carbs: 'Carbs',
      fat: 'Fat',
      fiber: 'Fiber',
      sugar: 'Sugar',
      sodium: 'Sodium',
      cholesterol: 'Cholesterol',
      iron: 'Iron',
      calcium: 'Calcium',
      potassium: 'Potassium'
    };
    return map[String(key).toLowerCase()] || humanize(key);
  }

  function collectNutrition(recipe) {
    const nutrition = {};
    const add = (key, value) => {
      if (!isPresent(value)) return;
      const label = normalizeNutritionKey(key);
      if (!nutrition[label]) nutrition[label] = asText(value);
    };

    [recipe.nutrients, recipe.nutrition, recipe.nutrition_facts, recipe.macros].forEach((block) => {
      if (block && typeof block === 'object' && !Array.isArray(block)) {
        Object.entries(block).forEach(([key, value]) => add(key, value));
      }
    });

    ['calories', 'protein', 'carbohydrates', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'cholesterol', 'iron', 'calcium', 'potassium']
      .forEach((key) => add(key, recipe[key]));

    return nutrition;
  }

  function collectTags(recipe) {
    let lines = [];
    [recipe.tags, recipe.tag, recipe.cuisine, recipe.category, recipe.diet, recipe.course, recipe.subcategory, recipe.dish_type, recipe.occasion]
      .forEach((value) => {
        lines = lines.concat(splitList(value));
      });
    return uniqueLines(lines).slice(0, 14);
  }

  function getMeta(recipe, ingredients, steps) {
    return [
      ['Servings', firstPresent(recipe.servings, recipe.serves, recipe.yield)],
      ['Prep Time', firstPresent(recipe.prep_time, recipe['prep_time (in mins)'])],
      ['Cook Time', firstPresent(recipe.cook_time, recipe['cook_time (in mins)'])],
      ['Total Time', firstPresent(recipe.total_time, recipe.time)],
      ['Difficulty', firstPresent(recipe.difficulty, recipe.difficult)],
      ['Cuisine', recipe.cuisine],
      ['Course', firstPresent(recipe.course, recipe.category, recipe.subcategory)],
      ['Ingredients', ingredients.length ? `${ingredients.length} items` : ''],
      ['Steps', steps.length ? `${steps.length} steps` : '']
    ].filter((item) => isPresent(item[1]));
  }

  function getHighlights(recipe) {
    const cards = [];

    Object.entries(recipe).forEach(([key, value]) => {
      const normalized = key.toLowerCase();
      if (cards.length >= 14 || !isPresent(value) || HIGHLIGHT_SKIP.has(key) || HIGHLIGHT_SKIP.has(normalized)) return;

      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          const summary = value.slice(0, 4).map(asText).filter(Boolean).join(', ');
          if (summary) cards.push([humanize(key), summary]);
        } else {
          const summary = Object.entries(value)
            .filter(([, innerValue]) => typeof innerValue !== 'object' && isPresent(innerValue))
            .slice(0, 4)
            .map(([innerKey, innerValue]) => `${humanize(innerKey)}: ${asText(innerValue)}`)
            .join(' | ');
          if (summary) cards.push([humanize(key), summary]);
        }
        return;
      }

      cards.push([humanize(key), asText(value)]);
    });

    return cards;
  }

  function metricMarkup(label, value) {
    return `<article class="metric-panel"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
  }

  function showFeedback(message) {
    const feedback = document.getElementById('viewer-feedback');
    if (feedback) feedback.textContent = message;
  }

  async function toggleSave(button, recipe) {
    const auth = await window.RecipifyDB.checkAuth();
    if (!auth.isAuthenticated) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      window.location.href = 'login';
      return;
    }

    const saved = button.dataset.saved === 'true';
    const recipeId = String(recipe.id || recipe._id);
    button.disabled = true;

    try {
      const result = saved
        ? await window.RecipifyDB.unsaveRecipe(recipeId, recipe.source_collection)
        : await window.RecipifyDB.saveRecipe(recipeId, recipe.source_collection);

      if (result.success) {
        button.dataset.saved = String(!saved);
        button.innerHTML = saved
          ? '<i class="fas fa-heart"></i><span>Save Recipe</span>'
          : '<i class="fas fa-bookmark"></i><span>Saved</span>';
        showFeedback(saved ? 'Recipe removed from your saved list.' : 'Recipe saved to your account.');
      } else {
        showFeedback(result.error || 'Unable to update saved state right now.');
      }
    } catch (error) {
      console.error('Save toggle error:', error);
      showFeedback('Unable to update saved state right now.');
    } finally {
      button.disabled = false;
    }
  }

  async function shareRecipe(recipe) {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: getTitle(recipe),
          text: `Check out ${getTitle(recipe)} on RecipifyHub`,
          url: shareUrl
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      await window.RecipifyDB.recordShareEvent(String(recipe.id || recipe._id), recipe.source_collection, 'share');
      showFeedback('Recipe link is ready to share.');
    } catch (error) {
      console.error('Share error:', error);
      showFeedback('Sharing is not available right now.');
    }
  }

  function sendToPlanner(recipe) {
    sessionStorage.setItem('mealPlannerRecipe', JSON.stringify({
      id: String(recipe.id || recipe._id),
      _id: String(recipe.id || recipe._id),
      title: getTitle(recipe),
      name: getTitle(recipe),
      collection: recipe.source_collection,
      image: getImage(recipe),
      date: sessionStorage.getItem('mealPlannerReturnDate') || new Date().toISOString().slice(0, 10),
      mealType: sessionStorage.getItem('mealPlannerMealType') || 'dinner'
    }));
    window.location.href = 'meal-planner';
  }

  async function buildViewModel(recipe) {
    const model = {
      title: getTitle(recipe),
      description: getDescription(recipe),
      ingredients: collectIngredients(recipe),
      steps: collectSteps(recipe)
    };

    if (window.RecipifyComponents?.getCurrentLanguage?.() !== 'hi') {
      return model;
    }

    if (!window.RecipifyComponents?.translateDynamicText || !window.RecipifyComponents?.translateDynamicList) {
      return model;
    }

    const [title, description, ingredients, steps] = await Promise.all([
      window.RecipifyComponents.translateDynamicText(model.title, 'hi'),
      window.RecipifyComponents.translateDynamicText(model.description, 'hi'),
      window.RecipifyComponents.translateDynamicList(model.ingredients, 'hi'),
      window.RecipifyComponents.translateDynamicList(model.steps, 'hi')
    ]);

    return {
      ...model,
      title,
      description,
      ingredients,
      steps
    };
  }

  async function render(recipe, metricsResult, ratingsResult, saved) {
    const viewModel = await buildViewModel(recipe);
    const title = viewModel.title;
    const description = viewModel.description;
    const image = getImage(recipe);
    const videoUrl = getVideoUrl(recipe);
    const videoAsset = getVideoAsset(videoUrl);
    const sourceUrl = getSourceUrl(recipe);
    const ingredients = viewModel.ingredients;
    const steps = viewModel.steps;
    const nutrition = collectNutrition(recipe);
    const meta = getMeta(recipe, ingredients, steps);
    const nutritionEntries = Object.entries(nutrition);
    const averageRating = Number(ratingsResult?.data?.averageRating ?? ratingsResult?.averageRating ?? 0) || 0;
    const ratingCount = ratingsResult?.data?.ratings?.length || ratingsResult?.ratings?.length || 0;
    const shareCount = metricsResult?.metrics?.shareCount || 0;
    const viewCount = metricsResult?.metrics?.viewCount || 0;
    const recipeId = String(recipe.id || recipe._id);
    const kitchenGuide = [
      ['Cuisine', recipe.cuisine],
      ['Best for', firstPresent(recipe.course, recipe.category, recipe.subcategory)],
      ['Difficulty', firstPresent(recipe.difficulty, recipe.difficult)],
      ['Occasion', recipe.occasion]
    ].filter((item) => isPresent(item[1]));
    const sideSections = [];

    document.title = `${title} | RecipifyHub`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', `${title} on RecipifyHub. Powered by MH Horizon.`);

    if (videoAsset) {
      sideSections.push(`
        <article class="panel section-panel video-panel">
          <div class="section-head">
            <div>
              <h2>Cook-along video</h2>
              <p>Watch the recipe video without leaving this page.</p>
            </div>
          </div>
          ${renderVideoPlayer(videoAsset, title)}
        </article>
      `);
    }

    if (kitchenGuide.length || sourceUrl) {
      sideSections.push(`
        <article class="panel section-panel">
          <div class="section-head">
            <div>
              <h2>Kitchen guide</h2>
              <p>Quick notes to help you start with confidence.</p>
            </div>
          </div>
          <div class="support-list">
            ${kitchenGuide.map(([label, value]) => `<div class="support-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(asText(value))}</strong></div>`).join('')}
            ${sourceUrl ? `<a class="support-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-link"></i><span>Open original source</span></a>` : ''}
          </div>
        </article>
      `);
    }

    app().innerHTML = `
      <div class="back-row">
        <a class="back-link" href="allrecipe"><i class="fas fa-arrow-left"></i><span>Back to the recipe vault</span></a>
        <p class="viewer-note" id="viewer-feedback">Recipe ready. Powered by MH Horizon.</p>
      </div>

      <section class="panel recipe-stage">
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="eyebrow"><i class="fas fa-gem"></i>Recipe Spotlight</span>
            <div>
              <h1 class="recipe-title">${escapeHtml(title)}</h1>
              <p class="recipe-summary">${escapeHtml(description)}</p>
            </div>

            <div class="meta-strip">
              ${meta.slice(0, 6).map(([label, value]) => `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
            </div>

            <div class="action-row">
              <button class="btn btn-primary" id="save-recipe-btn" data-saved="${saved}">
                <i class="fas ${saved ? 'fa-bookmark' : 'fa-heart'}"></i>
                <span>${saved ? 'Saved' : 'Save Recipe'}</span>
              </button>
              <a class="btn btn-secondary" href="cookmode?id=${encodeURIComponent(recipeId)}&collection=${encodeURIComponent(recipe.source_collection)}">
                <i class="fas fa-fire"></i><span>Cook Mode</span>
              </a>
              <a class="btn btn-outline" href="nutritionanalysis?id=${encodeURIComponent(recipeId)}&collection=${encodeURIComponent(recipe.source_collection)}">
                <i class="fas fa-chart-pie"></i><span>Nutrition Studio</span>
              </a>
              <button class="ghost-link-btn" type="button" id="planner-btn"><i class="fas fa-calendar-alt"></i><span>Send to Planner</span></button>
              <button class="ghost-link-btn" type="button" id="share-btn"><i class="fas fa-share-nodes"></i><span>Share</span></button>
              ${sourceUrl ? `<a class="ghost-link-btn" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-link"></i><span>Open Source</span></a>` : ''}
            </div>

            <div class="metric-ribbon">
              ${metricMarkup('Average Rating', averageRating.toFixed(1))}
              ${metricMarkup('Ratings', ratingCount)}
              ${metricMarkup('Views', viewCount)}
              ${metricMarkup('Shares', shareCount)}
            </div>
          </div>

          <div class="hero-media">
            <div class="hero-image-frame">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="eager">
              <div class="image-badges">
                <span class="floating-badge"><i class="fas fa-book-open"></i>${ingredients.length} ingredients</span>
                <span class="floating-badge"><i class="fas fa-list-check"></i>${steps.length} instructions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="viewer-grid${sideSections.length ? '' : ' viewer-grid-full'}">
        <div class="viewer-main">
          <article class="panel section-panel">
            <div class="section-head">
              <div>
                <h2>Ingredient canvas</h2>
                <p>Each line is built from whichever ingredient fields this recipe exposes.</p>
              </div>
            </div>
            <div class="ingredient-grid">
              ${ingredients.length
                ? ingredients.map((ingredient, index) => `<label class="ingredient-item"><input type="checkbox" aria-label="Mark ingredient ${index + 1} as used"><span>${escapeHtml(ingredient)}</span></label>`).join('')
                : '<p class="viewer-note">No explicit ingredient list was found in this payload yet.</p>'}
            </div>
          </article>

          <article class="panel section-panel">
            <div class="section-head">
              <div>
                <h2>Cooking flow</h2>
                <p>The viewer scans directions, steps, methods, and preparation fields to build a usable sequence.</p>
              </div>
            </div>
            <div class="instruction-list">
              ${steps.length
                ? steps.map((step, index) => `<article class="instruction-step"><span class="step-index">${index + 1}</span><p class="step-copy">${escapeHtml(step)}</p></article>`).join('')
                : '<p class="viewer-note">No clear step sequence was available in the current source data.</p>'}
            </div>
          </article>

          <article class="panel section-panel">
            <div class="section-head">
              <div>
                <h2>Nutrition snapshot</h2>
                <p>Structured nutrition values appear here whenever the recipe includes them.</p>
              </div>
            </div>
            ${nutritionEntries.length
              ? `<div class="nutrition-grid">${nutritionEntries.map(([label, value]) => `<article class="nutrition-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}</div>`
              : '<p class="viewer-note">No structured nutrition block was available. Nutrition Studio can still estimate values for this recipe.</p>'}
          </article>

          <article class="panel section-panel comments-section">
            <div class="section-head">
              <div>
                <h2>Community notes <span id="comment-count">(0)</span></h2>
                <p>Ratings and comments stay connected to this recipe so feedback feels consistent everywhere.</p>
              </div>
            </div>
            <div class="support-list">
              <div class="support-item">
                <span>Rate This Recipe</span>
                <div class="rating-stars" aria-label="Recipe rating">
                  <i class="fas fa-star" data-rating="1"></i>
                  <i class="fas fa-star" data-rating="2"></i>
                  <i class="fas fa-star" data-rating="3"></i>
                  <i class="fas fa-star" data-rating="4"></i>
                  <i class="fas fa-star" data-rating="5"></i>
                </div>
                <p class="viewer-note">Current average: <strong id="average-rating">${averageRating.toFixed(1)}</strong> from <span id="rating-count">${ratingCount}</span> ratings.</p>
              </div>
              <div class="comment-form">
                <textarea id="comment-input" placeholder="Share what worked, what you changed, or how this recipe turned out."></textarea>
                <button id="submit-comment" class="btn btn-primary" type="button"><i class="fas fa-paper-plane"></i><span>Post Comment</span></button>
              </div>
              <div id="comments-status" class="comments-status"><i class="fas fa-spinner fa-spin"></i><span>Loading comments...</span></div>
              <div id="comments-list" class="comments-list" style="display:none;"></div>
            </div>
          </article>
        </div>

        ${sideSections.length ? `<aside class="viewer-side">${sideSections.join('')}</aside>` : ''}
      </section>
    `;

    document.getElementById('save-recipe-btn').addEventListener('click', function () {
      toggleSave(this, recipe);
    });
    document.getElementById('planner-btn').addEventListener('click', function () {
      sendToPlanner(recipe);
    });
    document.getElementById('share-btn').addEventListener('click', function () {
      shareRecipe(recipe);
    });

    window.currentRecipeId = recipeId;
    window.currentCollection = recipe.source_collection;
    if (typeof initCommentsAndRatings === 'function') initCommentsAndRatings();
  }

  function renderError(message) {
    app().innerHTML = `
      <div class="panel empty-state">
        <div>
          <h1>We could not open this recipe yet</h1>
          <p>${escapeHtml(message || 'Something went wrong while reading this recipe.')}</p>
          <div class="action-row" style="justify-content:center;">
            <a class="btn btn-primary" href="allrecipe">Back to recipes</a>
            <button class="btn btn-outline" type="button" id="reload-recipe-page">Try again</button>
          </div>
        </div>
      </div>
    `;
    const reloadButton = document.getElementById('reload-recipe-page');
    if (reloadButton) reloadButton.addEventListener('click', () => window.location.reload());
  }

  async function init() {
    if (window.RecipifyComponents && typeof window.RecipifyComponents.initComponents === 'function') {
      await window.RecipifyComponents.initComponents();
    }

    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('id');
    const collection = params.get('collection');

    if (!recipeId || !collection) {
      renderError('This recipe link is missing a few details. Please reopen it from the recipe library.');
      return;
    }

    try {
      const [recipeResult, metricsResult, ratingsResult, authResult] = await Promise.all([
        window.RecipifyDB.getRecipeById(recipeId, collection),
        window.RecipifyDB.getRecipeMetrics(recipeId, collection),
        window.RecipifyDB.getRatings(recipeId, collection).catch(() => ({ success: false })),
        window.RecipifyDB.checkAuth()
      ]);

      if (!recipeResult.success || !recipeResult.data) {
        throw new Error(recipeResult.error || 'Recipe not found');
      }

      const recipe = {
        ...recipeResult.data,
        id: recipeResult.data.id || recipeResult.data._id || recipeId,
        source_collection: recipeResult.data.source_collection || collection
      };

      let saved = false;
      if (authResult.isAuthenticated) {
        saved = await window.RecipifyDB.isRecipeSaved(String(recipe.id || recipe._id), recipe.source_collection);
      }

      viewerState.recipe = recipe;
      viewerState.metricsResult = metricsResult;
      viewerState.ratingsResult = ratingsResult;
      viewerState.saved = saved;

      await render(recipe, metricsResult, ratingsResult, saved);
      window.RecipifyDB.recordRecipeView(String(recipe.id || recipe._id), recipe.source_collection);
    } catch (error) {
      console.error('Recipe viewer load error:', error);
      renderError(error.message || 'Something went wrong while reading this recipe.');
    }
  }

  window.addEventListener('recipify:language-changed', async () => {
    if (!viewerState.recipe) {
      return;
    }

    try {
      await render(viewerState.recipe, viewerState.metricsResult, viewerState.ratingsResult, viewerState.saved);
    } catch (error) {
      console.error('Recipe viewer language rerender failed:', error);
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})();

