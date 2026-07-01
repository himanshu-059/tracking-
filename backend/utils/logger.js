function serializeValue(value) {
  if (value instanceof Error) {
    return JSON.stringify(value.message);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function formatDetails(details = {}) {
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${serializeValue(value)}`)
    .join(" ");

  return detailText ? ` ${detailText}` : "";
}

function write(level, eventName, details) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} [${level}] ${eventName}${formatDetails(details)}`;

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function action(eventName, details) {
  write("ACTION", eventName, details);
}

function error(eventName, errorValue, details = {}) {
  write("ERROR", eventName, {
    ...details,
    error: errorValue,
  });
}

function info(eventName, details) {
  write("INFO", eventName, details);
}

function warn(eventName, details) {
  write("WARN", eventName, details);
}

module.exports = {
  action,
  error,
  info,
  warn,
};
