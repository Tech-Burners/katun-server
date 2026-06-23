const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    employer : { type : mongoose.Schema.Types.ObjectId, ref : 'Employer', required : true },
    name : { type : String, required : true },
    description : { type : String, required : true },
    isDeleted : { type : Boolean, default : false },
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);