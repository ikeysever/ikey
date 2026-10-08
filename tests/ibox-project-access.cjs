"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getProjectRole,
  canManageProject,
  canAccessProject,
} = require("../lib/ibox/project-access");

const actor = { userId: "U001" };
const memberships = [
  { userId: "U001", projectId: "tools", role: "admin", status: "active" },
  { userId: "U001", projectId: "lab", role: "member", status: "active" },
  { userId: "U002", projectId: "lab", role: "admin", status: "active" },
];
const context = (projectId, extra = {}) => ({
  actor,
  projectId,
  memberships,
  ...extra,
});

test("same person can administer one project but not another", () => {
  assert.equal(canManageProject(context("tools")), true);
  assert.equal(canManageProject(context("lab")), false);
  assert.equal(getProjectRole(context("lab")), "member");
});

test("a different user's admin membership never leaks", () => {
  assert.equal(canManageProject(context("lab")), false);
  assert.equal(canAccessProject(context("unknown")), false);
});

test("global superadmin need not have project membership", () => {
  assert.equal(
    canManageProject(context("unknown", {
      actor: { userId: "ROOT", globalRole: "superadmin" },
      memberships: [],
    })),
    true
  );
});

test("pending or disabled membership grants no access", () => {
  for (const status of ["pending", "disabled", "rejected"]) {
    assert.equal(
      canAccessProject(context("tools", {
        memberships: [{ userId: "U001", projectId: "tools", role: "admin", status }],
      })),
      false
    );
  }
});

test("duplicate active membership fails closed", () => {
  assert.equal(
    canAccessProject(context("tools", {
      memberships: [
        { userId: "U001", projectId: "tools", role: "admin", status: "active" },
        { userId: "U001", projectId: "tools", role: "member", status: "active" },
      ],
    })),
    false
  );
});

test("missing identity, project, or memberships fails closed", () => {
  assert.equal(getProjectRole(context("tools", { actor: null })), null);
  assert.equal(getProjectRole(context("", {})), null);
  assert.equal(getProjectRole(context("tools", { memberships: null })), null);
});
