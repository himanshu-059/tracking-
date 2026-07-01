const WebSocket = require("ws");

const orderService = require("../services/orderService");
const logger = require("../utils/logger");

let wss;

function getDefaultOrderId() {
  return process.env.DEFAULT_ORDER_ID || process.env.VITE_DEFAULT_ORDER_ID || "";
}

function sendJson(client, message) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

function sendError(client, message) {
  sendJson(client, {
    payload: {
      message,
    },
    type: "DELIVERY_ERROR",
  });
}

function createDeliveryMessage(order, type = "DELIVERY_UPDATED") {
  return {
    payload: {
      order,
      steps: order?.steps || orderService.deliverySteps,
    },
    type,
  };
}

function createStatusMessage() {
  return {
    payload: {
      statuses: orderService.deliverySteps,
    },
    type: "DELIVERY_STATUSES",
  };
}

function broadcast(message) {
  if (!wss) return;

  wss.clients.forEach((client) => {
    sendJson(client, message);
  });
}

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      return;
    }

    logger.error("WEBSOCKET_SERVER_ERROR", error);
  });

  wss.on("connection", async (ws) => {
    logger.info("WEBSOCKET_CONNECTED", {
      clients: wss.clients.size,
    });

    sendJson(ws, createStatusMessage());

    try {
      const orders = await orderService.listOrders();
      const defaultOrderId = getDefaultOrderId();
      const order =
        orders[orders.length - 1] ||
        (defaultOrderId && orders.find((item) => item.id === defaultOrderId)) ||
        null;
      sendJson(ws, createDeliveryMessage(order, "DELIVERY_STATE"));
    } catch (error) {
      sendError(ws, error.message || "Unable to load delivery state");
    }

    ws.on("message", async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        const orderId = message.orderId || getDefaultOrderId();
        let order;

        logger.info("WEBSOCKET_COMMAND_RECEIVED", {
          orderId,
          status: message.status,
          type: message.type,
        });

        if (message.type === "SET_DELIVERY_STATUS") {
          order = await orderService.updateOrderStatus(orderId, message.status);
        } else if (message.type === "ADVANCE_DELIVERY_STATUS") {
          order = await orderService.advanceOrder(orderId);
        } else if (message.type === "RESET_DELIVERY") {
          order = await orderService.resetOrder(orderId);
        } else if (message.type === "CREATE_DELIVERY_ORDER") {
          order = await orderService.createDeliveryOrder(message.order);
        } else {
          logger.warn("WEBSOCKET_UNKNOWN_COMMAND", {
            orderId,
            type: message.type,
          });
          sendError(ws, "Unknown WebSocket message type");
          return;
        }

        broadcast(createDeliveryMessage(order));
      } catch (error) {
        logger.error("WEBSOCKET_COMMAND_FAILED", error);
        sendError(ws, error.message || "Unable to process WebSocket message");
      }
    });

    ws.on("close", () => {
      logger.info("WEBSOCKET_DISCONNECTED", {
        clients: wss.clients.size,
      });
    });
  });
}

function broadcastOrderUpdate(order) {
  broadcast(createDeliveryMessage(order));
}

function closeWebSocket() {
  if (!wss) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    wss.clients.forEach((client) => {
      client.close(1001, "Server shutting down");
    });

    wss.close(() => {
      wss = undefined;
      resolve();
    });
  });
}

module.exports = {
  closeWebSocket,
  initWebSocket,
  broadcastOrderUpdate,
};
