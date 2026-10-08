"use strict";

/**
 * iKey project workflow policies (Q-001–Q-004).
 * These are pure state transitions. They do not persist data, authenticate a
 * caller, grant device access, or call any existing API.
 */
const { canManageProject } = require("./project-access");

const REQUEST_STATES = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

function validId(id) {
  return typeof id === "string" && id.trim().length > 0 && id === id.trim();
}

function createJoinRequest({ userId, projectId }) {
  if (!validId(userId) || !validId(projectId)) return null;
  return Object.freeze({
    userId,
    projectId,
    status: REQUEST_STATES.PENDING,
  });
}

/**
 * Only a project administrator or global superadmin can decide an application.
 * Rejected/approved applications cannot be re-approved by replay.
 * The caller is responsible for persisting the decision atomically.
 */
function decideJoinRequest({ request, actor, memberships, decision }) {
  if (!request || request.status !== REQUEST_STATES.PENDING ||
      !validId(request.userId) || !validId(request.projectId) ||
      ![REQUEST_STATES.APPROVED, REQUEST_STATES.REJECTED].includes(decision)) {
    return null;
  }
  if (actor?.userId === request.userId) return null;
  if (!canManageProject({ actor, projectId: request.projectId, memberships })) {
    return null;
  }
  return Object.freeze({ ...request, status: decision });
}

/**
 * An invitation creates a pending invitation, not an active membership.
 * Accepting an invitation requires a separately authenticated user workflow.
 */
function createInvitation({ actor, projectId, inviteeUserId, memberships }) {
  if (!validId(projectId) || !validId(inviteeUserId) ||
      actor?.userId === inviteeUserId ||
      !canManageProject({ actor, projectId, memberships })) {
    return null;
  }
  return Object.freeze({
    userId: inviteeUserId,
    projectId,
    status: REQUEST_STATES.PENDING,
    source: "invitation",
  });
}

module.exports = {
  REQUEST_STATES,
  createJoinRequest,
  decideJoinRequest,
  createInvitation,
};
