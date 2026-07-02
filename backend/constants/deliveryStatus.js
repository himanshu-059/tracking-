const deliverySteps = [
  {
    key: "ordered",
    label: "Ordered",
    description: "Order has been placed and confirmed.",
  },

  {
    key: "dispatched",
    label: "Dispatched",
    description: "Package has left the warehouse.",
  },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
    description: "Delivery partner is heading to the customer.",
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Order has been delivered successfully.",
  },
];

const allowedStatuses = deliverySteps.map((status) => status.key);

function getStepIndex(status) {
  return allowedStatuses.indexOf(status);
}

function getNextStatus(status) {
  const currentIndex = getStepIndex(status);

  if (currentIndex === -1 || currentIndex === allowedStatuses.length - 1) {
    return status;
  }

  return allowedStatuses[currentIndex + 1];
}

function isValidStatus(status) {
  return allowedStatuses.includes(status);
}

module.exports = {
  allowedStatuses,
  deliverySteps,
  getNextStatus,
  getStepIndex,
  isValidStatus,
};
