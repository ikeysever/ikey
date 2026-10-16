"use strict";
// Project request data adapter. The trusted Apps Script deployment must implement
// these actions and enforce ownership, locking and append-only review history.
// Never expose the shared secret to the browser.
function createProjectStore(authStore) {
  if (!authStore || typeof authStore.projectCall !== "function") return null;
  return Object.freeze({
    saveDraft: (actor_user_id, draft) => authStore.projectCall("projectDraftSave", {actor_user_id, draft}),
    listMine: actor_user_id => authStore.projectCall("projectRequestsMine", {actor_user_id}),
    submit: (actor_user_id, request_id) => authStore.projectCall("projectRequestSubmit", {actor_user_id, request_id}),
    historyMine: (actor_user_id, request_id) => authStore.projectCall("projectReviewHistoryMine", {actor_user_id, request_id})
  });
}
module.exports = {createProjectStore};
