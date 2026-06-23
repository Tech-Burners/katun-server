const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema({
    category : { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    commission: { type: Number, default: 0 },
})

module.exports = mongoose.model("Commission", commissionSchema);