# Delivery App

Real-time order tracking app with an Express backend, WebSocket updates, and a Vite React frontend.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and update the MySQL credentials for your machine.

## Database

The backend stores data in MySQL through Sequelize ORM.

Create the database before starting the backend:

```sql
CREATE DATABASE IF NOT EXISTS delivery_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Or run the full table setup in `backend/database/schema.sql`.

Sequelize models create missing tables on startup. Set `DB_SYNC_ALTER=true` only for local development when you want Sequelize to alter existing tables to match the models.

The database stores:

- customer details in `customers`
- order details in `orders`
- every order status timestamp in `order_status_history`

## Development

Run the backend and frontend as separate apps in two terminals:

```bash
npm install
npm run dev:backend
```

```bash
npm run dev:frontend
```

Frontend app: `http://127.0.0.1:5173`

Backend API: `http://127.0.0.1:9005`

Backend health check: `http://127.0.0.1:9005/health`

You can also run each side from its own folder:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

In development, the Express backend only serves the API and WebSocket server. The Vite frontend talks to it with `VITE_API_BASE_URL` and `VITE_WS_URL`, which default to `http://127.0.0.1:9005` and `ws://127.0.0.1:9005`.

## Backend Logs

Important backend actions print to the backend terminal with an `[ACTION]` tag. You will see logs for order creation, status changes, resets, delivery simulation start/finish, and skipped advances.

Example:

```text
2026-06-30T12:15:30.000Z [ACTION] ORDER_ADVANCED orderId="1" fromStatus="packed" toStatus="dispatched" customerName="Utkarsh" productName="iPhone 18 pro max"
```

## Production Build

```bash
npm run build
npm run start:prod
```

Express serves the compiled frontend from `frontend/dist`.

Fresh databases start empty. Create an order with `POST /api/orders` before using the tracking controls.
After a live order update, the browser remembers that order and keeps showing it after refresh. If no order has been remembered, the app opens the latest order.

## API

- `GET /health`
- `GET /api/delivery/statuses`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/advance`
- `PATCH /api/orders/:id/reset`
- `PATCH /api/orders/:id/status`
- `POST /api/orders/:id/simulate`

Create order body:

```json
{
  "productName": "<product name>",
  "customerName": "<customer name>",
  "address": "<delivery address>"
}
```

Allowed statuses:

- `ordered`
- `packed`
- `dispatched`
- `out_for_delivery`
- `delivered`

## WebSocket

Connect to the backend WebSocket URL, for example:

```text
ws://127.0.0.1:9005
```

The server sends:

- `DELIVERY_STATUSES` with all delivery steps
- `DELIVERY_STATE` when a client connects
- `DELIVERY_UPDATED` whenever the delivery status changes
- `DELIVERY_ERROR` if a WebSocket command is invalid

Admin clients can send:

```json
{ "type": "ADVANCE_DELIVERY_STATUS", "orderId": "1" }
```

```json
{ "type": "SET_DELIVERY_STATUS", "orderId": "1", "status": "out_for_delivery" }
```

```json
{ "type": "RESET_DELIVERY", "orderId": "1" }
```

```json
{
  "type": "CREATE_DELIVERY_ORDER",
  "order": {
    "productName": "<product name>",
    "customerName": "<customer name>",
    "address": "<delivery address>"
  }
}
```

## Notes

Orders, customers, and status history are persisted in MySQL.
