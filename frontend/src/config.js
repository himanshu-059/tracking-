const defaultApiBaseUrl = import.meta.env.DEV ? "http://127.0.0.1:9005" : window.location.origin;

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl
);

export const WS_URL = trimTrailingSlash(
  import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^http/, "ws")
);

export const DEFAULT_ORDER_ID = import.meta.env.VITE_DEFAULT_ORDER_ID || "";
