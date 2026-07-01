export const orderSteps = [
  {
    detail: "Request received",
    key: "ordered",
    label: "Ordered",
  },
  {
    detail: "Package prepared",
    key: "packed",
    label: "Packed",
  },
  {
    detail: "On the way",
    key: "dispatched",
    label: "Dispatched",
  },
  {
    detail: "Delivery partner is near the address",
    key: "out_for_delivery",
    label: "Out for delivery",
  },
  {
    detail: "Handed over",
    key: "delivered",
    label: "Delivered",
  },
];

export const orderStatuses = orderSteps.map(({ key, label }) => ({
  key,
  label,
}));
