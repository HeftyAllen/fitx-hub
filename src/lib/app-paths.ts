/** Keep static assets, email links and worker scopes within the hosted app. */
export const APP_BASE = import.meta.env.BASE_URL;
export const HASH_ROUTES = import.meta.env.MODE === "pages";

export function appAsset(path: string) {
  return `${APP_BASE}${path.replace(/^\/+/, "")}`;
}

export function appRoute(path = "/") {
  return HASH_ROUTES ? `${APP_BASE}#/${path.replace(/^\/+/, "")}` : appAsset(path);
}

export function appRouteUrl(path: string) {
  return new URL(appRoute(path), window.location.origin).href;
}
