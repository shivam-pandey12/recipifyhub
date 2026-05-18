(function () {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  } 

  function renderCollection(collection) {
    return `
      <article class="panel">
        <div class="panel-body stack">
          <div class="section-heading">
            <div>
              <span class="section-kicker"><i class="fas fa-layer-group"></i> ${escapeHtml(collection.name)}</span>
              <h2>${escapeHtml(collection.name.replace(/_/g, ' '))}</h2>
            </div>
            <div class="cluster-wrap">
              <span class="pill">${collection.estimatedCount.toLocaleString()} docs</span>
              <span class="pill">${collection.sampledCount} sampled</span>
              <span class="pill">${collection.fieldCount} top-level fields</span>
            </div>
          </div>
          <div class="field-table">
            <div class="field-row header">
              <span>Field</span>
              <span>Coverage</span>
              <span>Types</span>
              <span>Example</span>
            </div>
            ${collection.fields.map(field => `
              <div class="field-row">
                <strong class="mono">${escapeHtml(field.field)}</strong>
                <span>${field.coverage}%</span>
                <span>${field.types.map(type => `<span class="pill">${escapeHtml(type)}</span>`).join(' ')}</span>
                <span class="mono">${escapeHtml(field.example || '-')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </article>
    `;
  }

  async function loadSchema(sampleSize) {
    const response = await fetch(`/api/admin/schema-inspector?sampleSize=${sampleSize}`, {
      credentials: 'include'
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to load schema coverage');
    }

    return result;
  }

  async function init() {
    await window.RecipifyComponents.initComponents();

    const target = document.getElementById('schema-app');
    const initialSample = 120;

    async function render(sampleSize) {
      target.innerHTML = `
        <section class="page-hero">
          <span class="hero-kicker"><i class="fas fa-database"></i> Admin schema inspector</span>
          <h1>Live field coverage across your recipe collections.</h1>
          <p>Use this page to understand which fields are common, optional, or collection-specific before building new viewer features.</p>
        </section>
        <div class="panel loading-state">
          <div class="status-spinner"></div>
          <div>
            <h2>Refreshing schema coverage</h2>
            <p>Sampling live documents from the recipe vault.</p>
          </div>
        </div>
      `;

      try {
        const result = await loadSchema(sampleSize);
        target.innerHTML = `
          <section class="page-hero">
            <span class="hero-kicker"><i class="fas fa-database"></i> Admin schema inspector</span>
            <h1>Live field coverage across your recipe collections.</h1>
            <p>This page samples live records and shows top-level field coverage, types, and examples so you can build against the real database shape.</p>
          </section>
          <section class="panel">
            <div class="panel-body stack">
              <div class="section-heading">
                <div>
                  <span class="section-kicker"><i class="fas fa-chart-bar"></i> Coverage controls</span>
                  <h2>Sample tuning</h2>
                </div>
                <div class="schema-toolbar">
                  <input id="sample-size-input" class="form-control" type="number" min="25" max="400" value="${result.sampleSize}" style="width: 120px;">
                  <button id="reload-schema" class="btn btn-primary" type="button"><i class="fas fa-rotate"></i> Reload</button>
                </div>
              </div>
              <p class="library-message">Sampling ${result.sampleSize} documents per collection from the live recipe vault.</p>
            </div>
          </section>
          <section class="collection-grid">
            ${result.collections.map(renderCollection).join('')}
          </section>
        `;

        document.getElementById('reload-schema').addEventListener('click', () => {
          const nextSize = Number(document.getElementById('sample-size-input').value || result.sampleSize);
          render(nextSize);
        });
      } catch (error) {
        console.error('Schema inspector load error:', error);
        target.innerHTML = `
          <section class="page-hero">
            <span class="hero-kicker"><i class="fas fa-database"></i> Admin schema inspector</span>
            <h1>We could not inspect the schema right now.</h1>
            <p>${escapeHtml(error.message || 'Please try again in a moment.')}</p>
          </section>
        `;
      }
    }

    render(initialSample);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
