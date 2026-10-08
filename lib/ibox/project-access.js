"use strict";

/**
 * iBox project membership permission foundation.
 *
 * Q-001: user identity is separate from project membership.
 * Q-002: superadmin is a global role, not a project membership.
 * Q-003: memberships and roles are scoped independently per project.
 *
 * Pure logic only: no database schema, routes, or live authorization is changed.
 * An application must authenticate the actor and load authoritative records
 * before calling these functions. Never trust client-submitted roles.
 */

const PROJECT_ROLES = Object.freeze({
  ADMIN: "admin",
  MEMBER: "member",
});

function isActiveMembership(membership, projectId) {
  return Boolean(
    membership &&
    membership.projectId === projectId &&
    membership.status === "active" &&
    (membership.role === PROJECT_ROLES.ADMIN ||
      membership.role === PROJECT_ROLES.MEMBER)
  );
}

/**
 * Returns an effective role for a single project, or null.
 * Duplicate active memberships with conflicting roles fail closed.
 */
function getProjectRole({ actor, projectId, memberships }) {
  if (!actor || typeof actor.userId !== "string" || !actor.userId ||
      typeof projectId !== "string" || !projectId ||
      !Array.isArray(memberships)) {
    return null;
  }

  if (actor.globalRole === "superadmin") return "superadmin";

  const matches = memberships.filter(
    (membership) =>
      membership &&
      membership.userId === actor.userId &&
      isActiveMembership(membership, projectId)
  );

  if (matches.length !== 1) return null;
  return matches[0].role;
}

function canManageProject(context) {
  const role = getProjectRole(context);
  return role === "superadmin" || role === PROJECT_ROLES.ADMIN;
}

function canAccessProject(context) {
  return getProjectRole(context) !== null;
}

module.exports = {
  PROJECT_ROLES,
  getProjectRole,
  canManageProject,
  canAccessProject,
};
