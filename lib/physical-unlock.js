'use strict';

// Shared by the compatibility routes until device execution receipts are supported.
function physicalUnlockUnavailable(res, message, details = {}, code = 'UNLOCK_EXECUTION_NOT_READY') {
  return res.status(503).json({
    ...details, success: false, code, message, unlock_signal_sent: false, execution_verified: false
  });
}

module.exports = {physicalUnlockUnavailable};
