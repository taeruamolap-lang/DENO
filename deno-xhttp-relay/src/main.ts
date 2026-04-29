const TARGET_BASE = Deno.env.get("TARGET_DOMAIN") || "";

if (!TARGET_BASE) {
  console.error("TARGET_DOMAIN environment variable is not set");
}

const STRIP_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto",
  "x-forwarded-port", "x-forwarded-for", "x-real-ip"
]);

Deno.serve(async (req: Request): Promise<Response> => {
  if (!TARGET_BASE) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const targetPath = url.pathname === "/" ? "" : url.pathname;
    const targetUrl = TARGET_BASE + targetPath + url.search;

    const headers = new Headers();

    for (const [key, value] of req.headers) {
      const lowerKey = key.toLowerCase();
      if (STRIP_HEADERS.has(lowerKey)) continue;
      headers.set(key, value);
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: headers,
      redirect: "manual",
    };

    // پشتیبانی بهتر از streaming دوطرفه (خیلی مهم برای XHTTP)
    if (req.body && !["GET", "HEAD"].includes(req.method)) {
      fetchOptions.body = req.body;
      // @ts-ignore - Deno supports duplex
      (fetchOptions as any).duplex = "half";
    }

    const response = await fetch(targetUrl, fetchOptions);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

  } catch (err) {
    console.error("Relay Error:", err);
    return new Response("Bad Gateway: Tunnel Failed", { status: 502 });
  }
});
