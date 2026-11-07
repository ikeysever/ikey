# GAS doPost staging patch — 2026-11-07

## Verified source excerpt (user supplied)
```js
function doPost(e) {
 try {
  const data=JSON.parse(e.postData?.contents||"{}");
  const secret=PropertiesService.getScriptProperties().getProperty("GEN3_API_KEY");
  if(!secret || secret.length<32 || data.api_key!==secret)return respond({ok:false,error:"UNAUTHORIZED"});
  const start=Date.now();
  const action=String(data.action||"");
  _gen3Profile = GEN3_PROFILE_ACTIONS[action] ? Object.create(null) : null;
  try {
    const payload = data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
      ? data.payload
      : {};
    const IKEY_PROJECT_ACTIONS = [
      'projectCreate','projectListMine','projectAccessConfigure',
      'projectAccessJoin','projectAccessMine','projectAccessGet',
      'projectAccessList','projectAccessReview','projectSettingsUpdate'
    ];
    // Additional existing action dispatch follows; preserve unchanged.
```

## Minimal change in an ISOLATED STAGING COPY
Keep the existing API key check, payload extraction, project action list,
existing `respond` wrapper and catch/finally logic unchanged.

Find the existing assignment to `const result = ...` in the same inner
`try` block. Replace ONLY the initial dispatch expression with a ping-first
conditional, preserving the original entire expression in the else branch.

**Example for an existing expression starting `action.startsWith('db.')`:**
```js
const result = ikeyPingIsAction_(action)
  ? ikeyPingDispatchAuthorized_(action, payload, ikeyPingAuthorization_())
  : action.startsWith('db.')
    ? ikeyDbDispatch_(action, payload)
    : /* ALL original remaining branches, byte-for-byte */;
```
This is a patch pattern, NOT copy/paste-ready code: the complete current
`const result` expression has not yet been verified verbatim. Never replace
the rest with a stub or default `execute`.

Alternative when editing the full inner try body (and preserving its existing
error handler): 
```js
const pingRoute = ikeyPingTryDispatch_(action, payload);
if (pingRoute.handled) {
  return respond({ok:true,result:pingRoute.result});
}
// Existing non-ping dispatcher follows unchanged.
```
Use the alternative only if the existing success response really is
`respond({ok:true,result})` and no profiling/finally behavior would be
skipped. Prefer the first expression patch otherwise.

## Safety gates
- Do not add a second `doPost`; use the verified current one.
- Never bypass `GEN3_API_KEY` validation.
- Keep unknown actions on their original path; the ping seam handles exactly
  four allowlisted actions.
- Deploy only a separate staging GAS project + staging spreadsheet after
  backup and preflight.
- Never expose `IKEY_COMMAND_TRUST_SECRET` or API key.
- No production deploy, main merge or physical unlock.

## Current status
GitHub patch components and tests committed; real GAS editor integration,
backup, preflight execution and staging deployment NOT performed.
