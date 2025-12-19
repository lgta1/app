// DEPRECATED: API simulate milestone dã b? vô hi?u hoá.
// Gi? file d? tránh 404 trong build step cu; luôn tr? 410.
export async function action() {
  return new Response(
    JSON.stringify({ success: false, message: "simulate milestone has been removed" }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  );
}
