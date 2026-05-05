// Surron Parts Finder — V1
// Loads parts.json, renders a searchable/sortable list of parts with cheapest-first prices.

const state = {
  parts: [],
  categories: [],
  filter: 'All',
  query: '',
  sort: 'price-asc',
  expanded: new Set(),
};

const els = {
  search: document.getElementById('search'),
  filters: document.getElementById('filters'),
  sortBy: document.getElementById('sortBy'),
  list: document.getElementById('partsList'),
  count: document.getElementById('resultCount'),
  banner: document.getElementById('demoBanner'),
};

init();

async function init() {
  try {
    const res = await fetch('parts.json', { cache: 'no-store' });
    const data = await res.json();
    state.parts = data.parts || [];
    state.categories = ['All', ...(data.categories || [])];

    const anyPlaceholder = state.parts.some(p =>
      p.listings.some(l => l.isPlaceholder)
    );
    els.banner.hidden = !anyPlaceholder;

    renderFilters();
    bindEvents();
    render();
  } catch (err) {
    els.list.innerHTML =
      '<li class="empty">Couldn\'t load parts data. Check parts.json.</li>';
    console.error(err);
  }
}

function bindEvents() {
  els.search.addEventListener('input', (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });
  els.sortBy.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });
}

function renderFilters() {
  els.filters.innerHTML = state.categories
    .map(
      (cat) =>
        `<button class="filter-chip ${cat === state.filter ? 'active' : ''}" data-cat="${cat}">${cat}</button>`
    )
    .join('');
  els.filters.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.cat;
      renderFilters();
      render();
    });
  });
}

function bestListing(part) {
  const inStock = part.listings.filter((l) => l.inStock);
  const pool = inStock.length ? inStock : part.listings;
  return [...pool].sort(
    (a, b) => totalPrice(a) - totalPrice(b)
  )[0];
}

function totalPrice(listing) {
  return (listing.price || 0) + (listing.shipping || 0);
}

function highestPrice(part) {
  return Math.max(...part.listings.map(totalPrice));
}

function filtered() {
  return state.parts.filter((p) => {
    if (state.filter !== 'All' && p.category !== state.filter) return false;
    if (state.query) {
      const hay = `${p.name} ${p.category} ${p.bike}`.toLowerCase();
      if (!hay.includes(state.query)) return false;
    }
    return true;
  });
}

function sorted(parts) {
  const copy = [...parts];
  switch (state.sort) {
    case 'price-asc':
      copy.sort((a, b) => totalPrice(bestListing(a)) - totalPrice(bestListing(b)));
      break;
    case 'price-desc':
      copy.sort((a, b) => totalPrice(bestListing(b)) - totalPrice(bestListing(a)));
      break;
    case 'name-asc':
      copy.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return copy;
}

function fmtPrice(n) {
  return `$${n.toFixed(2)}`;
}

function render() {
  const list = sorted(filtered());
  els.count.textContent = `${list.length} part${list.length === 1 ? '' : 's'}`;

  if (list.length === 0) {
    els.list.innerHTML = '<li class="empty">No parts match your search.</li>';
    return;
  }

  els.list.innerHTML = list.map(renderPart).join('');
  els.list.querySelectorAll('.expand-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      state.expanded.add(id);
      render();
    });
  });
}

function renderPart(part) {
  const best = bestListing(part);
  const high = highestPrice(part);
  const savings = high - totalPrice(best);
  const isExpanded = state.expanded.has(part.id);
  const otherCount = part.listings.length - 1;

  const listings = [...part.listings]
    .sort((a, b) => totalPrice(a) - totalPrice(b))
    .map((l) => {
      const total = totalPrice(l);
      const shippingNote = l.shipping
        ? `+ ${fmtPrice(l.shipping)} shipping`
        : 'Free shipping';
      return `
        <div class="listing ${l.inStock ? '' : 'out-of-stock'}">
          <div class="listing-vendor">
            <strong>${escapeHtml(l.vendor)}</strong>
            <small>${shippingNote}${l.inStock ? '' : ' · Out of stock'}</small>
          </div>
          <span class="listing-price">${fmtPrice(total)}</span>
          <a class="listing-link" href="${escapeAttr(l.url)}" target="_blank" rel="noopener nofollow">${l.inStock ? 'Buy →' : 'Notify'}</a>
        </div>
      `;
    })
    .join('');

  return `
    <li class="part ${isExpanded ? 'expanded' : ''}">
      <div class="part-row">
        <div class="part-info">
          <h3 class="part-name">${escapeHtml(part.name)}</h3>
          <div class="part-meta">
            <span class="tag">${escapeHtml(part.category)}</span>
            <span class="tag bike">${escapeHtml(part.bike)}</span>
          </div>
        </div>
        <div class="part-price">
          <div class="price-best">${fmtPrice(totalPrice(best))}</div>
          <div class="price-vendor">at ${escapeHtml(best.vendor)}</div>
          ${savings > 5 ? `<div class="price-savings">Save ${fmtPrice(savings)} vs highest</div>` : ''}
        </div>
      </div>
      <button class="expand-btn" data-id="${escapeAttr(part.id)}">
        See all ${part.listings.length} option${part.listings.length === 1 ? '' : 's'} →
      </button>
      <div class="listings">${listings}</div>
    </li>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}
function escapeAttr(s) {
  return escapeHtml(s);
}
