const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
    name: { type: String, required: false },
    email: { type: String, required: false, trim: true },
    phone: { type: String, required: false },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: false },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: false },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: false },
    user : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    credit: { type: Number, required: false },
    usages: { type: Number, required: false },
    status: { type: String, enum: ['active', 'suspended', 'supended'], default: 'active' },
},
    {
        timestamps: true
    });


module.exports = mongoose.model('Employee', employerSchema);