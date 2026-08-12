const state = {
  reviews: [],
  supporters: [],
  gallery: []
};

const el = (selector) => document.querySelector(selector);

async function loadJSON(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function safeText(value) {
  return String(value ?? "");
}

function slugify(value) {
  return safeText(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createReviewCard(review) {
  const article = document.createElement("article");
  article.className = "review-card";

  const img = document.createElement("img");
  img.className = "review-image";
  img.loading = "lazy";
  img.src = review.image;
  img.alt = review.alt || `${review.name} beer`;
  article.appendChild(img);

  const content = document.createElement("div");
  content.className = "review-content";

  const meta = document.createElement("div");
  meta.className = "review-meta";
  meta.innerHTML = `<span>${safeText(review.style)}</span><span>${safeText(review.location)}</span>`;

  const title = document.createElement("h3");
  title.textContent = review.name;

  const copy = document.createElement("p");
  copy.textContent = review.review;

  const scoreRow = document.createElement("div");
  scoreRow.className = "score-row";

  const score = document.createElement("span");
  score.className = "score-badge";
  score.textContent = `${Number(review.score).toFixed(1)}/10`;

  const again = document.createElement("span");
  again.className = "buy-again";
  again.textContent = review.buyAgain ? "WOULD BUY AGAIN ✓" : "ONE AND DONE ✕";

  scoreRow.append(score, again);
  content.append(meta, title, copy, scoreRow);

  if (review.venue?.name) {
    const venueLink = document.createElement("a");
    venueLink.className = "review-venue-link";
    venueLink.href = `#venue-${slugify(review.venue.name)}`;
    venueLink.textContent = `Venue verdict: ${review.venue.name} →`;
    content.appendChild(venueLink);
  }

  article.appendChild(content);
  return article;
}

function getVenueOverall(venue) {
  const values = [venue.price, venue.pour, venue.venue].map(Number).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPrice(value, currency = "GBP") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Price not recorded";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function createVenueCard(review) {
  const venue = review.venue || {};
  const article = document.createElement("article");
  article.className = "venue-card";
  article.id = `venue-${slugify(venue.name || review.location || review.name)}`;

  const head = document.createElement("div");
  head.className = "venue-card-head";

  const headingWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = venue.name || review.location || "Venue";
  const location = document.createElement("div");
  location.className = "venue-location";
  location.textContent = venue.location || review.location || "";

  const paid = document.createElement("div");
  paid.className = "venue-price-paid";
  paid.textContent = `Pint paid: ${formatPrice(venue.pricePaid, venue.currency || "GBP")}`;

  headingWrap.append(title, location, paid);

  const overall = document.createElement("div");
  overall.className = "venue-overall";
  const overallScore = getVenueOverall(venue);
  overall.innerHTML = `<strong>${overallScore.toFixed(1)}</strong><span>overall</span>`;

  head.append(headingWrap, overall);

  const scores = document.createElement("div");
  scores.className = "venue-scores";

  [
    ["Price", venue.price],
    ["Pour", venue.pour],
    ["Venue", venue.venue]
  ].forEach(([label, value]) => {
    const box = document.createElement("div");
    box.className = "venue-score";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("strong");
    valueEl.textContent = `${Number(value || 0).toFixed(1)}/10`;

    box.append(labelEl, valueEl);
    scores.appendChild(box);
  });

  const reviewWrap = document.createElement("div");
  reviewWrap.className = "venue-review";

  const copy = document.createElement("p");
  copy.textContent = venue.review || "No venue notes yet.";

  const verdict = document.createElement("span");
  verdict.className = "venue-verdict";
  verdict.textContent = venue.wouldReturn ? "Would drink here again ✓" : "Wouldn't rush back ✕";

  reviewWrap.append(copy, verdict);
  article.append(head, scores, reviewWrap);

  return article;
}

function createGalleryItem(item) {
  const wrap = document.createElement("figure");
  wrap.className = "gallery-item";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = item.image;
  img.alt = item.alt || item.caption || "Beer photo";

  const caption = document.createElement("figcaption");
  caption.className = "gallery-caption";
  caption.textContent = item.caption || "";

  wrap.append(img, caption);
  return wrap;
}

function createSupporterCard(supporter) {
  const article = document.createElement("article");
  article.className = "supporter";

  const top = document.createElement("div");
  top.className = "supporter-top";

  const name = document.createElement("strong");
  name.textContent = supporter.name || "Anonymous legend";

  const beers = document.createElement("span");
  beers.className = "beers";
  beers.textContent = `🍺 × ${Number(supporter.beers || 1)}`;

  const note = document.createElement("p");
  note.textContent = supporter.message || "Bought Kirk a beer. Absolute hero.";

  top.append(name, beers);
  article.append(top, note);

  return article;
}

function render() {
  const reviewsGrid = el("#reviews-grid");
  const venuesGrid = el("#venues-grid");
  const galleryGrid = el("#gallery-grid");
  const supportersGrid = el("#supporters-grid");

  if (state.reviews.length) {
    state.reviews.forEach(review => reviewsGrid.appendChild(createReviewCard(review)));
  } else {
    reviewsGrid.innerHTML = `<div class="empty-state">No reviews yet. Tragic. Time to visit the pub.</div>`;
  }

  const venueReviews = state.reviews.filter(review => review.venue?.name);
  if (venueReviews.length) {
    venueReviews.forEach(review => venuesGrid.appendChild(createVenueCard(review)));
  } else {
    venuesGrid.innerHTML = `<div class="empty-state">No venue reviews yet. Somebody pour the man a pint.</div>`;
  }

  if (state.gallery.length) {
    state.gallery.forEach(item => galleryGrid.appendChild(createGalleryItem(item)));
  } else {
    galleryGrid.innerHTML = `<div class="empty-state">No beer photos yet.</div>`;
  }

  if (state.supporters.length) {
    state.supporters.forEach(supporter => supportersGrid.appendChild(createSupporterCard(supporter)));
  } else {
    supportersGrid.innerHTML = `<div class="empty-state">Nobody has funded a beer yet. Be the first bad influence.</div>`;
  }

  const totalScore = state.reviews.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const averageScore = state.reviews.length ? totalScore / state.reviews.length : 0;
  const fundedBeers = state.supporters.reduce((sum, item) => sum + Number(item.beers || 0), 0);

  el("#review-count").textContent = state.reviews.length;
  el("#average-score").textContent = averageScore.toFixed(1);
  el("#supporter-count").textContent = fundedBeers;
  el("#funded-count").textContent = fundedBeers;

  const meterPercent = Math.min(100, fundedBeers * 5);
  el("#beer-meter-fill").style.width = `${meterPercent}%`;
}

async function init() {
  try {
    const [reviews, supporters, gallery] = await Promise.all([
      loadJSON("data/reviews.json"),
      loadJSON("data/supporters.json"),
      loadJSON("data/gallery.json")
    ]);
    state.reviews = Array.isArray(reviews) ? reviews : [];
    state.supporters = Array.isArray(supporters) ? supporters : [];
    state.gallery = Array.isArray(gallery) ? gallery : [];
  } catch (error) {
    console.error(error);
  }

  render();

  el("#year").textContent = new Date().getFullYear();

  const menuButton = el(".menu-toggle");
  const nav = el("#site-nav");

  menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

init();
