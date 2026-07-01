import React from "react";

import AdminCRM from "./pages/AdminCRM";
import UserOrderTracking from "./pages/UserOrderTracking";
import { DEFAULT_ORDER_ID } from "./config";
import { useDeliverySocket } from "./hooks/useDeliverySocket";

function App() {
  const delivery = useDeliverySocket(DEFAULT_ORDER_ID);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Delivery operations</p>
          <h1>Real-Time Order Tracking</h1>
        </div>

        <div className="header-meta">
          <span>{delivery.order ? `Order #${delivery.order.id}` : "No order"}</span>
          <strong>Live</strong>
        </div>
      </header>

      <div className="tracking-grid">
        <UserOrderTracking
          connectionStatus={delivery.connectionStatus}
          error={delivery.error}
          isLoading={delivery.isLoading}
          order={delivery.order}
        />
        <AdminCRM
          isSaving={delivery.isSaving}
          order={delivery.order}
          onAdvance={delivery.advance}
          onReset={delivery.reset}
          onSimulate={delivery.simulate}
          onSetStatus={delivery.setStatus}
        />
      </div>
    </main>
  );
}

export default App;
