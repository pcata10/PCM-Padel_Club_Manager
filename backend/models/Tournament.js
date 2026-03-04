const mongoose = require("mongoose");

const coupleSchema = new mongoose.Schema({
  player1: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  name: { type: String },
  seeded: { type: Boolean, default: false }, // testa di serie
});

const matchSchema = new mongoose.Schema({
  couple1: { type: mongoose.Schema.Types.ObjectId },
  couple2: { type: mongoose.Schema.Types.ObjectId },
  score: { type: String, default: "" },
  winner: { type: mongoose.Schema.Types.ObjectId }, // _id coppia vincitrice
  phase: { type: String, enum: ["group", "gold", "silver"], default: "group" },
  round: { type: String }, // es. "QF", "SF", "F"
  group: { type: Number }, // numero girone (solo fase group)
  court: { type: mongoose.Schema.Types.ObjectId, ref: "Court" },
  time: { type: String }, // orario es. "10:00"
});

const groupSchema = new mongoose.Schema({
  number: { type: Number },
  couples: [{ type: mongoose.Schema.Types.ObjectId }],
});

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "18:00" },
    level: {
      type: String,
      enum: ["intermedio", "agonista"],
      default: "intermedio",
    },

    status: {
      type: String,
      enum: ["open", "running", "finished"],
      default: "open",
    },
    courts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Court" }],
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    couples: [coupleSchema],
    groups: [groupSchema],
    matches: [matchSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tournament", tournamentSchema);
