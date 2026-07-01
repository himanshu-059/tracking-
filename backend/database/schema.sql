CREATE DATABASE IF NOT EXISTS delivery_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE delivery_app;

CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_customers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  delivery_address VARCHAR(500) NOT NULL,
  status VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_orders_customer_id (customer_id),
  KEY idx_orders_status_updated (status, updated_at),
  CONSTRAINT fk_orders_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  status VARCHAR(64) NOT NULL,
  note VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_status_history_order_created (order_id, created_at),
  CONSTRAINT fk_order_status_history_order_id
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
