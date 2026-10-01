export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "kirkdrinks-beer",
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
