const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
  court:        { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  player1:      { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  players:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  guestPlayers: [{ type: String }],
  startTime:    { type: Date, required: true },
  endTime:      { type: Date, required: true },
  status: {
    type:    String,
    enum:    ['confirmed', 'cancelled'],
    default: 'confirmed'
  },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null }
}, { timestamps: true })

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema)
