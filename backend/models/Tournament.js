const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  couple1: { type: mongoose.Schema.Types.ObjectId, ref: "Couple" },
  couple2: { type: mongoose.Schema.Types.ObjectId, ref: "Couple" },
  score: { type: String, default: "" },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "Couple" },
  phase: { type: String, enum: ["group", "gold", "silver"], default: "group" },
  group: { type: Number },
  round: { type: String }, // "F", "SF", "QF", "R16", "R32"
  court: { type: mongoose.Schema.Types.ObjectId, ref: "Court" },
  time: { type: String },
});

const coupleSchema = new mongoose.Schema({
  player1: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  guestName: { type: String, default: "" }, // ← AGGIUNGI

  name: { type: String, default: "" },
  seeded: { type: Boolean, default: false },
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

module.exports =
  mongoose.models.Tournament || mongoose.model("Tournament", tournamentSchema);
