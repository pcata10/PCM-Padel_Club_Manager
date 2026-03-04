const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    player1: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    player2: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    score: { type: String, default: "" },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
  },
  { _id: true },
);

const coupleSchema = new mongoose.Schema(
  {
    player1: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    player2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    guestName: { type: String, default: "" },
    name: { type: String, default: "" },
    seeded: { type: Boolean, default: false },
  },
  { _id: true },
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    couples: [{ type: mongoose.Schema.Types.ObjectId }],
    matches: [matchSchema],
  },
  { _id: true },
);

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: "Torneo Padel" },
    date: { type: Date, required: true },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "21:00" },
    level: {
      type: String,
      enum: ["open", "principiante", "intermedio", "avanzato", "agonista"],
      default: "open",
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
