/**
 * KirkDrinks.beer API
 *
 * Routes:
 * GET  /health
 * POST /webhooks/bmc
 *
 * Security:
 * - BMC webhook signatures are verified using HMAC-SHA256.
 * - The raw request body is used for signature verification.
 * - The signing secret exists only in Cloudflare.
 * - Only known BMC event types are accepted.
 */

const BMC_EVENTS = new Set([
  "donation.created",
  "donation.refunded"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // ------------------------------------------------------------
      // HEALTH CHECK
      // ------------------------------------------------------------
      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({
          ok: true,
          service: "kirkdrinks-beer",
          database: Boolean(env.DB),
          webhookSecretConfigured: Boolean(env.BMC_WEBHOOK_SECRET),
          timestamp: new Date().toISOString()
        });
      }

      // ------------------------------------------------------------
      // BUY ME A COFFEE WEBHOOK
      // ------------------------------------------------------------
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


/**
 * Receive and authenticate a Buy Me a Coffee webhook.
 */
async function handleBmcWebhook(request, env) {
  if (!env.BMC_WEBHOOK_SECRET) {
    console.error("BMC_WEBHOOK_SECRET is not configured.");

    return jsonResponse(
      { error: "Webhook configuration error" },
      500
    );
  }

  if (!env.DB) {
    console.error("D1 binding DB is not configured.");

    return jsonResponse(
      { error: "Database configuration error" },
      500
    );
  }

  const signature = request.headers.get("x-signature-sha256");

  if (!signature) {
    return jsonResponse(
      { error: "Missing webhook signature" },
      401
    );
  }

  /*
   * IMPORTANT:
   * BMC requires the HMAC to be calculated from the exact RAW body.
   *
   * Do not call request.json() before verification.
   */
  const rawBody = await request.text();

  const signatureValid = await verifyHmacSha256(
    rawBody,
    env.BMC_WEBHOOK_SECRET,
    signature
  );

  if (!signatureValid) {
    console.warn("Rejected webhook with invalid signature.");

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
    typeof event.type !== "string"
  ) {
    return jsonResponse(
      { error: "Invalid webhook payload" },
      400
    );
  }

  if (!BMC_EVENTS.has(event.type)) {
    /*
     * Return 200 rather than causing BMC to retry an event
     * that this application intentionally doesn't process.
     */
    return jsonResponse({
      ok: true,
      ignored: true
    });
  }

  /*
   * TEMPORARY SAFE CAPTURE:
   *
   * We have authenticated this event as genuinely coming from BMC.
   * For the first test we log the event-specific `data` object.
   *
   * We are NOT yet writing donor fields to D1 because we want to
   * map BMC's actual current payload rather than guessing field names.
   *
   * Do not log this permanently once integration is complete.
   */
  console.log(
    "Verified BMC webhook:",
    JSON.stringify({
      event_id: event.event_id,
      type: event.type,
      live_mode: event.live_mode,
      created: event.created,
      attempt: event.attempt,
      data: event.data
    })
  );

  return jsonResponse({
    ok: true,
    received: true,
    eventId: String(event.event_id),
    eventType: event.type,
    liveMode: event.live_mode === true
  });
}


/**
 * Verify BMC's HMAC-SHA256 signature.
 */
async function verifyHmacSha256(rawBody, secret, suppliedSignature) {
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

  const expectedSignature = bufferToHex(signatureBuffer);

  return timingSafeEqual(
    expectedSignature.toLowerCase(),
    suppliedSignature.trim().toLowerCase()
  );
}


/**
 * Constant-time-ish comparison to avoid ordinary string equality
 * for authentication material.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}


function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}


function jsonResponse(body, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
