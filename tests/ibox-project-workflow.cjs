"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createJoinRequest, decideJoinRequest, createInvitation,
} = require("../lib/ibox/project-workflow");

const memberships = [
  { userId: "ADMIN", projectId: "lab", role: "admin", status: "active" },
  { userId: "ADMIN", projectId: "tools", role: "member", status: "active" },
];
const pending = createJoinRequest({ userId: "STUDENT", projectId: "lab" });

test("application begins pending, not with an active permission", () => {
  assert.deepEqual(pending, { userId: "STUDENT", projectId: "lab", status: "pending" });
  assert.equal(Object.isFrozen(pending), true);
});

test("only the relevant project's administrator can approve", () => {
  assert.equal(decideJoinRequest({
    request: pending, actor: { userId: "ADMIN" },
    memberships, decision: "approved",
  }).status, "approved");
  assert.equal(decideJoinRequest({
    request: { ...pending, projectId: "tools" }, actor: { userId: "ADMIN" },
    memberships, decision: "approved",
  }), null);
});

test("the applicant cannot approve their own request", () => {
  assert.equal(decideJoinRequest({
    request: pending, actor: { userId: "STUDENT", globalRole: "superadmin" },
    memberships, decision: "approved",
  }), null);
});

test("superadmin may approve without membership", () => {
  assert.equal(decideJoinRequest({
    request: pending, actor: { userId: "ROOT", globalRole: "superadmin" },
    memberships: [], decision: "rejected",
  }).status, "rejected");
});

test("completed requests cannot be replayed", () => {
  assert.equal(decideJoinRequest({
    request: { ...pending, status: "approved" },
    actor: { userId: "ADMIN" }, memberships, decision: "approved",
  }), null);
});

test("only project admin can issue a pending invitation", () => {
  assert.deepEqual(createInvitation({
    actor: { userId: "ADMIN" }, projectId: "lab",
    inviteeUserId: "STUDENT", memberships,
  }), { userId: "STUDENT", projectId: "lab", status: "pending", source: "invitation" });
  assert.equal(createInvitation({
    actor: { userId: "ADMIN" }, projectId: "tools",
    inviteeUserId: "STUDENT", memberships,
  }), null);
});

test("rejects invalid user and project identifiers", () => {
  assert.equal(createJoinRequest({ userId: " ", projectId: "lab" }), null);
  assert.equal(createJoinRequest({ userId: "STUDENT", projectId: "" }), null);
});
