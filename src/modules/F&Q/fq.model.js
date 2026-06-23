const mongoose  = require("mongoose");

const fqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
});

module.exports = mongoose.model("FQ", fqSchema);