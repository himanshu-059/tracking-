import { API_BASE_URL } from "../config";

async function request(path, options = {}) {
  const { body, headers, ...restOptions } = options;
  const requestHeaders = {
    ...(body && { "Content-Type": "application/json" }),
    ...headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    ...(body && { body }),
    ...(Object.keys(requestHeaders).length > 0 && { headers: requestHeaders }),
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export function getOrder(orderId, options = {}) {
  return request(`/api/orders/${orderId}`, options);
}

export function listOrders(options = {}) {
  return request("/api/orders", options);
}

export function updateOrderStatus(orderId, status) {
  return request(`/api/orders/${orderId}/status`, {
    body: JSON.stringify({ status }),
    method: "PATCH",
  });
}

export function advanceOrder(orderId) {
  return request(`/api/orders/${orderId}/advance`, {
    method: "PATCH",
  });
}

export function resetOrder(orderId) {
  return request(`/api/orders/${orderId}/reset`, {
    method: "PATCH",
  });
}

export function simulateOrder(orderId) {
  return request(`/api/orders/${orderId}/simulate`, {
    method: "POST",
  });
}
