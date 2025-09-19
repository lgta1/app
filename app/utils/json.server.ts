export function json(data: any, init: number | ResponseInit = 200) {
  const responseInit: ResponseInit =
    typeof init === "number" ? { status: init } : (init || {});
  const headers = new Headers(responseInit.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...responseInit, headers });
}
