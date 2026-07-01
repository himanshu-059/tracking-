import { useCallback, useEffect, useRef, useState } from "react";

import { advanceOrder, listOrders, resetOrder, simulateOrder, updateOrderStatus } from "../api/orders";
import { WS_URL } from "../config";

const LAST_ORDER_STORAGE_KEY = "delivery:lastOrderId";

function readLastOrderId() {
  try {
    return window.localStorage.getItem(LAST_ORDER_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberOrderId(orderId) {
  try {
    if (orderId) {
      window.localStorage.setItem(LAST_ORDER_STORAGE_KEY, orderId);
    } else {
      window.localStorage.removeItem(LAST_ORDER_STORAGE_KEY);
    }
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function selectInitialOrder(orders, configuredOrderId) {
  const rememberedOrderId = readLastOrderId();

  return (
    orders.find((item) => item.id === rememberedOrderId) ||
    orders[orders.length - 1] ||
    (configuredOrderId && orders.find((item) => item.id === configuredOrderId)) ||
    null
  );
}

export function useDeliverySocket(orderId) {
  const socketRef = useRef(null);
  const [activeOrderId, setActiveOrderId] = useState(orderId);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [order, setOrder] = useState(null);

  const sendSocketMessage = useCallback((message) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let reconnectTimer;
    let shouldReconnect = true;

    async function loadInitialOrder() {
      setIsLoading(true);

      try {
        const orders = await listOrders({ signal: controller.signal });
        const selectedOrder = selectInitialOrder(orders, orderId);

        setOrder(selectedOrder);
        setActiveOrderId(selectedOrder?.id || orderId);
        rememberOrderId(selectedOrder?.id);
        setError("");
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    function connectSocket() {
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;
      setConnectionStatus("connecting");

      socket.onopen = () => {
        setConnectionStatus("connected");
        setError("");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "DELIVERY_STATE" || message.type === "DELIVERY_UPDATED") {
            const nextOrder = message.payload.order || null;

            if (!nextOrder) {
              setOrder(null);
              setActiveOrderId(orderId);
              rememberOrderId("");
            } else {
              setOrder(nextOrder);
              setActiveOrderId(nextOrder.id);
              rememberOrderId(nextOrder.id);
            }

            setIsLoading(false);
            setError("");
            return;
          }

          if (message.type === "DELIVERY_ERROR") {
            setError(message.payload.message);
          }
        } catch {
          setError("Received an invalid real-time update.");
        }
      };

      socket.onerror = () => {
        setConnectionStatus("offline");
      };

      socket.onclose = () => {
        setConnectionStatus("offline");

        if (shouldReconnect) {
          reconnectTimer = window.setTimeout(connectSocket, 1500);
        }
      };
    }

    loadInitialOrder();
    connectSocket();

    return () => {
      shouldReconnect = false;
      controller.abort();
      window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [orderId]);

  const getCurrentOrderId = useCallback(() => order?.id || activeOrderId || orderId, [activeOrderId, order, orderId]);

  const setStatus = useCallback(
    async (status) => {
      setIsSaving(true);
      setError("");

      try {
        const currentOrderId = getCurrentOrderId();
        const sent = sendSocketMessage({
          orderId: currentOrderId,
          status,
          type: "SET_DELIVERY_STATUS",
        });

        if (!sent) {
          const data = await updateOrderStatus(currentOrderId, status);
          setOrder(data.order);
          rememberOrderId(data.order.id);
        }
      } catch (saveError) {
        setError(saveError.message);
      } finally {
        setIsSaving(false);
      }
    },
    [getCurrentOrderId, sendSocketMessage]
  );

  const advance = useCallback(async () => {
    setIsSaving(true);
    setError("");

    try {
      const currentOrderId = getCurrentOrderId();
      const sent = sendSocketMessage({
        orderId: currentOrderId,
        type: "ADVANCE_DELIVERY_STATUS",
      });

      if (!sent) {
        const data = await advanceOrder(currentOrderId);
        setOrder(data.order);
        rememberOrderId(data.order.id);
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }, [getCurrentOrderId, sendSocketMessage]);

  const reset = useCallback(async () => {
    setIsSaving(true);
    setError("");

    try {
      const currentOrderId = getCurrentOrderId();
      const sent = sendSocketMessage({
        orderId: currentOrderId,
        type: "RESET_DELIVERY",
      });

      if (!sent) {
        const data = await resetOrder(currentOrderId);
        setOrder(data.order);
        rememberOrderId(data.order.id);
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }, [getCurrentOrderId, sendSocketMessage]);

  const simulate = useCallback(async () => {
    setIsSaving(true);
    setError("");

    try {
      const data = await simulateOrder(getCurrentOrderId());
      setOrder(data.order);
      rememberOrderId(data.order.id);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }, [getCurrentOrderId]);

  return {
    advance,
    connectionStatus,
    error,
    isLoading,
    isSaving,
    order,
    reset,
    simulate,
    setStatus,
  };
}
