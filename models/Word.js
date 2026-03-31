const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  frequency: {
    type: Number,
    default: 1,
  },
}, { timestamps: true });

module.exports = mongoose.model('Word', wordSchema);
