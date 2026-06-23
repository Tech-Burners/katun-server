const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  summary: { type: String, required: true },
  // company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: false },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
