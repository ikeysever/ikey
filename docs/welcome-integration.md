# Welcome integration — 2026-10-07

Uses the approved iKey-Welcome-Latest-Handoff.zip Canvas renderer and raster assets, without redesigning the sequence. The renderer keeps the final 1920×1080 geometry, slow fingerprint flash, eight compartments, wordmark letter animation, final text and cubic easing. Original font subsets and OFL license are included. The background uses the shared iKey radial gradient.

After POST /api/login succeeds, loginPage is hidden. The animation runs while the existing /api/device/status request prepares dashboard data. At 8.3 seconds it holds until that request succeeds, including when all devices are legitimately offline. Only then does the white check draw, and the final chord and fade run one second later. homePage appears after the fade; regular device polling then continues. Failed data loading offers retry, with no successful ending. Status requests time out after 15 seconds.

The current dashboard only fetches device status. If future dashboard modules need other data, add their promises to the prepareHome callback in animation.js; do not use a timer as proof of readiness. Other navigation transitions are unchanged.

intro.mp3 and final-chord.mp3 are split from the latest boosted preview at 9.3 seconds, the original fade/chord boundary. They preserve that preview's limited gain. Web Audio is unlocked from the login submit gesture; if browser policy blocks audio or audio download fails, visual playback continues silently. Image assets preload during credential entry. Missing required images offer retry.

Validation: node --check public/welcome.js; node --check public/animation.js; node tests/welcome-state.cjs. The state test checks delayed readiness, failure, retry, repeat playback and cleanup. Browser visual/audio QA was unavailable because Chromium download was blocked in the execution environment. Before merging, verify a normal login, a slow/failing /api/device/status request, retry, audio on desktop/mobile, and portrait scaling. No backend or API contract changes.
