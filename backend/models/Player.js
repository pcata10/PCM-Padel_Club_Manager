const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema({
  email:         { type: String, required: true, unique: true },
  password:      { type: String, required: true },
  name:          { type: String, required: true },
  level:         { type: String, enum: ['principiante', 'intermedio', 'avanzato', 'agonista'], default: 'intermedio' },
  hand:          { type: String, enum: ['destra', 'sinistra', 'ambidestro'] },
  role:          { type: String, enum: ['player', 'admin'], default: 'player' },
  matchesPlayed: { type: Number, default: 0 },
  winRate:       { type: Number, default: 0 }
}, { timestamps: true })

module.exports = mongoose.models.Player || mongoose.model('Player', playerSchema)

