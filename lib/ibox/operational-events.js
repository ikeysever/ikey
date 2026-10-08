"use strict";

// Bounded, process-local operational events. Never store credentials, request bodies or IPs.
const LIMIT = 300;
let nextId = 0;
const events = [];

function record(type, message, details = {}) {
  const event = {
    id: ++nextId,
    time: new Date().toISOString(),
    type: String(type).slice(0, 48),
    message: String(message).slice(0, 240),
    details,
  };
  events.push(event);
  if (events.length > LIMIT) events.shift();
  return event;
}

function recent(after = 0, limit = 100) {
  const cursor = Number.isSafeInteger(Number(after)) && Number(after) >= 0 ? Number(after) : 0;
  const max = Math.max(1, Math.min(100, Number(limit) || 100));
  return { events: events.filter(event => event.id > cursor).slice(-max), latestId: nextId };
}

module.exports = { record, recent };
