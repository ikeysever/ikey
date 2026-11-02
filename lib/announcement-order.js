'use strict';

const PRIORITY_WEIGHT = Object.freeze({
  urgent: 3,
  important: 2,
  normal: 1
});

function timestamp(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return Number.NEGATIVE_INFINITY;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/**
 * Return a new array ordered by announcement priority, then publication time.
 * Unknown priorities and invalid/missing publication dates are placed last.
 * The input array and its records are never mutated.
 */
function sortAnnouncements(announcements) {
  if (!Array.isArray(announcements)) return [];
  return announcements.map((announcement, index) => ({ announcement, index }))
    .sort((left, right) => {
      const a = left.announcement || {};
      const b = right.announcement || {};
      const priorityDifference =
        (PRIORITY_WEIGHT[String(b.priority || '').toLowerCase()] || 0) -
        (PRIORITY_WEIGHT[String(a.priority || '').toLowerCase()] || 0);
      if (priorityDifference) return priorityDifference;

      const publicationDifference = timestamp(b.published_at) - timestamp(a.published_at);
      if (publicationDifference) return publicationDifference;

      const createdDifference = timestamp(b.created_at) - timestamp(a.created_at);
      if (createdDifference) return createdDifference;

      return left.index - right.index;
    })
    .map(entry => entry.announcement);
}

module.exports = { sortAnnouncements, PRIORITY_WEIGHT };
