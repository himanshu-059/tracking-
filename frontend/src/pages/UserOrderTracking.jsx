import React from "react";

function UserOrderTracking({ connectionStatus, error, isLoading, order }) {
  if (error) {
    return (
      <section className="panel order-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Customer view</p>
            <h2>User Side</h2>
          </div>
          <span className={`connection-badge ${connectionStatus}`}>{connectionStatus}</span>
        </div>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel order-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Customer view</p>
            <h2>User Side</h2>
          </div>
          <span className={`connection-badge ${connectionStatus}`}>{connectionStatus}</span>
        </div>
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </section>
    );
  }

  if (!order) {
    return (
      <section className="panel order-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Customer view</p>
            <h2>User Side</h2>
          </div>
          <span className={`connection-badge ${connectionStatus}`}>{connectionStatus}</span>
        </div>
        <p className="message">No orders yet.</p>
      </section>
    );
  }

  const currentStep = order.steps[order.currentStepIndex] || order.steps[0];

  return (
    <section className="panel order-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Customer view</p>
          <h2>User Side</h2>
        </div>
        <span className={`connection-badge ${connectionStatus}`}>{connectionStatus}</span>
      </div>

      <div className="order-card">
        <div>
          <p className="label">Product</p>
          <h3>{order.productName}</h3>
          <p className="muted-text">For {order.customerName}</p>
        </div>
        <span className="status-pill">{currentStep.label}</span>
      </div>

      <div className="current-status">
        <p className="label">Current status</p>
        <strong>{currentStep.description}</strong>
        <div className="progress-track" aria-label={`Delivery progress ${order.progress}%`}>
          <span style={{ width: `${order.progress}%` }} />
        </div>
      </div>

      <ol className="status-list">
        {order.steps.map((step, index) => (
          <li
            key={step.key}
            className={`${step.completed ? "complete" : "pending"} ${step.current ? "current" : ""}`}
          >
            <span className="step-marker" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
              {step.timestamp && <small>{new Date(step.timestamp).toLocaleString()}</small>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default UserOrderTracking;
