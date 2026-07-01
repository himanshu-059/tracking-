const { DataTypes } = require("sequelize");

const { allowedStatuses } = require("../constants/deliveryStatus");
const { closeSequelize, getMysqlConfig, getSequelize } = require("../database/mysql");

let Customer;
let Order;
let OrderStatusHistory;
let modelsInitialized = false;

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function initializeModels() {
  if (modelsInitialized) {
    return;
  }

  const sequelize = getSequelize();

  Customer = sequelize.define(
    "Customer",
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER.UNSIGNED,
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING(255),
      },
      address: {
        allowNull: false,
        type: DataTypes.STRING(500),
      },
    },
    {
      tableName: "customers",
    }
  );

  Order = sequelize.define(
    "Order",
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER.UNSIGNED,
      },
      productName: {
        allowNull: false,
        field: "product_name",
        type: DataTypes.STRING(255),
      },
      deliveryAddress: {
        allowNull: false,
        field: "delivery_address",
        type: DataTypes.STRING(500),
      },
      status: {
        allowNull: false,
        defaultValue: "ordered",
        type: DataTypes.STRING(64),
        validate: {
          isIn: [allowedStatuses],
        },
      },
    },
    {
      tableName: "orders",
    }
  );

  OrderStatusHistory = sequelize.define(
    "OrderStatusHistory",
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER.UNSIGNED,
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING(64),
        validate: {
          isIn: [allowedStatuses],
        },
      },
      note: {
        allowNull: false,
        type: DataTypes.STRING(255),
      },
    },
    {
      tableName: "order_status_history",
      updatedAt: false,
    }
  );

  Customer.hasMany(Order, {
    as: "orders",
    foreignKey: {
      allowNull: false,
      name: "customerId",
      field: "customer_id",
    },
  });

  Order.belongsTo(Customer, {
    as: "customer",
    foreignKey: {
      allowNull: false,
      name: "customerId",
      field: "customer_id",
    },
  });

  Order.hasMany(OrderStatusHistory, {
    as: "statusHistory",
    foreignKey: {
      allowNull: false,
      name: "orderId",
      field: "order_id",
    },
    onDelete: "CASCADE",
  });

  OrderStatusHistory.belongsTo(Order, {
    as: "order",
    foreignKey: {
      allowNull: false,
      name: "orderId",
      field: "order_id",
    },
  });

  modelsInitialized = true;
}

function getOrderIncludes() {
  initializeModels();

  return [
    {
      as: "customer",
      model: Customer,
    },
    {
      as: "statusHistory",
      model: OrderStatusHistory,
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
      separate: true,
    },
  ];
}

function serializeOrder(order) {
  if (!order) {
    return null;
  }

  const plainOrder = order.get({ plain: true });
  const customer = plainOrder.customer || {};

  return {
    address: plainOrder.deliveryAddress || customer.address,
    createdAt: toIsoString(plainOrder.createdAt),
    customerName: customer.name,
    id: String(plainOrder.id),
    productName: plainOrder.productName,
    status: plainOrder.status,
    statusHistory: (plainOrder.statusHistory || []).map((historyItem) => ({
      note: historyItem.note,
      status: historyItem.status,
      timestamp: toIsoString(historyItem.createdAt),
    })),
    updatedAt: toIsoString(plainOrder.updatedAt),
  };
}

async function loadOrderById(id, options = {}) {
  initializeModels();

  const order = await Order.findByPk(id, {
    include: getOrderIncludes(),
    transaction: options.transaction,
  });

  return serializeOrder(order);
}

function getStoreLabel() {
  const config = getMysqlConfig();
  return `sequelize:mysql/${config.database}`;
}

async function initializeOrderStore() {
  initializeModels();

  const sequelize = getSequelize();
  const config = getMysqlConfig();

  await sequelize.authenticate();
  await sequelize.sync({
    alter: config.syncAlter,
  });
}

async function closeOrderStore() {
  await closeSequelize();
  modelsInitialized = false;
}

async function createOrder(orderInput = {}) {
  initializeModels();

  const sequelize = getSequelize();

  return sequelize.transaction(async (transaction) => {
    const customer = await Customer.create(
      {
        address: orderInput.address,
        name: orderInput.customerName,
      },
      { transaction }
    );

    const order = await Order.create(
      {
        customerId: customer.id,
        deliveryAddress: orderInput.address,
        productName: orderInput.productName,
        status: "ordered",
      },
      { transaction }
    );

    await OrderStatusHistory.create(
      {
        note: "Order created",
        orderId: order.id,
        status: "ordered",
      },
      { transaction }
    );

    return loadOrderById(order.id, { transaction });
  });
}

async function getAllOrders() {
  initializeModels();

  const orders = await Order.findAll({
    include: getOrderIncludes(),
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
  });

  return orders.map(serializeOrder);
}

async function findOrderById(id) {
  return loadOrderById(id);
}

async function resetOrderById(id) {
  initializeModels();

  const sequelize = getSequelize();

  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(id, { transaction });

    if (!order) {
      return null;
    }

    await order.update(
      {
        status: "ordered",
      },
      { transaction }
    );

    await OrderStatusHistory.create(
      {
        note: "Delivery process restarted",
        orderId: order.id,
        status: "ordered",
      },
      { transaction }
    );

    return loadOrderById(order.id, { transaction });
  });
}

async function updateOrderStatusById(id, status, note = "Status updated") {
  initializeModels();

  const sequelize = getSequelize();

  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(id, { transaction });

    if (!order) {
      return null;
    }

    await order.update(
      {
        status,
      },
      { transaction }
    );

    await OrderStatusHistory.create(
      {
        note,
        orderId: order.id,
        status,
      },
      { transaction }
    );

    return loadOrderById(order.id, { transaction });
  });
}

module.exports = {
  allowedStatuses,
  closeOrderStore,
  createOrder,
  findOrderById,
  getAllOrders,
  getStoreLabel,
  initializeOrderStore,
  resetOrderById,
  updateOrderStatusById,
};
