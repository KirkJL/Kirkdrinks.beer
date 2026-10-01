/**
 * KirkDrinks.beer API
 *
 * Routes:
 * GET  /health
 * GET  /api/supporters
 * POST /webhooks/bmc
 *
 * Security:
 * - BMC webhook signatures verified using HMAC-SHA256.
 * - Signature verification uses the exact raw request body.
 * - Webhook secret exists only in Cloudflare.
 * - Email addresses and unnecessary payment metadata are NOT stored.
 * - Hidden supporter notes are never published.
 * - Duplicate webhook events are prevented by provider_event_id UNIQUE.
 */

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

    try {
      // ----------------------------------------------------------
      // HEALTH
      // ----------------------------------------------------------

      if (
        request.method === "GET" &&
        url.pathname === "/health"
      ) {
        return jsonResponse({
          ok: true,
          service: "kirkdrinks-beer",
          database: Boolean(env.DB),
          webhookSecretConfigured: Boolean(env.BMC_WEBHOOK_SECRET),
          timestamp: new Date().toISOString()
        });
      }

      // ----------------------------------------------------------
      // PUBLIC SUPPORTER API
      // ----------------------------------------------------------

      if (
        request.method === "GET" &&
        url.pathname === "/api/supporters"
      ) {
        return handleSupporters(request, env);
      }

      // ----------------------------------------------------------
      // BMC WEBHOOK
      // ----------------------------------------------------------

      if (
        request.method === "POST" &&
        url.pathname === "/webhooks/bmc"
      ) {
        return handleBmcWebhook(request, env);
      }

      return jsonResponse(
        { error: "Not found" },
        404
      );
    } catch (error) {
      console.error("Unhandled Worker error:", error);

      return jsonResponse(
        { error: "Internal server error" },
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
    console.error("BMC_WEBHOOK_SECRET missing.");

    return jsonResponse(
      { error: "Webhook configuration error" },
      500
    );
  }

  if (!env.DB) {
    console.error("D1 binding DB missing.");

    return jsonResponse(
      { error: "Database configuration error" },
      500
    );
  }

  const suppliedSignature =
    request.headers.get("x-signature-sha256");

  if (!suppliedSignature) {
    return jsonResponse(
      { error: "Missing webhook signature" },
      401
    );
  }

  /*
   * IMPORTANT:
   * Verify against the exact raw request body BEFORE JSON parsing.
   */
  const rawBody = await request.text();

  const validSignature = await verifyHmacSha256(
    rawBody,
    env.BMC_WEBHOOK_SECRET,
    suppliedSignature
  );

  if (!validSignature) {
    console.warn("Invalid BMC webhook signature.");

    return jsonResponse(
      { error: "Invalid webhook signature" },
      401
    );
  }

  let event;

  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      { error: "Invalid JSON payload" },
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
    return jsonResponse(
      { error: "Invalid webhook payload" },
      400
    );
  }

  if (!BMC_EVENTS.has(event.type)) {
    return jsonResponse({
      ok: true,
      ignored: true
    });
  }

  if (event.type === "donation.created") {
    return handleDonationCreated(event, env);
  }

  if (event.type === "donation.refunded") {
    return handleDonationRefunded(event, env);
  }

  return jsonResponse({
    ok: true,
    ignored: true
  });
}


// ================================================================
// DONATION CREATED
// ================================================================

async function handleDonationCreated(event, env) {
  const data = event.data;

  /*
   * Test events are useful for integration testing but should NEVER
   * become real supporters on the production website.
   */
  if (event.live_mode !== true) {
    return jsonResponse({
      ok: true,
      received: true,
      test: true,
      stored: false,
      eventId: String(event.event_id),
      eventType: event.type
    });
  }

  if (data.status !== "succeeded") {
    return jsonResponse({
      ok: true,
      ignored: true,
      reason: "Payment not succeeded"
    });
  }

  const eventId = String(event.event_id);

  const supporterName = cleanText(
    data.supporter_name || "Anonymous legend",
    80
  );

  /*
   * BMC sends note_hidden as a STRING in the observed payload.
   * Treat both boolean true and string "true" as hidden.
   */
  const noteHidden =
    data.note_hidden === true ||
    String(data.note_hidden).toLowerCase() === "true";

  const supporterMessage = noteHidden
    ? null
    : cleanText(data.support_note || "", 500);

  const amount = Number(data.amount);

  const amountMinor = Number.isFinite(amount)
    ? Math.round(amount * 100)
    : 0;

  const currency = normaliseCurrency(data.currency);

  const coffeeCount = Number(data.coffee_count);

  const beers =
    Number.isInteger(coffeeCount) && coffeeCount > 0
      ? Math.min(coffeeCount, 100)
      : 1;

  const createdAt = unixToIso(
    data.created_at || event.created
  );

  if (amountMinor <= 0) {
    return jsonResponse(
      { error: "Invalid donation amount" },
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
    /*
     * BMC can retry webhook deliveries.
     *
     * provider_event_id is UNIQUE, so a duplicate event cannot
     * create duplicate donations.
     */
    if (isUniqueConstraintError(error)) {
      return jsonResponse({
        ok: true,
        received: true,
        duplicate: true,
        eventId
      });
    }

    throw error;
  }

  return jsonResponse({
    ok: true,
    received: true,
    stored: true,
    eventId
  });
}


// ================================================================
// DONATION REFUNDED
// ================================================================

async function handleDonationRefunded(event, env) {
  const data = event.data;

  if (event.live_mode !== true) {
    return jsonResponse({
      ok: true,
      received: true,
      test: true,
      stored: false,
      eventId: String(event.event_id),
      eventType: event.type
    });
  }

  /*
   * We need a stable relationship back to the original donation.
   *
   * BMC refund payload structure can differ from donation.created.
   * Until we've observed a real/test refund payload, try the
   * identifiers BMC has already exposed without inventing data.
   */
  const possibleOriginalEventId =
    data.original_event_id ??
    data.event_id ??
    null;

  if (possibleOriginalEventId !== null) {
    await env.DB
      .prepare(`
        UPDATE donations
        SET status = 'refunded'
        WHERE provider = 'buymeacoffee'
          AND provider_event_id = ?1
      `)
      .bind(String(possibleOriginalEventId))
      .run();
  }

  return jsonResponse({
    ok: true,
    received: true,
    refundAcknowledged: true
  });
}


// ================================================================
// PUBLIC SUPPORTER API
// ================================================================

async function handleSupporters(request, env) {
  if (!env.DB) {
    return jsonResponse(
      { error: "Database unavailable" },
      500
    );
  }

  const result = await env.DB
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

  const supporters = (result.results || []).map(row => ({
    name: row.supporter_name,
    beers: row.beers,
    message: row.message || "",
    amount: row.amount_minor / 100,
    currency: row.currency,
    createdAt: row.created_at
  }));

  return corsJsonResponse(
    request,
    {
      supporters,
      totalBeers: supporters.reduce(
        (total, supporter) =>
          total + Number(supporter.beers || 0),
        0
      )
    },
    200
  );
}


// ================================================================
// HMAC VERIFICATION
// ================================================================

async function verifyHmacSha256(
  rawBody,
  secret,
  suppliedSignature
) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );

  const expectedSignature =
    bufferToHex(signatureBuffer).toLowerCase();

  const receivedSignature =
    suppliedSignature.trim().toLowerCase();

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

  for (let i = 0; i < a.length; i++) {
    difference |=
      a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}


function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(byte =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}


// ================================================================
// INPUT NORMALISATION
// ================================================================

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}


function normaliseCurrency(value) {
  if (typeof value !== "string") {
    return "GBP";
  }

  const currency = value
    .trim()
    .toUpperCase();

  return /^[A-Z]{3}$/.test(currency)
    ? currency
    : "GBP";
}


function unixToIso(value) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) {
    return new Date().toISOString();
  }

  return new Date(timestamp * 1000).toISOString();
}


function isUniqueConstraintError(error) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return (
    message.includes("UNIQUE constraint failed") ||
    message.includes("SQLITE_CONSTRAINT")
  );
}


// ================================================================
// RESPONSES / CORS
// ================================================================

function jsonResponse(body, status = 200) {
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
  const origin = request.headers.get("Origin");

  const headers = {
    "Content-Type":
      "application/json; charset=UTF-8",

    "Cache-Control":
      "public, max-age=60",

    "X-Content-Type-Options":
      "nosniff"
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] =
      origin;

    headers["Vary"] = "Origin";
  }

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers
    }
  );
}
