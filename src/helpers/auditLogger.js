const AuditLog = require('../modules/Audit/audit.model');

const createAuditLog = async ({ action, summary, performedBy, performedByName, performedByRole, performedByUser, metadata = {} }) => {
  if (performedByUser) {
    performedBy = performedByUser._id || performedBy;
    performedByName = performedByUser.fullName || performedByUser.email || performedByUser.phoneNumber || performedByName || 'Unknown';
    performedByRole = performedByUser.role || performedByRole;
  }

  return AuditLog.create({
    action,
    summary,
    performedBy,
    performedByName,
    performedByRole,
    metadata,
  });
};

module.exports = { createAuditLog };
