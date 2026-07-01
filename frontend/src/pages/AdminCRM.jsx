import React from "react";

import { orderStatuses } from "../constants/orderStatus";

function AdminCRM({ isSaving, order, onAdvance, onReset, onSimulate, onSetStatus }) {
  const selectedStatus = order?.status || "ordered";
  const isDelivered = selectedStatus === "delivered";
  const isOrderMissing = !order;

  return (
    <section className="panel admin-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Control desk</p>
          <h2>CRM / Admin Side</h2>
        </div>
      </div>

      <div className="admin-actions">
        <button
          type="button"
          className="primary-action"
          disabled={isSaving || isDelivered || isOrderMissing}
          onClick={onAdvance}
        >
          Move to next step
        </button>
        <button type="button" disabled={isSaving || isOrderMissing} onClick={onSimulate}>
          Run full delivery
        </button>
        <button type="button" disabled={isSaving || isOrderMissing} onClick={onReset}>
          Reset delivery
        </button>
      </div>

      <p className="section-title">Set exact delivery status</p>

      <div className="button-row">
        {orderStatuses.map((status) => (
          <button
            key={status.key}
            type="button"
            className={selectedStatus === status.key ? "active" : ""}
            disabled={isSaving || isOrderMissing}
            onClick={() => onSetStatus(status.key)}
          >
            {status.label}
          </button>
        ))}
      </div>

      <div className="admin-summary">
        <p className="label">Selected status</p>
        <strong>{order ? orderStatuses.find((status) => status.key === selectedStatus)?.label : "No order"}</strong>
        <p className="muted-text">{order?.address || "Create an order with the API to begin tracking."}</p>
      </div>
    </section>
  );
}

export default AdminCRM;
