const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const reportSchema = new Schema({
    reporter: { type: Schema.Types.ObjectId, ref: 'User' },
    targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: false },
    reason: { type: String, required: true },
    details: { type: String, required: false },
    status: {
        type: String,
        enum: ['opened', 'resolved', 'high-priority', 'investigation'],
        default: 'opened'
    },
}, { timestamps: true });


module.exports = mongoose.model('Report', reportSchema);