const mongoose = require('mongoose')

const adminSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin','sub_admin', 'hr', 'sub_hr_admin', 'partner'] },
    isSupperAdmin: { type: Boolean, default: false },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },// to track under which company
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isBan: { type: Boolean, default: false },
    categoryPermissions: {
        type: [String]
        // enum: [
        //     'administration',
        //     'finance',
        //     'support',
        //     'operations'
        // ]
    }
},
    { timestamps: true }
)

module.exports = mongoose.model('Admin', adminSchema)