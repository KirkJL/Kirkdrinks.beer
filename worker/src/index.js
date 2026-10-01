/**
 * KirkDrinks.beer API
 * Build: 2026-10-01-01
 *
 * Routes:
 * GET  /health
 * GET  /api/supporters
 * POST /webhooks/bmc
 *
 * Security:
 * - BMC HMAC-SHA256 signature verification
 * - Raw request body used for signature verification
 * - Secrets stored only in Cloudflare
 * - No supporter emails stored
 * - Hidden BMC notes are not stored/published
 * - Duplicate webhook protection through D1 UNIQUE constraint
 * - Public CORS restricted to KirkDrinks.beer
 *
 * Observability:
 * - Safe request logging
 * - Explicit build identifier
 * - No secrets, signatures, emails or raw payment payloads logged
 */

const BUILD_VERSION = "2026-10-01-01";

const BMC_EVENTS = new Set([
  "donation.created",
  "donation.refunded"
]);

const ALLOWED_ORIGINS = new Set([
  "https://kirkdrinks.beer",
  "https://www.kirkdrinks.beer"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    console.log("Request received", {
      build: BUILD_VERSION,
      method: request.method,
      path: url.pathname
    });

    try {

      // ==========================================================
      // HEALTH
      // ==========================================================

      if (
        request.method === "GET" &&
        url.pathname === "/health"
      ) {
        return jsonResponse({
          ok: true,
          service: "kirkdrinks-beer",
          build: BUILD_VERSION,
          database: Boolean(env.DB),
          webhookSecretConfigured:
            Boolean(env.BMC_WEBHOOK_SECRET),
          timestamp: new Date().toISOString()
        });
      }


      // ==========================================================
      // PUBLIC SUPPORTERS API
      // ==========================================================

      if (
        request.method === "GET" &&
        url.pathname === "/api/supporters"
      ) {
        return handleSupporters(request, env);
      }


      // ==========================================================
      // BUY ME A COFFEE WEBHOOK
      // ==========================================================

      if (
        request.method === "POST" &&
        url.pathname === "/webhooks/bmc"
      ) {
        return handleBmcWebhook(request, env);
      }


      // ==========================================================
      // NOT FOUND
      // ==========================================================

      return jsonResponse(
        {
          error: "Not found",
          build: BUILD_VERSION
        },
        404
      );

    } catch (error) {

      console.error("Unhandled Worker error", {
        build: BUILD_VERSION,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      });

      return jsonResponse(
        {
          error: "Internal server error",
          build: BUILD_VERSION
        },
        500
      );
    }
  }
};


// ================================================================
// BMC WEBHOOK
// ================================================================

async function handleBmcWebhook(request, env) {

  if (!env.BMC_WEBHOOK_SECRET) {

    console.error("BMC webhook secret missing", {
      build: BUILD_VERSION
    });

    return jsonResponse(
      {
        error: "Webhook configuration error",
        build: BUILD_VERSION
      },
      500
    );
  }


  if (!env.DB) {

    console.error("D1 binding missing", {
      build: BUILD_VERSION
    });

    return jsonResponse(
      {
        error: "Database configuration error",
        build: BUILD_VERSION
      },
      500
    );
  }


  const suppliedSignature =
    request.headers.get("x-signature-sha256");


  if (!suppliedSignature) {

    console.warn("BMC webhook rejected: missing signature", {
      build: BUILD_VERSION
    });

    return jsonResponse(
      {
        error: "Missing webhook signature",
        build: BUILD_VERSION
      },
      401
    );
  }


  /*
   * IMPORTANT:
   *
   * Signature verification MUST happen against the exact raw body.
   * Do not parse JSON before this step.
   */

  const rawBody = await request.text();


  const validSignature = await verifyHmacSha256(
    rawBody,
    env.BMC_WEBHOOK_SECRET,
    suppliedSignature
  );


  if (!validSignature) {

    console.warn("BMC webhook rejected: invalid signature", {
      build: BUILD_VERSION
    });

    return jsonResponse(
      {
        error: "Invalid webhook signature",
        build: BUILD_VERSION
      },
      401
    );
  }


  let event;


  try {

    event = JSON.parse(rawBody);

  } catch {

    console.warn("BMC webhook rejected: invalid JSON", {
      build: BUILD_VERSION
    });

    return jsonResponse(
      {
        error: "Invalid JSON payload",
        build: BUILD_VERSION
      },
      400
    );
  }


  if (
    !event ||
    event.event_id === undefined ||
    typeof event.type !== "string" ||
    !event.data ||
    typeof event.data !== "object"
  ) {

    console.warn("BMC webhook rejected: malformed payload", {
      build: BUILD_VERSION
    });

    return jsonResponse(
      {
        error: "Invalid webhook payload",
        build: BUILD_VERSION
      },
      400
    );
  }


  console.log("Verified BMC webhook", {
    build: BUILD_VERSION,
    eventId: String(event.event_id),
    eventType: event.type,
    liveMode: event.live_mode === true,
    attempt: event.attempt ?? null
  });


  if (!BMC_EVENTS.has(event.type)) {

    console.log("Ignoring unsupported BMC event", {
      build: BUILD_VERSION,
      eventType: event.type
    });

    return jsonResponse({
      ok: true,
      ignored: true,
      build: BUILD_VERSION
    });
  }


  if (event.type === "donation.created") {

    return handleDonationCreated(
      event,
      env
    );
  }


  if (event.type === "donation.refunded") {

    return handleDonationRefunded(
      event,
      env
    );
  }


  return jsonResponse({
    ok: true,
    ignored: true,
    build: BUILD_VERSION
  });
}


// ================================================================
// DONATION CREATED
// ================================================================

async function handleDonationCreated(event, env) {

  const data = event.data;


  /*
   * BMC dashboard test events have live_mode=false.
   *
   * We validate them but NEVER insert them into the production
   * supporter database.
   */

  if (event.live_mode !== true) {

    console.log("BMC test donation accepted", {
      build: BUILD_VERSION,
      eventId: String(event.event_id)
    });

    return jsonResponse({
      ok: true,
      received: true,
      test: true,
      stored: false,
      eventId: String(event.event_id),
      eventType: event.type,
      build: BUILD_VERSION
    });
  }


  if (data.status !== "succeeded") {

    console.log("Ignoring unsuccessful BMC payment", {
      build: BUILD_VERSION,
      eventId: String(event.event_id),
      status: data.status ?? "unknown"
    });

    return jsonResponse({
      ok: true,
      ignored: true,
      reason: "Payment not succeeded",
      build: BUILD_VERSION
    });
  }


  const eventId =
    String(event.event_id);


  const supporterName =
    cleanText(
      data.supporter_name ||
      "Anonymous legend",
      80
    );


  /*
   * BMC currently supplies note_hidden as a string in the observed
   * webhook payload.
   *
   * Handle both string and boolean representations safely.
   */

  const noteHidden =
    data.note_hidden === true ||
    String(data.note_hidden).toLowerCase() === "true";


  const supporterMessage =
    noteHidden
      ? null
      : cleanText(
          data.support_note || "",
          500
        );


  const amount =
    Number(data.amount);


  const amountMinor =
    Number.isFinite(amount)
      ? Math.round(amount * 100)
      : 0;


  const currency =
    normaliseCurrency(data.currency);


  const coffeeCount =
    Number(data.coffee_count);


  const beers =
    Number.isInteger(coffeeCount) &&
    coffeeCount > 0
      ? Math.min(coffeeCount, 100)
      : 1;


  const createdAt =
    unixToIso(
      data.created_at ||
      event.created
    );


  if (amountMinor <= 0) {

    console.warn("BMC donation rejected: invalid amount", {
      build: BUILD_VERSION,
      eventId
    });

    return jsonResponse(
      {
        error: "Invalid donation amount",
        build: BUILD_VERSION
      },
      400
    );
  }


  try {

    await env.DB
      .prepare(`
        INSERT INTO donations (
          provider,
          provider_event_id,
          supporter_name,
          message,
          amount_minor,
          currency,
          beers,
          status,
          approved,
          created_at
        )
        VALUES (
          'buymeacoffee',
          ?1,
          ?2,
          ?3,
          ?4,
          ?5,
          ?6,
          'active',
          1,
          ?7
        )
      `)
      .bind(
        eventId,
        supporterName,
        supporterMessage,
        amountMinor,
        currency,
        beers,
        createdAt
      )
      .run();


  } catch (error) {

    if (isUniqueConstraintError(error)) {

      console.log("Duplicate BMC event ignored", {
        build: BUILD_VERSION,
        eventId
      });

      return jsonResponse({
        ok: true,
        received: true,
        duplicate: true,
        eventId,
        build: BUILD_VERSION
      });
    }


    throw error;
  }


  console.log("BMC donation stored", {
    build: BUILD_VERSION,
    eventId,
    beers,
    currency
  });


  return jsonResponse({
    ok: true,
    received: true,
    stored: true,
    eventId,
    build: BUILD_VERSION
  });
}


// ================================================================
// DONATION REFUNDED
// ================================================================

async function handleDonationRefunded(event, env) {

  const data = event.data;


  if (event.live_mode !== true) {

    console.log("BMC test refund accepted", {
      build: BUILD_VERSION,
      eventId: String(event.event_id)
    });

    return jsonResponse({
      ok: true,
      received: true,
      test: true,
      stored: false,
      eventId: String(event.event_id),
      eventType: event.type,
      build: BUILD_VERSION
    });
  }


  /*
   * We haven't yet observed BMC's real refund payload.
   *
   * Do NOT guess which field identifies the original donation.
   * We acknowledge the webhook safely until that payload has been
   * confirmed.
   */

  console.warn("Live refund received but mapping not finalised", {
    build: BUILD_VERSION,
    eventId: String(event.event_id)
  });


  return jsonResponse({
    ok: true,
    received: true,
    refundAcknowledged: true,
    mappingPending: true,
    build: BUILD_VERSION
  });
}


// ================================================================
// PUBLIC SUPPORTER API
// ================================================================

async function handleSupporters(request, env) {

  if (!env.DB) {

    return jsonResponse(
      {
        error: "Database unavailable",
        build: BUILD_VERSION
      },
      500
    );
  }


  const result =
    await env.DB
      .prepare(`
        SELECT
          supporter_name,
          message,
          beers,
          amount_minor,
          currency,
          created_at
        FROM donations
        WHERE status = 'active'
          AND approved = 1
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .all();


  const supporters =
    (result.results || [])
      .map(row => ({
        name: row.supporter_name,
        beers: row.beers,
        message: row.message || "",
        amount: row.amount_minor / 100,
        currency: row.currency,
        createdAt: row.created_at
      }));


  const totalBeers =
    supporters.reduce(
      (total, supporter) =>
        total +
        Number(supporter.beers || 0),
      0
    );


  console.log("Supporters API served", {
    build: BUILD_VERSION,
    supporterCount: supporters.length,
    totalBeers
  });


  return corsJsonResponse(
    request,
    {
      supporters,
      totalBeers,
      build: BUILD_VERSION
    },
    200
  );
}


// ================================================================
// HMAC-SHA256 VERIFICATION
// ================================================================

async function verifyHmacSha256(
  rawBody,
  secret,
  suppliedSignature
) {

  const encoder =
    new TextEncoder();


  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );


  const signatureBuffer =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );


  const expectedSignature =
    bufferToHex(signatureBuffer)
      .toLowerCase();


  const receivedSignature =
    suppliedSignature
      .trim()
      .toLowerCase();


  return timingSafeEqual(
    expectedSignature,
    receivedSignature
  );
}


function timingSafeEqual(a, b) {

  if (a.length !== b.length) {
    return false;
  }


  let difference = 0;


  for (
    let i = 0;
    i < a.length;
    i++
  ) {

    difference |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }


  return difference === 0;
}


function bufferToHex(buffer) {

  return [
    ...new Uint8Array(buffer)
  ]
    .map(byte =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}


// ================================================================
// INPUT NORMALISATION
// ================================================================

function cleanText(
  value,
  maxLength
) {

  if (typeof value !== "string") {
    return "";
  }


  return value
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .trim()
    .slice(
      0,
      maxLength
    );
}


function normaliseCurrency(value) {

  if (typeof value !== "string") {
    return "GBP";
  }


  const currency =
    value
      .trim()
      .toUpperCase();


  return /^[A-Z]{3}$/.test(currency)
    ? currency
    : "GBP";
}


function unixToIso(value) {

  const timestamp =
    Number(value);


  if (!Number.isFinite(timestamp)) {

    return new Date()
      .toISOString();
  }


  return new Date(
    timestamp * 1000
  )
    .toISOString();
}


function isUniqueConstraintError(error) {

  const message =
    error instanceof Error
      ? error.message
      : String(error);


  return (
    message.includes(
      "UNIQUE constraint failed"
    ) ||
    message.includes(
      "SQLITE_CONSTRAINT"
    )
  );
}


// ================================================================
// RESPONSES
// ================================================================

function jsonResponse(
  body,
  status = 200
) {

  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",

        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}


function corsJsonResponse(
  request,
  body,
  status = 200
) {

  const origin =
    request.headers.get("Origin");


  const headers = {
    "Content-Type":
      "application/json; charset=UTF-8",

    "Cache-Control":
      "public, max-age=60",

    "X-Content-Type-Options":
      "nosniff"
  };


  if (
    origin &&
    ALLOWED_ORIGINS.has(origin)
  ) {

    headers[
      "Access-Control-Allow-Origin"
    ] = origin;

    headers["Vary"] =
      "Origin";
  }


  return new Response(
    JSON.stringify(body),
    {
      status,
      headers
    }
  );
}
