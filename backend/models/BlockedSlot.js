const mongoose = require("mongoose");

const blockedSlotSchema = new mongoose.Schema(
  {
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },
    type: {
      type: String,
      enum: ["blocked", "academy", "lesson"],
      default: "blocked",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    note: { type: String, default: "" },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      default: null,
    },
    players: { type: [String], default: [] },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.BlockedSlot ||
  mongoose.model("BlockedSlot", blockedSlotSchema);
