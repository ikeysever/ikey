'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sortAnnouncements } = require('../lib/announcement-order');

test('priority outranks publication recency', () => {
  const input = [
    { id: 'new-normal', priority: 'normal', published_at: '2026-11-02T10:00:00Z' },
    { id: 'old-urgent', priority: 'urgent', published_at: '2026-10-01T10:00:00Z' },
    { id: 'mid-important', priority: 'important', published_at: '2026-11-01T10:00:00Z' }
  ];
  assert.deepEqual(sortAnnouncements(input).map(x => x.id), ['old-urgent', 'mid-important', 'new-normal']);
});

test('same priority is ordered by latest publication time first', () => {
  const input = [
    { id: 'older', priority: 'important', published_at: '2026-11-01T08:00:00Z' },
    { id: 'newer', priority: 'important', published_at: '2026-11-02T08:00:00Z' }
  ];
  assert.deepEqual(sortAnnouncements(input).map(x => x.id), ['newer', 'older']);
});

test('unknown priorities and missing dates sort after known values', () => {
  const input = [
    { id: 'unknown', priority: 'critical', published_at: '2026-11-03T08:00:00Z' },
    { id: 'normal-no-date', priority: 'normal' },
    { id: 'normal-date', priority: 'normal', published_at: '2026-11-01T08:00:00Z' }
  ];
  assert.deepEqual(sortAnnouncements(input).map(x => x.id), ['normal-date', 'normal-no-date', 'unknown']);
});

test('sorting does not mutate the source array', () => {
  const input = [{ id: 'b', priority: 'normal' }, { id: 'a', priority: 'urgent' }];
  const original = input.slice();
  sortAnnouncements(input);
  assert.deepEqual(input, original);
});

test('non-array input returns an empty array', () => {
  assert.deepEqual(sortAnnouncements(null), []);
});
