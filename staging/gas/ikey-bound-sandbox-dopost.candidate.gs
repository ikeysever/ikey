/**
 * iKey Mainline 2 — Bound Sandbox-only HTTP entrypoint candidate.
 * Install ONLY in the dedicated iKey-Mainline2-Bound-Sandbox GAS project.
 * Never install alongside an existing doPost without reviewing conflicts.
 * This entrypoint has no legacy fallback and no production storage route.
 * Deployment is a separate, explicitly authorized step.
 */
function doPost(e) {
  let result;
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string')
      result = {ok:false,error:'INVALID_REQUEST'};
    else {
      const request = JSON.parse(e.postData.contents);
      result = ikeySandboxCommandHttpCandidate_(request);
    }
  } catch (err) {
    result = {ok:false,error:'INVALID_REQUEST'};
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
