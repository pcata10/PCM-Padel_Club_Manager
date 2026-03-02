const mongoose = require('mongoose')

const CourtSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: [] },
  status: {
    type: String,
    enum: ['available', 'maintenance', 'academy', 'lesson'],
    default: 'available'
  },
  blockedNote: { type: String, default: '' }  // ← nota opzionale (es. "Corso Principianti")
})

module.exports = mongoose.models.Court || mongoose.model('Court', CourtSchema)
