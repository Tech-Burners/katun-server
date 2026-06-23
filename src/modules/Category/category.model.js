const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
},
    {
        timestamps: true
    });

module.exports = mongoose.model('Category', categorySchema); 