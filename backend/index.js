const cors = require("cors");
const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");

const orderService = require("./services/orderService");
const { closeWebSocket, initWebSocket, broadcastOrderUpdate } = require("./websocket/socketServer");
const logger = require("./utils/logger");

function loadDotEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex === -1) {
        return;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

function loadDotEnv() {
  [path.join(__dirname, "../.env"), path.join(__dirname, ".env")].forEach(loadDotEnvFile);
}

function parsePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : 9005;
}

function parseOrigins(value) {
  return (value || "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:9005,http://localhost:9005")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendOrderUpdate(res, message, order) {
  broadcastOrderUpdate(order);
  res.json({
    message,
    order,
  });
}

const activeSimulations = new Map();

function runDeliverySimulation(orderId) {
  if (activeSimulations.has(orderId)) {
    logger.action("DELIVERY_SIMULATION_ALREADY_RUNNING", {
      orderId,
    });

    return false;
  }

  const interval = setInterval(async () => {
    try {
      const order = await orderService.advanceOrder(orderId);
      broadcastOrderUpdate(order);

      if (order.status === "delivered") {
        clearInterval(interval);
        activeSimulations.delete(orderId);
        logger.action("DELIVERY_SIMULATION_COMPLETED", {
          orderId,
          status: order.status,
        });
      }
    } catch (error) {
      clearInterval(interval);
      activeSimulations.delete(orderId);
      logger.error("DELIVERY_SIMULATION_FAILED", error, {
        orderId,
      });
    }
  }, 1200);

  activeSimulations.set(orderId, interval);
  logger.action("DELIVERY_SIMULATION_STARTED", {
    intervalMs: 1200,
    orderId,
  });

  return true;
}

loadDotEnv();

const app = express();
const server = http.createServer(app);
const HOST = process.env.HOST || "127.0.0.1";
const PORT = parsePort(process.env.PORT);
const NODE_ENV = process.env.NODE_ENV || "development";
const CLIENT_DIST_PATH = path.join(__dirname, "../frontend/dist");
const CLIENT_INDEX_PATH = path.join(CLIENT_DIST_PATH, "index.html");
const SHOULD_SERVE_FRONTEND = NODE_ENV === "production" || process.env.SERVE_FRONTEND === "true";
const allowedOrigins = parseOrigins(process.env.CORS_ORIGIN);
let isShuttingDown = false;

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(createHttpError(403, "Origin not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    console.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });

  next();
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get(
  "/api/orders",
  asyncRoute(async (req, res) => {
    res.json(await orderService.listOrders());
  })
);

app.post(
  "/api/orders",
  asyncRoute(async (req, res) => {
    const order = await orderService.createDeliveryOrder(req.body);
    broadcastOrderUpdate(order);

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  })
);

app.get(
  "/api/orders/:id",
  asyncRoute(async (req, res) => {
    res.json(await orderService.getOrder(req.params.id));
  })
);

app.patch(
  "/api/orders/:id/status",
  asyncRoute(async (req, res) => {
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
    sendOrderUpdate(res, "Order status updated successfully", order);
  })
);

app.patch(
  "/api/orders/:id/advance",
  asyncRoute(async (req, res) => {
    const order = await orderService.advanceOrder(req.params.id);
    sendOrderUpdate(res, "Order advanced successfully", order);
  })
);

app.patch(
  "/api/orders/:id/reset",
  asyncRoute(async (req, res) => {
    const order = await orderService.resetOrder(req.params.id);
    sendOrderUpdate(res, "Order reset successfully", order);
  })
);

app.post(
  "/api/orders/:id/simulate",
  asyncRoute(async (req, res) => {
    const order = await orderService.resetOrder(req.params.id);
    broadcastOrderUpdate(order);
    const started = runDeliverySimulation(req.params.id);

    res.json({
      message: started ? "Delivery simulation started" : "Delivery simulation already running",
      order,
    });
  })
);

app.get("/api/delivery/statuses", (req, res) => {
  res.json({
    statuses: orderService.deliverySteps,
  });
});

if (SHOULD_SERVE_FRONTEND && fs.existsSync(CLIENT_INDEX_PATH)) {
  app.use(express.static(CLIENT_DIST_PATH));

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      next();
      return;
    }

    res.sendFile(CLIENT_INDEX_PATH);
  });
}

app.use((req, res, next) => {
  next(createHttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
    ...(NODE_ENV !== "production" && { stack: error.stack }),
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use on ${HOST}.`);
    console.error("Stop the old server with Ctrl+C, or run the app on another port:");
    console.error("PORT=9006 npm start");
    process.exit(1);
  }

  console.error("Server failed to start", error);
  process.exit(1);
});

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info("SERVER_SHUTDOWN_STARTED", {
    signal,
  });

  activeSimulations.forEach((interval) => clearInterval(interval));
  activeSimulations.clear();

  Promise.allSettled([closeWebSocket(), orderService.closeOrderStore()]).finally(() => {
    if (!server.listening) {
      process.exit(0);
    }

    server.close((error) => {
      if (error) {
        console.error("Error during shutdown", error);
        process.exit(1);
      }

      process.exit(0);
    });
  });
}

async function startServer() {
  await orderService.initializeOrderStore();
  initWebSocket(server);

  server.listen(PORT, HOST, () => {
    logger.info("ORDER_STORE_READY", {
      store: orderService.getStoreLabel(),
    });
    logger.info("BACKEND_STARTED", {
      url: `http://${HOST}:${PORT}`,
    });

    if (SHOULD_SERVE_FRONTEND) {
      logger.info("FRONTEND_STATIC_ENABLED", {
        path: CLIENT_DIST_PATH,
      });
    } else {
      logger.info("FRONTEND_DEV_SERVER_SEPARATE", {
        url: "http://127.0.0.1:5173",
      });
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer().catch((error) => {
  console.error("Backend failed to initialize", error);
  orderService.closeOrderStore().finally(() => {
    process.exit(1);
  });
});
