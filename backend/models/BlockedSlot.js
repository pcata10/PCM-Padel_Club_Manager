const mongoose = require('mongoose')

const BlockedSlotSchema = new mongoose.Schema({
  court:     { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  type:      { type: String, enum: ['academy', 'lesson', 'blocked'], required: true },
  startTime: { type: Date, required: true },
  endTime:   { type: Date, required: true },
  note:      { type: String, default: '' }
})

module.exports = mongoose.model('BlockedSlot', BlockedSlotSchema)
