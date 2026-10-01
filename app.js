/**
 * KirkDrinks.beer
 * Frontend application
 *
 * Handles:
 * - Beer reviews
 * - Venue reviews
 * - Gallery
 * - Live supporter wall
 * - Static supporter fallback
 * - Pint Map
 * - Navigation
 */

const SUPPORTERS_API =
  "https://kirkdrinks-beer.kirkjlemon.workers.dev/api/supporters";

const SUPPORTERS_FALLBACK =
  "data/supporters.json";

const REVIEWS_URL =
  "data/reviews.json";

const GALLERY_URL =
  "data/gallery.json";


// ================================================================
// DOM
// ================================================================

const reviewGrid =
  document.querySelector("#reviewGrid");

const galleryGrid =
  document.querySelector("#galleryGrid");

const supporterGrid =
  document.querySelector("#supporterGrid");

const totalBeersFunded =
  document.querySelector("#totalBeersFunded");

const totalReviews =
  document.querySelector("#totalReviews");

const averageScore =
  document.querySelector("#averageScore");

const placesPinned =
  document.querySelector("#placesPinned");

const mapStatus =
  document.querySelector("#mapStatus");

const menuToggle =
  document.querySelector("#menuToggle");

const siteNav =
  document.querySelector("#siteNav");


// ================================================================
// STATE
// ================================================================

let reviews = [];

let galleryItems = [];

let supporters = [];

let pintMap = null;


// ================================================================
// INITIALISE
// ================================================================

document.addEventListener(
  "DOMContentLoaded",
  initialiseSite
);


async function initialiseSite() {
  initialiseNavigation();

  await Promise.all([
    loadReviews(),
    loadGallery(),
    loadSupporters()
  ]);
}


// ================================================================
// REVIEWS
// ================================================================

async function loadReviews() {
  try {
    const response =
      await fetch(REVIEWS_URL, {
        cache: "no-store"
      });


    if (!response.ok) {
      throw new Error(
        `Reviews request failed: ${response.status}`
      );
    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {
      throw new Error(
        "Reviews JSON must contain an array."
      );
    }


    reviews = data;


    renderReviews();

    renderReviewStats();

    initialisePintMap();

  } catch (error) {
    console.error(
      "Unable to load reviews:",
      error
    );


    if (reviewGrid) {
      reviewGrid.innerHTML = `
        <p class="empty-state">
          Couldn't load the beer reviews.
        </p>
      `;
    }


    if (mapStatus) {
      mapStatus.textContent =
        "Couldn't load locations.";
    }
  }
}


// ================================================================
// RENDER REVIEWS
// ================================================================

function renderReviews() {
  if (!reviewGrid) {
    return;
  }


  if (reviews.length === 0) {
    reviewGrid.innerHTML = `
      <p class="empty-state">
        No beers reviewed yet.
      </p>
    `;

    return;
  }


  reviewGrid.innerHTML =
    reviews
      .map(
        (review, index) =>
          createReviewCard(
            review,
            index
          )
      )
      .join("");
}


function createReviewCard(
  review,
  index
) {
  const name =
    escapeHtml(
      review.name || "Unknown beer"
    );


  const style =
    escapeHtml(
      review.style || "Beer"
    );


  const location =
    escapeHtml(
      review.location || ""
    );


  const country =
    escapeHtml(
      review.country || ""
    );


  const reviewText =
    escapeHtml(
      review.review || ""
    );


  const image =
    safeImagePath(
      review.image
    );


  const alt =
    escapeHtml(
      review.alt ||
      `Photo of ${review.name || "beer"}`
    );


  const score =
    normaliseScore(
      review.score
    );


  const buyAgain =
    review.buyAgain === true;


  const venue =
    review.venue &&
    typeof review.venue === "object"
      ? review.venue
      : null;


  const locationText =
    [location, country]
      .filter(Boolean)
      .join(", ");


  return `
    <article
      class="review-card"
      id="review-${index}"
    >

      <div class="review-card__image-wrap">

        <img
          class="review-card__image"
          src="${image}"
          alt="${alt}"
          loading="lazy"
          decoding="async"
        >

        <div
          class="review-card__score"
          aria-label="Score ${score} out of 10"
        >
          ${score}
        </div>

      </div>


      <div class="review-card__content">

        <div class="review-card__eyebrow">
          ${style}
        </div>

        <h3>
          ${name}
        </h3>


        ${
          locationText
            ? `
              <p class="review-card__location">
                📍 ${locationText}
              </p>
            `
            : ""
        }


        <p class="review-card__review">
          ${reviewText}
        </p>


        <div class="review-card__verdict">

          <span>
            ${
              buyAgain
                ? "🍺 Would drink again"
                : "🚫 Wouldn't buy again"
            }
          </span>

        </div>


        ${
          venue
            ? createVenueReview(
                venue
              )
            : ""
        }

      </div>

    </article>
  `;
}


// ================================================================
// VENUE REVIEWS
// ================================================================

function createVenueReview(
  venue
) {
  const name =
    escapeHtml(
      venue.name ||
      "Unknown venue"
    );


  const location =
    escapeHtml(
      venue.location || ""
    );


  const review =
    escapeHtml(
      venue.review || ""
    );


  const priceScore =
    normaliseScore(
      venue.price
    );


  const pourScore =
    normaliseScore(
      venue.pour
    );


  const venueScore =
    normaliseScore(
      venue.venue
    );


  const overall =
    calculateVenueOverall(
      venue
    );


  const pricePaid =
    formatPrice(
      venue.pricePaid,
      venue.currency
    );


  const wouldReturn =
    venue.wouldReturn === true;


  return `
    <section class="venue-review">

      <div class="venue-review__header">

        <div>

          <span class="venue-review__label">
            VENUE
          </span>

          <h4>
            ${name}
          </h4>

          ${
            location
              ? `
                <p>
                  ${location}
                </p>
              `
              : ""
          }

        </div>


        <div
          class="venue-review__overall"
          aria-label="Venue score ${overall} out of 10"
        >
          ${overall}
        </div>

      </div>


      ${
        pricePaid
          ? `
            <p class="venue-review__price-paid">
              Pint price:
              <strong>
                ${pricePaid}
              </strong>
            </p>
          `
          : ""
      }


      <div class="venue-review__scores">

        <div>
          <span>Price</span>
          <strong>
            ${priceScore}
          </strong>
        </div>

        <div>
          <span>Pour</span>
          <strong>
            ${pourScore}
          </strong>
        </div>

        <div>
          <span>Venue</span>
          <strong>
            ${venueScore}
          </strong>
        </div>

      </div>


      ${
        review
          ? `
            <p class="venue-review__text">
              ${review}
            </p>
          `
          : ""
      }


      <div class="venue-review__return">

        ${
          wouldReturn
            ? "🍻 Would drink here again"
            : "🚪 Wouldn't rush back"
        }

      </div>

    </section>
  `;
}


function calculateVenueOverall(
  venue
) {
  const scores = [
    Number(venue.price),
    Number(venue.pour),
    Number(venue.venue)
  ]
    .filter(
      score =>
        Number.isFinite(score)
    );


  if (scores.length === 0) {
    return "—";
  }


  const total =
    scores.reduce(
      (sum, score) =>
        sum + score,
      0
    );


  return (
    total /
    scores.length
  ).toFixed(1);
}


// ================================================================
// REVIEW STATS
// ================================================================

function renderReviewStats() {
  if (totalReviews) {
    totalReviews.textContent =
      String(
        reviews.length
      );
  }


  if (averageScore) {
    const validScores =
      reviews
        .map(
          review =>
            Number(review.score)
        )
        .filter(
          score =>
            Number.isFinite(score)
        );


    if (
      validScores.length === 0
    ) {
      averageScore.textContent =
        "—";
    } else {
      const total =
        validScores.reduce(
          (sum, score) =>
            sum + score,
          0
        );


      averageScore.textContent =
        (
          total /
          validScores.length
        ).toFixed(1);
    }
  }
}


// ================================================================
// PINT MAP
// ================================================================

function initialisePintMap() {
  const mapElement =
    document.querySelector(
      "#pintMap"
    );


  if (!mapElement) {
    return;
  }


  if (
    typeof maplibregl ===
    "undefined"
  ) {
    console.error(
      "MapLibre failed to load."
    );


    if (mapStatus) {
      mapStatus.textContent =
        "Map unavailable.";
    }

    return;
  }


  const locations =
    buildMapLocations(
      reviews
    );


  if (placesPinned) {
    placesPinned.textContent =
      String(
        locations.length
      );
  }


  if (
    locations.length === 0
  ) {
    if (mapStatus) {
      mapStatus.textContent =
        "No places pinned yet. The drinking map begins with the next adventure.";
    }


    mapElement.classList.add(
      "pint-map--empty"
    );

    return;
  }


  mapElement.classList.remove(
    "pint-map--empty"
  );


  pintMap =
    new maplibregl.Map({
      container: "pintMap",

      style:
        "https://tiles.openfreemap.org/styles/liberty",

      center: [
        locations[0].lng,
        locations[0].lat
      ],

      zoom: 3,

      attributionControl: true
    });


  pintMap.addControl(
    new maplibregl.NavigationControl({
      showCompass: false
    }),
    "top-right"
  );


  const bounds =
    new maplibregl.LngLatBounds();


  locations.forEach(
    location => {
      addMapMarker(
        location
      );


      bounds.extend([
        location.lng,
        location.lat
      ]);
    }
  );


  if (
    locations.length > 1
  ) {
    pintMap.fitBounds(
      bounds,
      {
        padding: 60,
        maxZoom: 12,
        duration: 0
      }
    );
  } else {
    pintMap.setCenter([
      locations[0].lng,
      locations[0].lat
    ]);

    pintMap.setZoom(10);
  }


  if (mapStatus) {
    mapStatus.textContent =
      `${locations.length} ${
        locations.length === 1
          ? "place"
          : "places"
      } pinned so far.`;
  }
}


// ================================================================
// BUILD MAP LOCATIONS
// ================================================================

function buildMapLocations(
  reviewData
) {
  const locationMap =
    new Map();


  reviewData.forEach(
    (review, reviewIndex) => {
      const venue =
        review.venue;


      if (
        !venue ||
        typeof venue !== "object" ||
        !venue.coordinates
      ) {
        return;
      }


      const lat =
        Number(
          venue.coordinates.lat
        );


      const lng =
        Number(
          venue.coordinates.lng
        );


      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return;
      }


      if (
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return;
      }


      const venueName =
        venue.name ||
        "Unknown venue";


      const venueLocation =
        venue.location ||
        review.location ||
        "";


      const country =
        review.country ||
        "";


      /*
       * Same venue + same coordinates =
       * ONE marker containing multiple beers.
       */

      const key =
        [
          venueName
            .trim()
            .toLowerCase(),

          lat.toFixed(5),

          lng.toFixed(5)
        ]
          .join("|");


      if (
        !locationMap.has(key)
      ) {
        locationMap.set(
          key,
          {
            venueName,
            venueLocation,
            country,
            lat,
            lng,
            reviews: []
          }
        );
      }


      locationMap
        .get(key)
        .reviews
        .push({
          ...review,
          reviewIndex
        });
    }
  );


  return [
    ...locationMap.values()
  ];
}


// ================================================================
// MAP MARKERS
// ================================================================

function addMapMarker(
  location
) {
  const markerElement =
    document.createElement(
      "button"
    );


  markerElement.type =
    "button";


  markerElement.className =
    "pint-marker";


  markerElement.setAttribute(
    "aria-label",
    `View beers reviewed at ${location.venueName}`
  );


  markerElement.textContent =
    "🍺";


  const popup =
    new maplibregl.Popup({
      offset: 24,
      maxWidth: "320px"
    })
      .setHTML(
        createMapPopup(
          location
        )
      );


  new maplibregl.Marker({
    element: markerElement,
    anchor: "bottom"
  })
    .setLngLat([
      location.lng,
      location.lat
    ])
    .setPopup(
      popup
    )
    .addTo(
      pintMap
    );
}


// ================================================================
// MAP POPUP
// ================================================================

function createMapPopup(
  location
) {
  const venueName =
    escapeHtml(
      location.venueName
    );


  const venueLocation =
    escapeHtml(
      location.venueLocation
    );


  const country =
    escapeHtml(
      location.country
    );


  const locationText =
    [
      venueLocation,
      country
    ]
      .filter(Boolean)
      .join(", ");


  const scores =
    location.reviews
      .map(
        review =>
          Number(review.score)
      )
      .filter(
        score =>
          Number.isFinite(score)
      );


  const average =
    scores.length
      ? (
          scores.reduce(
            (sum, score) =>
              sum + score,
            0
          ) /
          scores.length
        ).toFixed(1)
      : null;


  const beers =
    location.reviews
      .map(
        review => {
          const beerName =
            escapeHtml(
              review.name ||
              "Unknown beer"
            );


          const score =
            normaliseScore(
              review.score
            );


          return `
            <li>
              <a
                href="#review-${review.reviewIndex}"
              >
                <span>
                  ${beerName}
                </span>

                <strong>
                  ${score}/10
                </strong>
              </a>
            </li>
          `;
        }
      )
      .join("");


  return `
    <div class="map-popup">

      <span class="map-popup__eyebrow">
        🍺 DRANK HERE
      </span>

      <h3>
        ${venueName}
      </h3>

      ${
        locationText
          ? `
            <p class="map-popup__location">
              📍 ${locationText}
            </p>
          `
          : ""
      }

      <div class="map-popup__stats">

        <span>
          ${
            location.reviews.length
          }
          ${
            location.reviews.length === 1
              ? "beer"
              : "beers"
          }
        </span>

        ${
          average
            ? `
              <span>
                ⭐ ${average} avg
              </span>
            `
            : ""
        }

      </div>

      <ul class="map-popup__beers">
        ${beers}
      </ul>

    </div>
  `;
}


// ================================================================
// GALLERY
// ================================================================

async function loadGallery() {
  try {
    const response =
      await fetch(
        GALLERY_URL,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {
      throw new Error(
        `Gallery request failed: ${response.status}`
      );
    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {
      throw new Error(
        "Gallery JSON must contain an array."
      );
    }


    galleryItems =
      data;


    renderGallery();

  } catch (error) {
    console.error(
      "Unable to load gallery:",
      error
    );


    if (galleryGrid) {
      galleryGrid.innerHTML = `
        <p class="empty-state">
          Couldn't load the gallery.
        </p>
      `;
    }
  }
}


function renderGallery() {
  if (!galleryGrid) {
    return;
  }


  if (
    galleryItems.length === 0
  ) {
    galleryGrid.innerHTML = `
      <p class="empty-state">
        No photos yet.
      </p>
    `;

    return;
  }


  galleryGrid.innerHTML =
    galleryItems
      .map(
        item => {
          const image =
            safeImagePath(
              item.image
            );


          const caption =
            escapeHtml(
              item.caption || ""
            );


          const alt =
            escapeHtml(
              item.alt ||
              item.caption ||
              "Beer photo"
            );


          return `
            <figure class="gallery-card">

              <img
                src="${image}"
                alt="${alt}"
                loading="lazy"
                decoding="async"
              >

              ${
                caption
                  ? `
                    <figcaption>
                      ${caption}
                    </figcaption>
                  `
                  : ""
              }

            </figure>
          `;
        }
      )
      .join("");
}


// ================================================================
// SUPPORTERS
// ================================================================

async function loadSupporters() {
  try {

    /*
     * Primary source:
     * live Cloudflare Worker / D1 API.
     */

    const response =
      await fetch(
        SUPPORTERS_API,
        {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          headers: {
            "Accept":
              "application/json"
          }
        }
      );


    if (!response.ok) {
      throw new Error(
        `Supporter API returned ${response.status}`
      );
    }


    const data =
      await response.json();


    if (
      !data ||
      !Array.isArray(
        data.supporters
      )
    ) {
      throw new Error(
        "Unexpected supporter API response."
      );
    }


    supporters =
      data.supporters;


    renderSupporters(
      data.totalBeers
    );

  } catch (error) {

    console.warn(
      "Live supporter API unavailable. Using static fallback.",
      error
    );


    await loadSupporterFallback();
  }
}


async function loadSupporterFallback() {
  try {
    const response =
      await fetch(
        SUPPORTERS_FALLBACK,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {
      throw new Error(
        `Supporter fallback returned ${response.status}`
      );
    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {
      throw new Error(
        "Supporter fallback must contain an array."
      );
    }


    supporters =
      data;


    renderSupporters();

  } catch (error) {
    console.error(
      "Unable to load supporter data:",
      error
    );


    supporters = [];


    renderSupporters(0);
  }
}


// ================================================================
// RENDER SUPPORTERS
// ================================================================

function renderSupporters(
  suppliedTotal = null
) {
  if (supporterGrid) {

    if (
      supporters.length === 0
    ) {
      supporterGrid.innerHTML = `
        <div class="supporter-empty">

          <span>
            🍺
          </span>

          <p>
            Nobody has funded the research yet.
          </p>

          <strong>
            Your move.
          </strong>

        </div>
      `;

    } else {

      supporterGrid.innerHTML =
        supporters
          .map(
            supporter =>
              createSupporterCard(
                supporter
              )
          )
          .join("");
    }
  }


  if (totalBeersFunded) {

    const calculatedTotal =
      supporters.reduce(
        (
          total,
          supporter
        ) =>
          total +
          safePositiveInteger(
            supporter.beers
          ),
        0
      );


    const apiTotal =
      Number(
        suppliedTotal
      );


    totalBeersFunded.textContent =
      Number.isFinite(apiTotal)
        ? String(apiTotal)
        : String(
            calculatedTotal
          );
  }
}


function createSupporterCard(
  supporter
) {
  const name =
    escapeHtml(
      supporter.name ||
      "Anonymous legend"
    );


  const beers =
    safePositiveInteger(
      supporter.beers
    );


  const message =
    escapeHtml(
      supporter.message || ""
    );


  return `
    <article class="supporter-card">

      <div class="supporter-card__beer">
        🍺
      </div>


      <div class="supporter-card__content">

        <h3>
          ${name}
        </h3>


        <p class="supporter-card__count">
          bought Kirk
          <strong>
            ${beers}
          </strong>
          ${
            beers === 1
              ? "beer"
              : "beers"
          }
        </p>


        ${
          message
            ? `
              <blockquote>
                “${message}”
              </blockquote>
            `
            : ""
        }

      </div>

    </article>
  `;
}


// ================================================================
// NAVIGATION
// ================================================================

function initialiseNavigation() {
  if (
    !menuToggle ||
    !siteNav
  ) {
    return;
  }


  menuToggle.addEventListener(
    "click",
    () => {
      const expanded =
        menuToggle.getAttribute(
          "aria-expanded"
        ) === "true";


      menuToggle.setAttribute(
        "aria-expanded",
        String(!expanded)
      );


      siteNav.classList.toggle(
        "site-nav--open",
        !expanded
      );
    }
  );


  siteNav
    .querySelectorAll("a")
    .forEach(
      link => {
        link.addEventListener(
          "click",
          () => {
            menuToggle.setAttribute(
              "aria-expanded",
              "false"
            );


            siteNav.classList.remove(
              "site-nav--open"
            );
          }
        );
      }
    );
}


// ================================================================
// HELPERS
// ================================================================

function normaliseScore(
  value
) {
  const score =
    Number(value);


  if (!Number.isFinite(score)) {
    return "—";
  }


  const safeScore =
    Math.min(
      10,
      Math.max(
        0,
        score
      )
    );


  return safeScore.toFixed(1);
}


function safePositiveInteger(
  value
) {
  const number =
    Number(value);


  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return 1;
  }


  return Math.floor(
    number
  );
}


function formatPrice(
  value,
  currency
) {
  const amount =
    Number(value);


  if (!Number.isFinite(amount)) {
    return "";
  }


  const currencyCode =
    typeof currency === "string" &&
    /^[A-Za-z]{3}$/.test(
      currency
    )
      ? currency.toUpperCase()
      : "GBP";


  try {
    return new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency:
          currencyCode
      }
    ).format(amount);

  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}


function safeImagePath(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }


  const path =
    value.trim();


  /*
   * Images for KirkDrinks are expected to be
   * local static assets.
   */

  if (
    path.startsWith(
      "assets/"
    )
  ) {
    return path;
  }


  return "";
}


function escapeHtml(
  value
) {
  const text =
    String(
      value ?? ""
    );


  return text
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
      }
