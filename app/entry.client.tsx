import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

startTransition(() => {
  // Với cấu trúc SSR hiện tại (Layout trả về <html>...</html>), cần hydrate cả document
  hydrateRoot(document, <HydratedRouter />);
});
