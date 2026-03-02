const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true }, // "Torneo Puglia Serie C"
  date: { type: Date, required: true },
  level: { type: String, enum: ['open', 'intermedio', 'agonista'], default: 'open' },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  matches: [{
    player1: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    player2: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    score: String // "6-3 7-5"
  }],
  status: { type: String, enum: ['open', 'running', 'finished'], default: 'open' }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);
