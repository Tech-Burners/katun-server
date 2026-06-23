//company

const { de } = require('date-fns/locale/de');
const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
    companyName: { type: String, required: false },
    industry: { type: String, required: false },
    contactName: { type: String, required: false },
    email: { type: String, required: false },
    creditBalance : { type: Number, default: 0 },
    totalFunded: { type: Number, default: 0 },
    totalSpent : { type: Number, default: 0 },
    utizizationRate : { type: Number, default: 0 },
    employeeCount : { type: Number, default: 0 },
    activeEmployeeCount : { type: Number, default: 0 },
    status : { type: String, enum: ['active', 'supended'], default: 'active' },
    user : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    isDeleted: { type: Boolean, default: false },
},
    {
        timestamps: true
    });

module.exports = mongoose.model('Employer', employerSchema);