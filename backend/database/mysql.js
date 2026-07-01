const { Sequelize } = require("sequelize");

const logger = require("../utils/logger");

let sequelize;

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getMysqlConfig() {
  return {
    database: process.env.DB_NAME || "delivery_app",
    host: process.env.DB_HOST || "127.0.0.1",
    password: process.env.DB_PASSWORD || "",
    port: parsePositiveInteger(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || "root",
    connectionLimit: parsePositiveInteger(process.env.DB_CONNECTION_LIMIT, 10),
    syncAlter: parseBoolean(process.env.DB_SYNC_ALTER),
  };
}

function getSequelize() {
  if (sequelize) {
    return sequelize;
  }

  const config = getMysqlConfig();

  sequelize = new Sequelize(config.database, config.user, config.password, {
    dialect: "mysql",
    dialectModule: require("mysql2"),
    host: config.host,
    port: config.port,
    timezone: "+00:00",
    logging: parseBoolean(process.env.DB_LOGGING)
      ? (message) => logger.info("SEQUELIZE_QUERY", { sql: message })
      : false,
    pool: {
      acquire: 30000,
      idle: 10000,
      max: config.connectionLimit,
      min: 0,
    },
    define: {
      freezeTableName: true,
      underscored: true,
    },
  });

  return sequelize;
}

async function closeSequelize() {
  if (!sequelize) {
    return;
  }

  await sequelize.close();
  sequelize = undefined;
}

module.exports = {
  closeSequelize,
  getMysqlConfig,
  getSequelize,
};
