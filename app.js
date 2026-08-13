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
  meta.innerHTML = `<span>${safeText(review.style)}</span><span>${safeText(review.location || "Location not recorded")}</span>`;

  const pricePaid = document.createElement("div");
  pricePaid.className = "review-price-paid";
  pricePaid.textContent = `Paid: ${formatPrice(review.pricePaid, review.currency || "GBP")}`;

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
  content.append(meta, pricePaid, title, copy, scoreRow);

  article.appendChild(content);
  return article;
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
  const galleryGrid = el("#gallery-grid");
  const supportersGrid = el("#supporters-grid");

  if (state.reviews.length) {
    state.reviews.forEach(review => reviewsGrid.appendChild(createReviewCard(review)));
  } else {
    reviewsGrid.innerHTML = `<div class="empty-state">No reviews yet. Tragic. Time to visit the pub.</div>`;
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
