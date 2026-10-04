/**
 * ================================================================
 * KirkDrinks.beer
 * app.js
 * ================================================================
 *
 * Core site and map are deliberately isolated.
 *
 * If MapLibre/OpenFreeMap/CSP fails:
 * - Reviews STILL work
 * - Stats STILL work
 * - Venues STILL work
 * - Gallery STILL works
 * - Supporters STILL work
 *
 * The map is an optional enhancement.
 * ================================================================
 */


// ================================================================
// CONFIG
// ================================================================

const CONFIG = {
  reviewsUrl: "data/reviews.json",

  galleryUrl: "data/gallery.json",

  supportersFallbackUrl:
    "data/supporters.json",

  supportersApiUrl:
    "https://kirkdrinks-beer.kirkjlemon.workers.dev/api/supporters",

  mapLibreModuleUrl:
    "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs",

  mapStyleUrl:
    "https://tiles.openfreemap.org/styles/liberty"
};


// ================================================================
// DOM
// ================================================================

const DOM = {
  menuToggle:
    document.querySelector("#menu-toggle"),

  siteNav:
    document.querySelector("#site-nav"),

  reviewCount:
    document.querySelector("#review-count"),

  locationCount:
    document.querySelector("#location-count"),

  averageScore:
    document.querySelector("#average-score"),

  supporterCount:
    document.querySelector("#supporter-count"),

  reviewsGrid:
    document.querySelector("#reviews-grid"),

  pintMap:
    document.querySelector("#pint-map"),

  mapEmpty:
    document.querySelector("#map-empty"),

  mapStatus:
    document.querySelector("#map-status"),

  venuesGrid:
    document.querySelector("#venues-grid"),

  galleryGrid:
    document.querySelector("#gallery-grid"),

  fundedCount:
    document.querySelector("#funded-count"),

  beerMeterFill:
    document.querySelector("#beer-meter-fill"),

  supportersGrid:
    document.querySelector("#supporters-grid"),

  year:
    document.querySelector("#year")
};


// ================================================================
// STATE
// ================================================================

const state = {
  reviews: [],
  gallery: [],
  supporters: [],
  map: null,
  maplibregl: null
};


// ================================================================
// INITIALISATION
// ================================================================

document.addEventListener(
  "DOMContentLoaded",
  initialiseSite
);


async function initialiseSite() {
  console.info(
    "[KirkDrinks] Initialising site."
  );

  initialiseNavigation();

  initialiseFooter();


  /*
   * Core systems.
   *
   * NONE of these depend on MapLibre.
   */

  await Promise.allSettled([
    initialiseReviews(),
    initialiseGallery(),
    initialiseSupporters()
  ]);


  console.info(
    "[KirkDrinks] Core site initialisation complete."
  );
}


// ================================================================
// REVIEWS
// ================================================================

async function initialiseReviews() {
  try {
    console.info(
      "[KirkDrinks] Loading reviews..."
    );


    const data =
      await fetchJson(
        CONFIG.reviewsUrl
      );


    if (!Array.isArray(data)) {
      throw new Error(
        "reviews.json must contain a JSON array."
      );
    }


    state.reviews =
      data.filter(
        review =>
          review &&
          typeof review === "object"
      );


    console.info(
      `[KirkDrinks] Loaded ${state.reviews.length} reviews.`
    );


    /*
     * Core rendering happens FIRST.
     */

    renderReviews();

    renderReviewStatistics();

    renderVenues();


    /*
     * Map runs separately.
     *
     * We deliberately DO NOT await it.
     */

    initialisePintMap()
      .catch(
        error => {
          console.error(
            "[KirkDrinks] Map initialisation failed:",
            error
          );


          showMapUnavailable(
            "The pint map couldn't be loaded. Beer reviews are still available."
          );
        }
      );

  } catch (error) {
    console.error(
      "[KirkDrinks] Reviews failed:",
      error
    );


    renderReviewError();

    renderReviewStatistics();

    renderVenues();


    showMapUnavailable(
      "The beer reviews couldn't be loaded, so the map is unavailable."
    );
  }
}


// ================================================================
// REVIEW RENDERING
// ================================================================

function renderReviews() {
  if (!DOM.reviewsGrid) {
    console.error(
      "[KirkDrinks] #reviews-grid not found."
    );

    return;
  }


  if (state.reviews.length === 0) {
    DOM.reviewsGrid.innerHTML = `
      <div class="empty-state">
        No beers reviewed yet.
      </div>
    `;

    return;
  }


  DOM.reviewsGrid.innerHTML =
    state.reviews
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
      review.name ||
      "Mystery pint"
    );


  const brewery =
    escapeHtml(
      review.brewery || ""
    );


  const style =
    escapeHtml(
      review.style ||
      "Beer"
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
    safeAssetPath(
      review.image
    );


  const alt =
    escapeHtml(
      review.alt ||
      `${review.name || "Beer"} review`
    );


  const score =
    formatScore(
      review.score
    );


  const buyAgain =
    review.buyAgain === true;


  const locationText =
    [
      location,
      country
    ]
      .filter(Boolean)
      .join(", ");


  const venue =
    getVenue(
      review
    );


  const price =
    getReviewPrice(
      review
    );


  return `
    <article
      id="review-${index}"
      class="review-card"
    >

      <div class="review-image-wrap">

        ${
          image
            ? `
              <img
                class="review-image"
                src="${image}"
                alt="${alt}"
                loading="lazy"
                decoding="async"
              >
            `
            : `
              <div
                class="review-image review-image-placeholder"
                aria-hidden="true"
              >
                🍺
              </div>
            `
        }

      </div>


      <div class="review-content">

        <div class="review-meta">

          <span>
            ${style}
          </span>

          <span>
            ${score}/10
          </span>

        </div>


        <h3>
          ${name}
        </h3>


        ${
          brewery
            ? `
              <p class="review-brewery">
                ${brewery}
              </p>
            `
            : ""
        }


        ${
          locationText
            ? `
              <p class="review-location">
                📍 ${locationText}
              </p>
            `
            : ""
        }


        ${
          price
            ? `
              <p class="review-price">
                🍺 ${price}
              </p>
            `
            : ""
        }


        ${
          reviewText
            ? `
              <p class="review-copy">
                ${reviewText}
              </p>
            `
            : ""
        }


        <div class="score-row">

          <span class="score-badge">
            ${score}/10
          </span>

          <span class="buy-again">

            ${
              buyAgain
                ? "✓ I'd have another"
                : "✕ One and done"
            }

          </span>

        </div>


        ${
          venue &&
          venue.name
            ? `
              <a
                class="review-venue-link"
                href="#${createVenueId(venue)}"
              >
                View ${escapeHtml(venue.name)} ↓
              </a>
            `
            : ""
        }

      </div>

    </article>
  `;
}


// ================================================================
// REVIEW ERROR
// ================================================================

function renderReviewError() {
  if (!DOM.reviewsGrid) {
    return;
  }


  DOM.reviewsGrid.innerHTML = `
    <div class="empty-state">

      <strong>
        Couldn't load the beer reviews.
      </strong>

      <p>
        Check data/reviews.json and refresh the page.
      </p>

    </div>
  `;
}


// ================================================================
// REVIEW STATISTICS
// ================================================================

function renderReviewStatistics() {
  const reviews =
    state.reviews;


  if (DOM.reviewCount) {
    DOM.reviewCount.textContent =
      String(
        reviews.length
      );
  }


  const scores =
    reviews
      .map(
        review =>
          Number(
            review.score
          )
      )
      .filter(
        score =>
          Number.isFinite(score)
      );


  if (!DOM.averageScore) {
    return;
  }


  if (scores.length === 0) {
    DOM.averageScore.textContent =
      "0.0";

    return;
  }


  const total =
    scores.reduce(
      (sum, score) =>
        sum + score,
      0
    );


  DOM.averageScore.textContent =
    (
      total /
      scores.length
    ).toFixed(1);
}


// ================================================================
// VENUES
// ================================================================

function renderVenues() {
  if (!DOM.venuesGrid) {
    return;
  }


  const venues =
    buildVenueCollection(
      state.reviews
    );


  if (venues.length === 0) {
    DOM.venuesGrid.innerHTML = `
      <div class="empty-state">
        Venue reviews will appear here as they're added.
      </div>
    `;

    return;
  }


  DOM.venuesGrid.innerHTML =
    venues
      .map(
        venue =>
          createVenueCard(
            venue
          )
      )
      .join("");
}


function buildVenueCollection(
  reviews
) {
  const venues =
    new Map();


  reviews.forEach(
    (review, reviewIndex) => {
      const venue =
        getVenue(
          review
        );


      if (
        !venue ||
        !venue.name
      ) {
        return;
      }


      const key =
        createVenueKey(
          venue,
          review
        );


      if (!venues.has(key)) {
        venues.set(
          key,
          {
            name:
              venue.name,

            location:
              venue.location ||
              review.location ||
              "",

            country:
              review.country ||
              "",

            coordinates:
              getCoordinates(
                venue
              ),

            reviews: [],

            venueData: []
          }
        );
      }


      const entry =
        venues.get(key);


      entry.reviews.push({
        review,
        reviewIndex
      });


      entry.venueData.push(
        venue
      );
    }
  );


  return Array.from(
    venues.values()
  );
}


function createVenueCard(
  venueGroup
) {
  const representative =
    getBestVenueData(
      venueGroup.venueData
    );


  const name =
    escapeHtml(
      venueGroup.name
    );


  const location =
    escapeHtml(
      venueGroup.location
    );


  const country =
    escapeHtml(
      venueGroup.country
    );


  const locationText =
    [
      location,
      country
    ]
      .filter(Boolean)
      .join(", ");


  const priceScore =
    optionalScore(
      representative.price
    );


  const pourScore =
    optionalScore(
      representative.pour
    );


  const venueScore =
    optionalScore(
      representative.venue
    );


  const overall =
    calculateVenueOverall(
      representative
    );


  const venueReview =
    escapeHtml(
      representative.review ||
      ""
    );


  const wouldReturn =
    representative.wouldReturn;


  const pricePaid =
    getVenuePrice(
      representative
    );


  const beerCount =
    venueGroup.reviews.length;


  const beerNames =
    venueGroup.reviews
      .map(
        item =>
          escapeHtml(
            item.review.name ||
            "Unknown beer"
          )
      );


  return `
    <article
      id="${createVenueId(representative)}"
      class="venue-card"
    >

      <div class="venue-card-head">

        <div>

          <h3>
            ${name}
          </h3>


          ${
            locationText
              ? `
                <div class="venue-location">
                  📍 ${locationText}
                </div>
              `
              : ""
          }


          <div class="venue-location">

            🍺 ${beerCount}

            ${
              beerCount === 1
                ? "beer reviewed"
                : "beers reviewed"
            }

          </div>

        </div>


        ${
          overall !== null
            ? `
              <div class="venue-overall">

                <strong>
                  ${overall}
                </strong>

                <span>
                  overall
                </span>

              </div>
            `
            : ""
        }

      </div>


      ${
        pricePaid
          ? `
            <div class="venue-review">

              <span class="venue-price-paid">
                Pint paid: ${pricePaid}
              </span>

            </div>
          `
          : ""
      }


      ${
        (
          priceScore !== null ||
          pourScore !== null ||
          venueScore !== null
        )
          ? `
            <div class="venue-scores">

              ${createVenueScore(
                "Price",
                priceScore
              )}

              ${createVenueScore(
                "Pour",
                pourScore
              )}

              ${createVenueScore(
                "Venue",
                venueScore
              )}

            </div>
          `
          : ""
      }


      <div class="venue-review">

        ${
          venueReview
            ? `
              <p>
                ${venueReview}
              </p>
            `
            : `
              <p>
                Beers tried here:
                ${beerNames.join(", ")}.
              </p>
            `
        }


        ${
          typeof wouldReturn ===
          "boolean"
            ? `
              <span class="venue-verdict">

                ${
                  wouldReturn
                    ? "✓ Would return"
                    : "✕ Wouldn't rush back"
                }

              </span>
            `
            : ""
        }

      </div>

    </article>
  `;
}


function createVenueScore(
  label,
  score
) {
  if (score === null) {
    return "";
  }


  return `
    <div class="venue-score">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${score}/10
      </strong>

    </div>
  `;
}


function getVenue(
  review
) {
  if (
    review &&
    review.venue &&
    typeof review.venue === "object"
  ) {
    return review.venue;
  }


  return null;
}


function getBestVenueData(
  venueData
) {
  if (
    !Array.isArray(venueData) ||
    venueData.length === 0
  ) {
    return {};
  }


  return [...venueData]
    .sort(
      (a, b) =>
        venueCompletenessScore(b) -
        venueCompletenessScore(a)
    )[0];
}


function venueCompletenessScore(
  venue
) {
  let score = 0;


  if (venue.name) {
    score += 1;
  }


  if (venue.location) {
    score += 1;
  }


  if (
    optionalScore(
      venue.price
    ) !== null
  ) {
    score += 1;
  }


  if (
    optionalScore(
      venue.pour
    ) !== null
  ) {
    score += 1;
  }


  if (
    optionalScore(
      venue.venue
    ) !== null
  ) {
    score += 1;
  }


  if (venue.review) {
    score += 1;
  }


  if (
    getCoordinates(
      venue
    )
  ) {
    score += 1;
  }


  return score;
}


function calculateVenueOverall(
  venue
) {
  const scores =
    [
      optionalScore(
        venue.price
      ),

      optionalScore(
        venue.pour
      ),

      optionalScore(
        venue.venue
      )
    ]
      .filter(
        value =>
          value !== null
      );


  if (scores.length === 0) {
    return null;
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
// PINT MAP
// ================================================================

async function initialisePintMap() {
  if (!DOM.pintMap) {
    console.warn(
      "[KirkDrinks] #pint-map not found."
    );

    return;
  }


  const locations =
    buildMapLocations(
      state.reviews
    );


  if (DOM.locationCount) {
    DOM.locationCount.textContent =
      String(
        locations.length
      );
  }


  /*
   * Don't request MapLibre when there are no coordinates.
   */

  if (locations.length === 0) {
    showMapUnavailable(
      "No places pinned yet — add coordinates to a venue and its pint marker will appear here."
    );

    return;
  }


  /*
   * MapLibre remains dynamically imported so failure cannot
   * interfere with the core site.
   */

  let mapModule;


  try {
    console.info(
      "[KirkDrinks] Loading MapLibre..."
    );


    mapModule =
      await import(
        CONFIG.mapLibreModuleUrl
      );

  } catch (error) {
    console.error(
      "[KirkDrinks] MapLibre import blocked or unavailable:",
      error
    );


    showMapUnavailable(
      "The pint map is currently unavailable. Beer reviews are still working."
    );


    return;
  }


  const maplibregl =
    mapModule.default ||
    mapModule;


  if (
    !maplibregl ||
    typeof maplibregl.Map !==
    "function"
  ) {
    console.error(
      "[KirkDrinks] MapLibre module loaded but Map constructor was unavailable."
    );


    showMapUnavailable(
      "The pint map is currently unavailable. Beer reviews are still working."
    );


    return;
  }


  state.maplibregl =
    maplibregl;


  hideMapUnavailable();


  try {
    state.map =
      new maplibregl.Map({
        container:
          DOM.pintMap,

        style:
          CONFIG.mapStyleUrl,

        center: [
          locations[0].lng,
          locations[0].lat
        ],

        zoom: 4,

        attributionControl:
          true
      });


    state.map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false
      }),
      "top-right"
    );


    const bounds =
      new maplibregl.LngLatBounds();


    locations.forEach(
      location => {
        bounds.extend([
          location.lng,
          location.lat
        ]);
      }
    );


    /*
     * Sources and layers must be added once the map style is ready.
     */

    state.map.once(
      "load",
      () => {
        addClusteredPintLayer(
          locations
        );


        if (
          locations.length > 1
        ) {
          state.map.fitBounds(
            bounds,
            {
              padding: 60,
              maxZoom: 12,
              duration: 0
            }
          );

        } else {
          state.map.setCenter([
            locations[0].lng,
            locations[0].lat
          ]);


          state.map.setZoom(11);
        }
      }
    );


    state.map.on(
      "error",
      event => {
        console.error(
          "[KirkDrinks] MapLibre runtime error:",
          event.error ||
          event
        );
      }
    );


    if (DOM.mapStatus) {
      DOM.mapStatus.textContent =
        `${locations.length} ${
          locations.length === 1
            ? "place"
            : "places"
        } pinned so far.`;
    }


    console.info(
      `[KirkDrinks] Pint map initialising with ${locations.length} venue locations.`
    );

  } catch (error) {
    console.error(
      "[KirkDrinks] Map creation failed:",
      error
    );


    showMapUnavailable(
      "The pint map couldn't be loaded. Beer reviews are still available."
    );
  }
}


// ================================================================
// MAP LOCATIONS
// ================================================================

function buildMapLocations(
  reviews
) {
  const locations =
    new Map();


  reviews.forEach(
    (review, reviewIndex) => {
      const venue =
        getVenue(
          review
        );


      if (!venue) {
        return;
      }


      const coordinates =
        getCoordinates(
          venue
        );


      if (!coordinates) {
        return;
      }


      const venueName =
        venue.name ||
        "Unknown venue";


      /*
       * Reviews from the exact same venue are consolidated BEFORE
       * geographic clustering.
       *
       * This means five beers at The Ale House become one venue
       * point containing five beer reviews.
       */

      const key =
        [
          venueName
            .trim()
            .toLowerCase(),

          coordinates.lat
            .toFixed(5),

          coordinates.lng
            .toFixed(5)
        ].join("|");


      if (!locations.has(key)) {
        locations.set(
          key,
          {
            venueName,

            location:
              venue.location ||
              review.location ||
              "",

            country:
              review.country ||
              "",

            lat:
              coordinates.lat,

            lng:
              coordinates.lng,

            reviews: []
          }
        );
      }


      locations
        .get(key)
        .reviews
        .push({
          review,
          reviewIndex
        });
    }
  );


  return Array.from(
    locations.values()
  );
}


function getCoordinates(
  venue
) {
  if (
    !venue ||
    !venue.coordinates ||
    typeof venue.coordinates !==
    "object"
  ) {
    return null;
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
    return null;
  }


  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }


  return {
    lat,
    lng
  };
}


// ================================================================
// MAP CLUSTERING
// ================================================================

function addClusteredPintLayer(
  locations
) {
  if (
    !state.map ||
    !state.maplibregl
  ) {
    return;
  }


  /*
   * Convert our venue collection into GeoJSON.
   *
   * Each feature represents ONE VENUE rather than one beer.
   */

  const geoJson = {
    type:
      "FeatureCollection",

    features:
      locations.map(
        (location, index) => ({
          type:
            "Feature",

          geometry: {
            type:
              "Point",

            coordinates: [
              location.lng,
              location.lat
            ]
          },

          properties: {
            locationIndex:
              index,

            venueName:
              location.venueName,

            beerCount:
              location.reviews.length
          }
        })
      )
  };


  /*
   * Native MapLibre GeoJSON clustering.
   *
   * Nearby venues are grouped together until the user zooms in.
   */

  state.map.addSource(
    "pint-locations",
    {
      type:
        "geojson",

      data:
        geoJson,

      cluster:
        true,

      clusterMaxZoom:
        13,

      clusterRadius:
        50
    }
  );


  /*
   * --------------------------------------------------------------
   * CLUSTER CIRCLES
   * --------------------------------------------------------------
   */

  state.map.addLayer({
    id:
      "pint-clusters",

    type:
      "circle",

    source:
      "pint-locations",

    filter: [
      "has",
      "point_count"
    ],

    paint: {
      "circle-radius": [
        "step",

        [
          "get",
          "point_count"
        ],

        22,

        5,
        26,

        10,
        30,

        25,
        34
      ],

      "circle-color":
        "#f4b942",

      "circle-stroke-width":
        3,

      "circle-stroke-color":
        "#ffffff"
    }
  });


  /*
   * Cluster count.
   *
   * This number represents nearby VENUES.
   */

  state.map.addLayer({
    id:
      "pint-cluster-count",

    type:
      "symbol",

    source:
      "pint-locations",

    filter: [
      "has",
      "point_count"
    ],

    layout: {
      "text-field": [
        "concat",

        "🍺 ",

        [
          "get",
          "point_count_abbreviated"
        ]
      ],

      "text-size":
        15,

      "text-allow-overlap":
        true
    },

    paint: {
      "text-color":
        "#111111"
    }
  });


  /*
   * --------------------------------------------------------------
   * INDIVIDUAL VENUE CIRCLES
   * --------------------------------------------------------------
   */

  state.map.addLayer({
    id:
      "pint-venues",

    type:
      "circle",

    source:
      "pint-locations",

    filter: [
      "!",
      [
        "has",
        "point_count"
      ]
    ],

    paint: {
      "circle-radius": [
        "case",

        [
          ">",
          [
            "get",
            "beerCount"
          ],
          1
        ],

        19,

        17
      ],

      "circle-color":
        "#f4b942",

      "circle-stroke-width":
        3,

      "circle-stroke-color":
        "#ffffff"
    }
  });


  /*
   * Individual venue label.
   *
   * One beer:
   *
   * 🍺
   *
   * Multiple beers at the same venue:
   *
   * 🍺 5
   */

  state.map.addLayer({
    id:
      "pint-venue-labels",

    type:
      "symbol",

    source:
      "pint-locations",

    filter: [
      "!",
      [
        "has",
        "point_count"
      ]
    ],

    layout: {
      "text-field": [
        "case",

        [
          ">",
          [
            "get",
            "beerCount"
          ],
          1
        ],

        [
          "concat",

          "🍺 ",

          [
            "to-string",
            [
              "get",
              "beerCount"
            ]
          ]
        ],

        "🍺"
      ],

      "text-size":
        14,

      "text-allow-overlap":
        true
    },

    paint: {
      "text-color":
        "#111111"
    }
  });


  /*
   * --------------------------------------------------------------
   * CLUSTER CLICK
   * --------------------------------------------------------------
   *
   * Clicking a cluster calculates the zoom required to split that
   * cluster into its children.
   */

  state.map.on(
    "click",
    "pint-clusters",
    async event => {
      const features =
        state.map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              "pint-clusters"
            ]
          }
        );


      const feature =
        features[0];


      if (
        !feature ||
        !feature.properties
      ) {
        return;
      }


      const clusterId =
        feature.properties.cluster_id;


      if (
        clusterId === undefined ||
        clusterId === null
      ) {
        return;
      }


      try {
        const source =
          state.map.getSource(
            "pint-locations"
          );


        const zoom =
          await source
            .getClusterExpansionZoom(
              clusterId
            );


        state.map.easeTo({
          center:
            feature.geometry.coordinates,

          zoom:
            zoom
        });

      } catch (error) {
        console.error(
          "[KirkDrinks] Couldn't expand map cluster:",
          error
        );
      }
    }
  );


  /*
   * --------------------------------------------------------------
   * VENUE CLICK
   * --------------------------------------------------------------
   */

  state.map.on(
    "click",
    "pint-venues",
    event => {
      openVenueMapPopup(
        event,
        locations
      );
    }
  );


  /*
   * Symbol labels can receive the click instead of the underlying
   * circle, so both layers intentionally open the same popup.
   */

  state.map.on(
    "click",
    "pint-venue-labels",
    event => {
      openVenueMapPopup(
        event,
        locations
      );
    }
  );


  /*
   * --------------------------------------------------------------
   * CURSOR FEEDBACK
   * --------------------------------------------------------------
   */

  [
    "pint-clusters",
    "pint-cluster-count",
    "pint-venues",
    "pint-venue-labels"
  ]
    .forEach(
      layerId => {
        state.map.on(
          "mouseenter",
          layerId,
          () => {
            state.map
              .getCanvas()
              .style.cursor =
                "pointer";
          }
        );


        state.map.on(
          "mouseleave",
          layerId,
          () => {
            state.map
              .getCanvas()
              .style.cursor =
                "";
          }
        );
      }
    );


  /*
   * The count text sits on top of the cluster circle.
   *
   * Give the text layer the same zoom behaviour so clicking
   * directly on the number also expands the cluster.
   */

  state.map.on(
    "click",
    "pint-cluster-count",
    async event => {
      const feature =
        event.features &&
        event.features[0];


      if (
        !feature ||
        !feature.properties
      ) {
        return;
      }


      const clusterId =
        feature.properties.cluster_id;


      if (
        clusterId === undefined ||
        clusterId === null
      ) {
        return;
      }


      try {
        const source =
          state.map.getSource(
            "pint-locations"
          );


        const zoom =
          await source
            .getClusterExpansionZoom(
              clusterId
            );


        state.map.easeTo({
          center:
            feature.geometry.coordinates,

          zoom:
            zoom
        });

      } catch (error) {
        console.error(
          "[KirkDrinks] Couldn't expand map cluster:",
          error
        );
      }
    }
  );


  console.info(
    `[KirkDrinks] Native clustering enabled for ${locations.length} venues.`
  );
}


// ================================================================
// MAP VENUE POPUP
// ================================================================

function openVenueMapPopup(
  event,
  locations
) {
  if (
    !event ||
    !event.features ||
    event.features.length === 0
  ) {
    return;
  }


  const feature =
    event.features[0];


  const locationIndex =
    Number(
      feature.properties
        ?.locationIndex
    );


  if (
    !Number.isInteger(
      locationIndex
    ) ||
    !locations[
      locationIndex
    ]
  ) {
    console.warn(
      "[KirkDrinks] Map venue had an invalid location index."
    );

    return;
  }


  const location =
    locations[
      locationIndex
    ];


  const coordinates =
    feature.geometry.coordinates
      .slice();


  /*
   * Correct longitude wrapping around the international date line.
   */

  while (
    Math.abs(
      event.lngLat.lng -
      coordinates[0]
    ) > 180
  ) {
    coordinates[0] +=
      event.lngLat.lng >
      coordinates[0]
        ? 360
        : -360;
  }


  new state.maplibregl.Popup({
    offset:
      24,

    maxWidth:
      "320px"
  })
    .setLngLat(
      coordinates
    )
    .setHTML(
      createMapPopup(
        location
      )
    )
    .addTo(
      state.map
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


  const place =
    [
      escapeHtml(
        location.location
      ),

      escapeHtml(
        location.country
      )
    ]
      .filter(Boolean)
      .join(", ");


  const beers =
    location.reviews
      .map(
        item => {
          const name =
            escapeHtml(
              item.review.name ||
              "Mystery pint"
            );


          const score =
            formatScore(
              item.review.score
            );


          return `
            <div>

              <span>
                ${name}
              </span>

              <strong>
                ${score}/10
              </strong>

            </div>
          `;
        }
      )
      .join("");


  return `
    <div class="map-popup">

      <strong class="map-popup-title">
        ${venueName}
      </strong>


      ${
        place
          ? `
            <span class="map-popup-place">
              📍 ${place}
            </span>
          `
          : ""
      }


      <span class="map-popup-count">

        ${location.reviews.length}

        ${
          location.reviews.length === 1
            ? "beer reviewed"
            : "beers reviewed"
        }

      </span>


      <div class="map-popup-beers">
        ${beers}
      </div>


      <a
        href="#review-${location.reviews[0].reviewIndex}"
      >
        Jump to review ↓
      </a>

    </div>
  `;
}


// ================================================================
// MAP FALLBACK
// ================================================================

function showMapUnavailable(
  message
) {
  if (DOM.pintMap) {
    DOM.pintMap.hidden =
      true;
  }


  if (DOM.mapEmpty) {
    DOM.mapEmpty.hidden =
      false;
  }


  if (DOM.mapStatus) {
    DOM.mapStatus.textContent =
      message;
  }
}


function hideMapUnavailable() {
  if (DOM.pintMap) {
    DOM.pintMap.hidden =
      false;
  }


  if (DOM.mapEmpty) {
    DOM.mapEmpty.hidden =
      true;
  }
}


// ================================================================
// GALLERY
// ================================================================

async function initialiseGallery() {
  if (!DOM.galleryGrid) {
    return;
  }


  try {
    const data =
      await fetchJson(
        CONFIG.galleryUrl
      );


    if (!Array.isArray(data)) {
      throw new Error(
        "gallery.json must contain a JSON array."
      );
    }


    state.gallery =
      data.filter(
        item =>
          item &&
          typeof item === "object"
      );


    renderGallery();

  } catch (error) {
    console.warn(
      "[KirkDrinks] Gallery unavailable:",
      error
    );


    DOM.galleryGrid.innerHTML = `
      <div class="empty-state">
        Beer Cam currently unavailable.
      </div>
    `;
  }
}


function renderGallery() {
  if (!DOM.galleryGrid) {
    return;
  }


  if (state.gallery.length === 0) {
    DOM.galleryGrid.innerHTML = `
      <div class="empty-state">
        Beer Cam coming soon.
      </div>
    `;

    return;
  }


  DOM.galleryGrid.innerHTML =
    state.gallery
      .map(
        item => {
          const image =
            safeAssetPath(
              item.image
            );


          if (!image) {
            return "";
          }


          const alt =
            escapeHtml(
              item.alt ||
              item.caption ||
              "Beer photo"
            );


          const caption =
            escapeHtml(
              item.caption ||
              ""
            );


          return `
            <figure class="gallery-item">

              <img
                src="${image}"
                alt="${alt}"
                loading="lazy"
                decoding="async"
              >

              ${
                caption
                  ? `
                    <figcaption class="gallery-caption">
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

async function initialiseSupporters() {
  try {
    const data =
      await fetchJson(
        CONFIG.supportersApiUrl
      );


    const parsed =
      normaliseSupporterResponse(
        data
      );


    state.supporters =
      parsed.supporters;


    renderSupporters(
      parsed.totalBeers
    );

  } catch (error) {
    console.warn(
      "[KirkDrinks] Live supporter API unavailable. Trying fallback:",
      error
    );


    await loadSupporterFallback();
  }
}


async function loadSupporterFallback() {
  try {
    const data =
      await fetchJson(
        CONFIG.supportersFallbackUrl
      );


    const parsed =
      normaliseSupporterResponse(
        data
      );


    state.supporters =
      parsed.supporters;


    renderSupporters(
      parsed.totalBeers
    );

  } catch (error) {
    console.error(
      "[KirkDrinks] Supporter fallback failed:",
      error
    );


    state.supporters = [];


    renderSupporters(0);
  }
}


function normaliseSupporterResponse(
  data
) {
  if (Array.isArray(data)) {
    return {
      supporters:
        data.filter(
          supporter =>
            supporter &&
            typeof supporter ===
            "object"
        ),

      totalBeers:
        null
    };
  }


  if (
    data &&
    typeof data === "object" &&
    Array.isArray(
      data.supporters
    )
  ) {
    return {
      supporters:
        data.supporters.filter(
          supporter =>
            supporter &&
            typeof supporter ===
            "object"
        ),

      totalBeers:
        Number.isFinite(
          Number(
            data.totalBeers
          )
        )
          ? Number(
              data.totalBeers
            )
          : null
    };
  }


  throw new Error(
    "Unexpected supporter response."
  );
}


function renderSupporters(
  suppliedTotal = null
) {
  const supporters =
    state.supporters;


  if (DOM.supportersGrid) {
    if (supporters.length === 0) {
      DOM.supportersGrid.innerHTML = `
        <div class="empty-state">

          <strong>
            No funded pints yet.
          </strong>

          <p>
            Somebody has to become the first legend.
          </p>

        </div>
      `;

    } else {
      DOM.supportersGrid.innerHTML =
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


  const calculatedTotal =
    supporters.reduce(
      (total, supporter) =>
        total +
        getSupporterBeerCount(
          supporter
        ),
      0
    );


  const total =
    suppliedTotal !== null &&
    Number.isFinite(
      Number(
        suppliedTotal
      )
    )
      ? Number(
          suppliedTotal
        )
      : calculatedTotal;


  if (DOM.fundedCount) {
    DOM.fundedCount.textContent =
      String(total);
  }


  if (DOM.supporterCount) {
    DOM.supporterCount.textContent =
      String(total);
  }


  updateBeerMeter(
    total
  );
}


function createSupporterCard(
  supporter
) {
  const name =
    escapeHtml(
      supporter.name ||
      supporter.supporter_name ||
      "Anonymous legend"
    );


  const message =
    escapeHtml(
      supporter.message ||
      supporter.note ||
      supporter.support_note ||
      ""
    );


  const beers =
    getSupporterBeerCount(
      supporter
    );


  return `
    <article class="supporter">

      <div class="supporter-top">

        <strong>
          ${name}
        </strong>

        <span class="beers">
          🍺 × ${beers}
        </span>

      </div>


      ${
        message
          ? `
            <p>
              “${message}”
            </p>
          `
          : ""
      }

    </article>
  `;
}


function getSupporterBeerCount(
  supporter
) {
  const possibleValues = [
    supporter.beers,
    supporter.coffee_count,
    supporter.coffeeCount,
    supporter.quantity
  ];


  for (
    const value of
    possibleValues
  ) {
    const number =
      Number(value);


    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return Math.floor(
        number
      );
    }
  }


  return 1;
}


function updateBeerMeter(
  total
) {
  if (!DOM.beerMeterFill) {
    return;
  }


  if (total <= 0) {
    DOM.beerMeterFill.style.width =
      "0%";

    return;
  }


  const progress =
    total % 10;


  const percentage =
    progress === 0
      ? 100
      : progress * 10;


  DOM.beerMeterFill.style.width =
    `${percentage}%`;
}


// ================================================================
// NAVIGATION
// ================================================================

function initialiseNavigation() {
  if (
    !DOM.menuToggle ||
    !DOM.siteNav
  ) {
    return;
  }


  DOM.menuToggle.addEventListener(
    "click",
    () => {
      const isOpen =
        DOM.siteNav.classList
          .contains("open");


      DOM.siteNav.classList.toggle(
        "open",
        !isOpen
      );


      DOM.menuToggle.setAttribute(
        "aria-expanded",
        String(!isOpen)
      );
    }
  );


  DOM.siteNav
    .querySelectorAll("a")
    .forEach(
      link => {
        link.addEventListener(
          "click",
          () => {
            DOM.siteNav.classList.remove(
              "open"
            );


            DOM.menuToggle.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        );
      }
    );
}


// ================================================================
// FOOTER
// ================================================================

function initialiseFooter() {
  if (!DOM.year) {
    return;
  }


  DOM.year.textContent =
    String(
      new Date().getFullYear()
    );
}


// ================================================================
// FETCH
// ================================================================

async function fetchJson(
  url
) {
  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          "Accept":
            "application/json"
        },

        cache:
          "no-store"
      }
    );


  if (!response.ok) {
    throw new Error(
      `${url} returned HTTP ${response.status}`
    );
  }


  const text =
    await response.text();


  try {
    return JSON.parse(
      text
    );

  } catch (error) {
    console.error(
      `[KirkDrinks] Invalid JSON returned by ${url}:`,
      error
    );


    throw new Error(
      `${url} did not return valid JSON.`
    );
  }
}


// ================================================================
// PRICE
// ================================================================

function getReviewPrice(
  review
) {
  const venue =
    getVenue(
      review
    );


  const amount =
    venue &&
    venue.pricePaid !== undefined &&
    venue.pricePaid !== null
      ? venue.pricePaid
      : review.pricePaid;


  const currency =
    venue &&
    venue.currency
      ? venue.currency
      : review.currency;


  return formatMoney(
    amount,
    currency
  );
}


function getVenuePrice(
  venue
) {
  return formatMoney(
    venue.pricePaid,
    venue.currency
  );
}


function formatMoney(
  amount,
  currency
) {
  if (
    amount === null ||
    amount === undefined ||
    amount === ""
  ) {
    return "";
  }


  const number =
    Number(amount);


  if (!Number.isFinite(number)) {
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
        style:
          "currency",

        currency:
          currencyCode,

        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2
      }
    ).format(number);

  } catch {
    return `${number.toFixed(2)} ${currencyCode}`;
  }
}


// ================================================================
// SCORE
// ================================================================

function formatScore(
  value
) {
  const score =
    Number(value);


  if (!Number.isFinite(score)) {
    return "—";
  }


  return String(
    Math.round(
      score * 100
    ) / 100
  );
}


function optionalScore(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }


  const score =
    Number(value);


  if (
    !Number.isFinite(score) ||
    score < 0 ||
    score > 10
  ) {
    return null;
  }


  return score;
}


// ================================================================
// VENUE IDENTIFIERS
// ================================================================

function createVenueKey(
  venue,
  review
) {
  const name =
    String(
      venue.name ||
      ""
    )
      .trim()
      .toLowerCase();


  const location =
    String(
      venue.location ||
      review.location ||
      ""
    )
      .trim()
      .toLowerCase();


  return `${name}|${location}`;
}


function createVenueId(
  venue
) {
  const value =
    String(
      venue.name ||
      "venue"
    )
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );


  return `venue-${value || "unknown"}`;
}


// ================================================================
// ASSET VALIDATION
// ================================================================

function safeAssetPath(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }


  const path =
    value.trim();


  if (
    /^assets\/[A-Za-z0-9._/-]+$/.test(
      path
    )
  ) {
    return path;
  }


  return "";
}


// ================================================================
// HTML ESCAPING
// ================================================================

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
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
