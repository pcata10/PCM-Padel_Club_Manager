module.exports = {
  clubName: process.env.CLUB_NAME || "C.T. LATIANO",
  clubShortName: process.env.CLUB_SHORT_NAME || "CT Latiano",
  clubEmail: process.env.CLUB_EMAIL || "",
  clubPhone: process.env.CLUB_PHONE || "",
  clubAddress: process.env.CLUB_ADDRESS || "",
  clubLogoUrl: process.env.CLUB_LOGO_URL || "",
  currency: process.env.CLUB_CURRENCY || "€",
  slotPrice: parseInt(process.env.CLUB_SLOT_PRICE) || 40,
  slotDuration: parseInt(process.env.CLUB_SLOT_DURATION) || 90,
  openHour: parseInt(process.env.CLUB_OPEN_HOUR) || 8,
  closeHour: parseInt(process.env.CLUB_CLOSE_HOUR) || 22,
  appUrl: process.env.APP_URL || "http://localhost:5173",

  courts: [
    { name: "Campo 1", type: "indoor", order: 1 },
    { name: "Campo 2", type: "indoor", order: 2 },
    { name: "Campo 3", type: "indoor", order: 3 },
    { name: "Campo 4 Esterno", type: "outdoor", order: 4 },
    { name: "Campo 5 Esterno", type: "outdoor", order: 5 },
  ],
};
