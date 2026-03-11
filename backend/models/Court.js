const mongoose = require("mongoose");

const CourtSchema = new mongoose.Schema(
  {
    name: { type: String },
    type: { type: String, enum: ["indoor", "outdoor"], default: "indoor" },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["available", "maintenance", "academy", "lesson"],
      default: "available",
    },
    blockedNote: { type: String, default: "" },
  },
  { timestamps: true },
);

// ← CAMBIA QUESTA RIGA (rimuovi il controllo mongoose.models.Court):
module.exports = mongoose.model("Court", CourtSchema);
