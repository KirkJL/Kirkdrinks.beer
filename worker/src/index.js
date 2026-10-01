export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ok: true,
        service: "kirkdrinks-beer",
        database: Boolean(env.DB),
        timestamp: new Date().toISOString()
      });
    }

    return Response.json(
      {
        error: "Not found"
      },
      {
        status: 404
      }
    );
  }
};
