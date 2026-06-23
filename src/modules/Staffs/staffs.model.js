const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    name : { type : String, required : true },
    isDeleted: { type: Boolean, default: false },
},
    {
        timestamps: true
    });

module.exports = mongoose.model('Staff', staffSchema);