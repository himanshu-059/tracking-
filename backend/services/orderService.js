const {
  allowedStatuses,
  closeOrderStore,
  createOrder,
  findOrderById,
  getAllOrders,
  getStoreLabel,
  initializeOrderStore,
  resetOrderById,
  updateOrderStatusById,
} = require("../models/order");
const { deliverySteps, getNextStatus, getStepIndex, isValidStatus } = require("../constants/deliveryStatus");
const logger = require("../utils/logger");

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getCurrentDeliveryCycleHistory(statusHistory = []) {
  let cycleStartIndex = 0;

  for (let index = statusHistory.length - 1; index >= 0; index -= 1) {
    if (statusHistory[index].status === "ordered") {
      cycleStartIndex = index;
      break;
    }
  }

  return statusHistory.slice(cycleStartIndex);
}

function findLatestHistoryItem(statusHistory, status) {
  for (let index = statusHistory.length - 1; index >= 0; index -= 1) {
    if (statusHistory[index].status === status) {
      return statusHistory[index];
    }
  }

  return null;
}

function buildOrderView(order) {
  const currentStepIndex = getStepIndex(order.status);
  const safeStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
  const progress = Math.round(((safeStepIndex + 1) / deliverySteps.length) * 100);
  const currentCycleHistory = getCurrentDeliveryCycleHistory(order.statusHistory);

  return {
    ...order,
    currentStepIndex: safeStepIndex,
    progress,
    steps: deliverySteps.map((step, index) => {
      const historyItem = findLatestHistoryItem(currentCycleHistory, step.key);

      return {
        ...step,
        completed: index <= safeStepIndex,
        current: index === safeStepIndex,
        timestamp: historyItem?.timestamp || null,
      };
    }),
  };
}

function getRequiredString(orderInput, fieldName) {
  const value = orderInput[fieldName];

  if (typeof value !== "string" || value.trim() === "") {
    throw createServiceError(400, `${fieldName} is required`);
  }

  return value.trim();
}

async function listOrders() {
  const orders = await getAllOrders();
  return orders.map(buildOrderView);
}

async function createDeliveryOrder(orderInput) {
  if (!orderInput || typeof orderInput !== "object") {
    throw createServiceError(400, "Order payload is required");
  }

  const normalizedOrderInput = {
    address: getRequiredString(orderInput, "address"),
    customerName: getRequiredString(orderInput, "customerName"),
    productName: getRequiredString(orderInput, "productName"),
  };

  const order = buildOrderView(await createOrder(normalizedOrderInput));

  logger.action("ORDER_CREATED", {
    orderId: order.id,
    status: order.status,
    customerName: order.customerName,
    productName: order.productName,
  });

  return order;
}

async function getOrder(id) {
  const order = await findOrderById(id);

  if (!order) {
    throw createServiceError(404, "Order not found");
  }

  return buildOrderView(order);
}

async function updateOrderStatus(id, status) {
  if (typeof status !== "string" || !isValidStatus(status)) {
    throw createServiceError(400, `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`);
  }

  const currentOrder = await findOrderById(id);

  if (!currentOrder) {
    throw createServiceError(404, "Order not found");
  }

  const order = await updateOrderStatusById(id, status, "Updated by admin");

  if (!order) {
    throw createServiceError(404, "Order not found");
  }

  const orderView = buildOrderView(order);

  logger.action("ORDER_STATUS_UPDATED", {
    orderId: orderView.id,
    fromStatus: currentOrder.status,
    toStatus: orderView.status,
    customerName: orderView.customerName,
    productName: orderView.productName,
  });

  return orderView;
}

async function advanceOrder(id) {
  const order = await findOrderById(id);

  if (!order) {
    throw createServiceError(404, "Order not found");
  }

  const nextStatus = getNextStatus(order.status);

  if (nextStatus === order.status) {
    logger.action("ORDER_ADVANCE_SKIPPED", {
      orderId: order.id,
      status: order.status,
      reason: "already_at_final_status",
    });

    return buildOrderView(order);
  }

  const updatedOrder = await updateOrderStatusById(id, nextStatus, "Advanced to next delivery step");

  const orderView = buildOrderView(updatedOrder);

  logger.action("ORDER_ADVANCED", {
    orderId: orderView.id,
    fromStatus: order.status,
    toStatus: orderView.status,
    customerName: orderView.customerName,
    productName: orderView.productName,
  });

  return orderView;
}

async function resetOrder(id) {
  const currentOrder = await findOrderById(id);

  if (!currentOrder) {
    throw createServiceError(404, "Order not found");
  }

  const order = await resetOrderById(id);

  if (!order) {
    throw createServiceError(404, "Order not found");
  }

  const orderView = buildOrderView(order);

  logger.action("ORDER_RESET", {
    orderId: orderView.id,
    fromStatus: currentOrder.status,
    toStatus: orderView.status,
    customerName: orderView.customerName,
    productName: orderView.productName,
  });

  return orderView;
}

module.exports = {
  advanceOrder,
  allowedStatuses,
  closeOrderStore,
  createDeliveryOrder,
  deliverySteps,
  getOrder,
  getStoreLabel,
  initializeOrderStore,
  listOrders,
  resetOrder,
  updateOrderStatus,
};
