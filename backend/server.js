require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const Court = require("./models/Court");
const Player = require("./models/Player");
const Booking = require("./models/Booking");
const BlockedSlot = require("./models/BlockedSlot");
const Tournament = require("./models/Tournament");
const Sponsor = require("./models/Sponsor");
const config = require("./config");

// ── TIMEZONE HELPER ────────────────────────────────────────────────
// Converte "2026-03-10" + "09:00" → Date UTC corretta per l'Italia
function italyTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00+01:00`);
}

// Normalizza una stringa datetime in arrivo dal frontend
// Se già ha offset (+01:00 / Z) la lascia, altrimenti aggiunge +01:00
function toDate(str) {
  if (!str) return null;
  if (typeof str === "object") return str; // già Date
  const s = String(str);
  if (s.includes("+") || s.endsWith("Z")) return new Date(s);
  return new Date(`${s}+01:00`);
}

// ── POPULATE HELPER ────────────────────────────────────────────────
const T_POPULATE = [
  { path: "courts" },
  { path: "players", select: "name surname email level" },
  { path: "couples.player1", select: "name surname" },
  { path: "couples.player2", select: "name surname" },
];

// ── MAILER ─────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendBookingNotification({ player, court, booking, organizer }) {
  const dateStr = new Date(booking.startTime).toLocaleString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
  const endStr = new Date(booking.endTime).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
  await mailer.sendMail({
    from: `"Padel Club" <${process.env.SMTP_USER}>`,
    to: player.email,
    subject: `🎾 Sei stato aggiunto a una partita — ${dateStr}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f0fdf4;border-radius:16px;">
        <h2 style="color:#059669;margin-bottom:4px;">🎾 Nuova prenotazione!</h2>
        <p style="color:#374151;">Ciao <strong>${player.name}</strong>,</p>
        <p style="color:#374151;"><strong>${organizer.name}</strong> ti ha aggiunto a una partita di padel.</p>
        <div style="background:#fff;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #d1fae5;">
          <p style="margin:6px 0;color:#374151;">🏟 <strong>Campo:</strong> ${court.name}</p>
          <p style="margin:6px 0;color:#374151;">📅 <strong>Inizio:</strong> ${dateStr}</p>
          <p style="margin:6px 0;color:#374151;">⏱ <strong>Fine:</strong> ${endStr}</p>
        </div>
        <a href="${process.env.APP_URL}/dashboard"
           style="display:inline-block;margin-top:12px;padding:12px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;">
          Vai alla Dashboard
        </a>
      </div>
    `,
  });
}

// ── APP ────────────────────────────────────────────────────────────
const app = express();
app.use(
  cors({
    origin: [
      "https://pc-padel-project.vercel.app",
      "http://localhost:5173",
      "http://192.168.178.142:5173",
    ],
    credentials: true,
  }),
);
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const auth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ msg: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
};

const adminOnly = async (req, res, next) => {
  const player = await Player.findById(req.user.id);
  if (player?.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  next();
};

const PORT = process.env.PORT || 4000;

// Health check endpoint (aggiungi vicino all'inizio)
app.get("/ping", (req, res) => res.send("pong"));

// ── INIT ───────────────────────────────────────────────────────────
// PRIMA:

// DOPO:
app.get("/api/init", async (req, res) => {
  try {
    console.log("config.courts:", JSON.stringify(config.courts, null, 2));
    await Court.deleteMany();
    await Court.insertMany(
      config.courts.map((c) =>
        typeof c === "string" ? { name: c, type: "indoor", order: 0 } : c,
      ),
    );
    res.json({ msg: "Dati inizializzati" });
  } catch (err) {
    console.error("INIT ERROR:", err.message);
    res.status(500).json({ msg: "Errore init", error: err.message });
  }
});

// ── CONFIG ─────────────────────────────────────────────────────────
app.get("/api/config", (req, res) => {
  res.json({
    clubName: config.clubName,
    clubShortName: config.clubShortName,
    clubEmail: config.clubEmail,
    clubPhone: config.clubPhone,
    clubAddress: config.clubAddress,
    clubLogoUrl: config.clubLogoUrl,
    currency: config.currency,
    slotPrice: config.slotPrice,
    slotDuration: config.slotDuration,
    openHour: config.openHour,
    closeHour: config.closeHour,
  });
});

// ── AUTH ───────────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name, level, hand } = req.body;
    const existing = await Player.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existing) return res.status(400).json({ msg: "Email già registrata" });
    const hashed = await bcrypt.hash(password, 10);
    const player = new Player({
      email: email.trim().toLowerCase(),
      password: hashed,
      name,
      level,
      hand,
    });
    await player.save();
    const token = jwt.sign(
      { id: player._id, role: player.role },
      process.env.JWT_SECRET,
    );
    res.json({
      token,
      player: {
        id: player._id,
        email: player.email,
        name,
        level,
        role: player.role,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: "Errore registrazione", error: err.message });
  }
});

// app.post("/api/register", (req, res) => {
//   res.status(403).json({
//     msg: "Registrazione pubblica disabilitata. Contatta l'amministratore.",
//   });
// });

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const player = await Player.findOne({ email: email.trim().toLowerCase() });
    if (!player || !(await bcrypt.compare(password, player.password)))
      return res.status(400).json({ msg: "Credenziali errate" });
    const token = jwt.sign(
      { id: player._id, role: player.role },
      process.env.JWT_SECRET,
    );
    res.json({
      token,
      player: {
        id: player._id,
        email: player.email,
        name: player.name,
        level: player.level,
        role: player.role,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: "Errore login", error: err.message });
  }
});

// ── COURTS ────────────────────────────────────────────────────────
app.get("/api/courts", async (req, res) =>
  res.json(await Court.find().sort({ order: 1, name: 1 })),
);

app.put("/api/admin/courts/:id", auth, adminOnly, async (req, res) => {
  const court = await Court.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(court);
});

// ── PLAYERS ───────────────────────────────────────────────────────
app.get("/api/admin/players", auth, adminOnly, async (req, res) => {
  try {
    const players = await Player.find()
      .select("-password")
      .sort({ name: 1 })
      .lean();
    res.json(players);
  } catch (err) {
    res.status(500).json({ msg: "Errore", error: err.message });
  }
});
app.patch("/api/bookings/:id/players", auth, async (req, res) => {
  try {
    const { playerNames, guestPlayers } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { playerNames, guestPlayers },
      { new: true },
    );
    if (!booking)
      return res.status(404).json({ msg: "Prenotazione non trovata" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ msg: "Errore aggiornamento giocatori" });
  }
});
app.patch("/api/blocked-slots/:id/players", auth, async (req, res) => {
  try {
    const { players } = req.body;
    const slot = await BlockedSlot.findByIdAndUpdate(
      req.params.id,
      { players },
      { new: true },
    );
    if (!slot) return res.status(404).json({ msg: "Slot non trovato" });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ msg: "Errore aggiornamento giocatori" });
  }
});

// ── AVAILABILITY ──────────────────────────────────────────────────
app.get("/api/availability", async (req, res) => {
  try {
    const [bookings, blocked] = await Promise.all([
      Booking.find({ status: "confirmed" }, "court startTime endTime"),
      BlockedSlot.find({}, "court startTime endTime type"),
    ]);
    res.json({ bookings, blocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BOOKINGS ──────────────────────────────────────────────────────
app.get("/api/bookings", auth, async (req, res) => {
  const bookings = await Booking.find({
    player1: req.user.id,
    status: "confirmed",
  }).populate("court player1");
  res.json(bookings);
});

app.post("/api/bookings", auth, async (req, res) => {
  try {
    const { court, startTime, duration, players: rawPlayers = [] } = req.body;
    if (!["1h", "1h30min"].includes(duration))
      return res.status(400).json({ msg: "Durata deve essere 1h o 1h30min" });

    const minutes = duration === "1h" ? 60 : 90;
    const start = toDate(startTime);
    const end = new Date(start.getTime() + minutes * 60000);

    const courtDoc = await Court.findById(court);
    if (!courtDoc || courtDoc.status !== "available")
      return res.status(400).json({ msg: "Campo non disponibile" });

    const overlap = await Booking.findOne({
      court,
      status: "confirmed",
      startTime: { $lt: end },
      endTime: { $gt: start },
    });
    if (overlap) return res.status(400).json({ msg: "Slot occupato" });

    const registeredPlayerIds = [];
    const guestPlayers = [];
    for (const input of rawPlayers) {
      if (!input?.trim()) continue;
      const trimmed = input.trim();
      const found = await Player.findOne({
        $or: [
          { email: trimmed.toLowerCase() },
          { name: { $regex: new RegExp(`^${trimmed}$`, "i") } },
        ],
      });
      if (found) {
        if (found._id.toString() !== req.user.id)
          registeredPlayerIds.push(found._id);
      } else {
        guestPlayers.push(trimmed);
      }
    }

    const booking = new Booking({
      court,
      player1: req.user.id,
      players: registeredPlayerIds,
      guestPlayers,
      startTime: start,
      endTime: end,
    });
    await booking.save();

    if (registeredPlayerIds.length > 0) {
      const [organizerDoc, playerDocs] = await Promise.all([
        Player.findById(req.user.id),
        Player.find({ _id: { $in: registeredPlayerIds } }),
      ]);
      for (const player of playerDocs) {
        sendBookingNotification({
          player,
          court: courtDoc,
          booking,
          organizer: organizerDoc,
        }).catch((err) =>
          console.error(`❌ Mail non inviata a ${player.email}:`, err),
        );
      }
    }
    res.json({ msg: `Prenotazione ${duration} confermata! 🎾`, booking });
  } catch (err) {
    console.error("❌ BOOKING ERROR:", err.message, err.stack);
    res.status(500).json({ msg: "Errore creazione prenotazione" });
  }
});

app.patch("/api/bookings/:id/players", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ msg: "Prenotazione non trovata" });
    if (booking.player1.toString() !== req.user.id)
      return res.status(403).json({ msg: "Non autorizzato" });

    const guestPlayers = [];
    const registeredIds = [];
    for (const input of req.body.players) {
      if (!input?.trim()) continue;
      const found = await Player.findOne({
        $or: [
          { email: input.trim().toLowerCase() },
          { name: { $regex: new RegExp(`^${input.trim()}$`, "i") } },
        ],
      });
      if (found) registeredIds.push(found._id);
      else guestPlayers.push(input.trim());
    }
    booking.players = [...booking.players, ...registeredIds];
    booking.guestPlayers = [...(booking.guestPlayers || []), ...guestPlayers];
    await booking.save();
    res.json(booking);
  } catch (err) {
    res.status(500).json({ msg: "Errore server", err });
  }
});

app.patch("/api/bookings/:id/cancel", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ msg: "Prenotazione non trovata" });
    if (booking.status === "cancelled")
      return res.status(400).json({ msg: "Prenotazione già cancellata" });
    const player = await Player.findById(req.user.id);
    if (booking.player1.toString() !== req.user.id && player.role !== "admin")
      return res.status(403).json({ msg: "Non autorizzato" });
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user.id;
    await booking.save();
    res.json({ msg: "Prenotazione cancellata", booking });
  } catch (err) {
    res.status(500).json({ msg: "Errore server", err });
  }
});

app.delete("/api/bookings/:id", auth, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking)
    return res.status(404).json({ msg: "Prenotazione non trovata" });
  if (booking.player1.toString() !== req.user.id)
    return res.status(403).json({ msg: "Non autorizzato" });
  if (new Date(booking.startTime) < new Date())
    return res
      .status(400)
      .json({ msg: "Non puoi cancellare prenotazioni passate" });
  booking.status = "cancelled";
  await booking.save();
  res.json({ msg: "Prenotazione cancellata" });
});

// ── ADMIN BOOKINGS ────────────────────────────────────────────────
app.get("/api/admin/bookings", auth, adminOnly, async (req, res) => {
  const bookings = await Booking.find({ status: "confirmed" })
    .populate("court player1")
    .sort({ startTime: 1 })
    .lean();
  res.json(bookings);
});

app.get("/api/admin/bookings/cancelled", auth, adminOnly, async (req, res) => {
  try {
    const cancelled = await Booking.find({ status: "cancelled" })
      .populate("court player1 cancelledBy")
      .sort({ cancelledAt: -1 })
      .lean();
    res.json(cancelled);
  } catch (err) {
    res.status(500).json({ msg: "Errore server", err });
  }
});

app.delete("/api/admin/bookings/:id", auth, adminOnly, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking)
    return res.status(404).json({ msg: "Prenotazione non trovata" });
  booking.status = "cancelled";
  await booking.save();
  res.json({ msg: "Prenotazione cancellata dall'admin" });
});

// ── BLOCKED SLOTS ─────────────────────────────────────────────────
app.get("/api/blocked-slots", auth, async (req, res) => {
  res.json(await BlockedSlot.find().populate("court"));
});

app.post("/api/blocked-slots", auth, adminOnly, async (req, res) => {
  const { court, type, startTime, endTime, note, tournamentId, players } =
    req.body;
  // ← usa toDate() per correggere il timezone
  const start = toDate(startTime);
  const end = toDate(endTime);
  const filteredPlayers = players.filter((p) => p?.trim());
  if (type === "blocked" && filteredPlayers.length === 0)
    return res.status(400).json({ msg: "Inserire almeno un giocatore" });
  if ((type === "academy" || type === "lesson") && !note?.trim())
    return res
      .status(400)
      .json({ msg: "La nota è obbligatoria per Academy e Lezione" });

  const overlap = await Booking.findOne({
    court,
    status: "confirmed",
    startTime: { $lt: end },
    endTime: { $gt: start },
  });
  if (overlap)
    return res.status(400).json({ msg: "Slot già prenotato da un utente" });

  const slot = new BlockedSlot({
    court,
    type,
    startTime: start,
    endTime: end,
    note,
    tournamentId,
    players,
  });
  await slot.save();
  res.json(slot);
});

app.delete("/api/blocked-slots/:id", auth, adminOnly, async (req, res) => {
  try {
    const slot = await BlockedSlot.findByIdAndDelete(req.params.id);
    if (!slot) return res.status(404).json({ msg: "Slot non trovato" });
    res.json({ msg: "Slot rimosso" });
  } catch (err) {
    res.status(500).json({ msg: "Errore server", err });
  }
});

// ── SLOTS DISPONIBILI ─────────────────────────────────────────────
app.get("/api/slots/:courtId", async (req, res) => {
  const courtId = req.params.courtId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const court = await Court.findById(courtId).lean();
  if (!court || court.status !== "available") return res.json([]);

  // Usa offset italiano per la finestra giornaliera
  const dayStart = italyTime(date, "00:00");
  const dayEnd = italyTime(date, "23:59");

  const [dayBookings, dayBlocked] = await Promise.all([
    Booking.find({
      court: courtId,
      status: "confirmed",
      startTime: { $lt: dayEnd },
      endTime: { $gt: dayStart },
    }).lean(),
    BlockedSlot.find({
      court: courtId,
      startTime: { $lt: dayEnd },
      endTime: { $gt: dayStart },
    }).lean(),
  ]);

  const slots = [];
  const startHour = ["Campo 2", "Campo 4"].includes(court.name) ? 8.5 : 8;

  for (let h = startHour; h <= 21; h += 0.5) {
    const hh = Math.floor(h);
    const mm = h % 1 !== 0 ? 30 : 0;
    const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const slotStart = italyTime(date, timeStr);
    const slotEnd = new Date(slotStart.getTime() + 90 * 60 * 1000);

    const hasBooking = dayBookings.some(
      (b) => new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart,
    );
    const hasBlocked = dayBlocked.some(
      (b) => new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart,
    );

    if (!hasBooking && !hasBlocked) {
      const endHH = Math.floor(h + 1.5);
      const endMM = (h + 1.5) % 1 === 0.5 ? 30 : 0;
      slots.push({
        start: `${date}T${timeStr}`,
        end: `${date}T${String(endHH).padStart(2, "0")}:${String(endMM).padStart(2, "0")}`,
        duration: "1h30min",
      });
    }
  }
  res.json(slots);
});

// ── CALENDAR ──────────────────────────────────────────────────────
app.get("/api/calendar", auth, async (req, res) => {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 30);

  const [bookings, blockedSlots] = await Promise.all([
    Booking.find({
      startTime: { $gte: weekStart, $lte: weekEnd },
      status: "confirmed",
    })
      .populate("court")
      .populate("player1", "name")
      .populate("players", "name")
      .lean(),
    BlockedSlot.find({ startTime: { $gte: weekStart, $lte: weekEnd } })
      .populate("court")
      .lean(),
  ]);

  const bookingEvents = bookings
    .filter((b) => b.court && b.player1)
    .map((b) => ({
      id: b._id,
      title: b.player1.name,
      start: b.startTime,
      end: b.endTime,
      extendedProps: {
        courtId: b.court._id.toString(),
        type: "booking",
        player1Name: b.player1.name,
        playerNames: (b.players || []).map((p) => p.name),
        guestPlayers: b.guestPlayers || [],
      },
    }));

  const blockedEvents = blockedSlots
    .filter((s) => s.court)
    .map((s) => {
      // Per "blocked" con players → usa i nomi come title
      const playersLabel =
        s.type === "blocked" && s.players?.length > 0
          ? s.players.join(" · ")
          : null;

      const title =
        s.type === "academy"
          ? `🎓 ${s.note || "Academy"}`
          : s.type === "lesson"
            ? `👨‍🏫 ${s.note || "Lezione"}`
            : playersLabel
              ? playersLabel // ← nomi diretti, senza 🔒
              : `🔒 ${s.note || "Campo Bloccato"}`;

      return {
        id: `blocked-${s._id}`,
        title,
        start: s.startTime,
        end: s.endTime,
        extendedProps: {
          courtId: s.court._id.toString(),
          type: s.type,
          blockedSlotId: s._id.toString(),
          players: s.players || [], // ← NUOVO: espone i players
        },
      };
    });

  res.json([...bookingEvents, ...blockedEvents]);
});

// ── STATS ─────────────────────────────────────────────────────────
app.get("/api/dashboard", auth, async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const bookings = await Booking.find({
    startTime: { $gte: weekAgo },
    status: "confirmed",
  }).populate("court");
  const occupancy = bookings.reduce((acc, b) => {
    acc[b.court.name] = (acc[b.court.name] || 0) + 1;
    return acc;
  }, {});
  res.json({ occupancy, totalBookings: bookings.length });
});

app.get("/api/admin/stats", auth, adminOnly, async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [stats, courtsStats] = await Promise.all([
    Booking.aggregate([
      { $match: { startTime: { $gte: weekAgo }, status: "confirmed" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
          count: { $sum: 1 },
          revenue: { $sum: 40 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { startTime: { $gte: weekAgo }, status: "confirmed" } },
      { $group: { _id: "$court", bookings: { $sum: 1 } } },
      {
        $lookup: {
          from: "courts",
          localField: "_id",
          foreignField: "_id",
          as: "court",
        },
      },
    ]),
  ]);
  res.json({ stats, courtsStats });
});

app.get("/api/admin/report", auth, adminOnly, async (req, res) => {
  const now = new Date();
  const month = parseInt(req.query.month) || now.getMonth() + 1;
  const year = parseInt(req.query.year) || now.getFullYear();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [bookings, blockedSlots, courts] = await Promise.all([
    Booking.find({ status: "confirmed", startTime: { $gte: start, $lt: end } })
      .populate("court player1")
      .lean(),
    BlockedSlot.find({ startTime: { $gte: start, $lt: end } })
      .populate("court")
      .lean(),
    Court.find().lean(),
  ]);

  const courtStats = courts.map((court) => {
    const cb = bookings.filter(
      (b) => b.court?._id.toString() === court._id.toString(),
    );
    const cs = blockedSlots.filter(
      (s) => s.court?._id.toString() === court._id.toString(),
    );
    const academySlots = cs.filter((s) => s.type === "academy");
    const lessonSlots = cs.filter((s) => s.type === "lesson");
    return {
      courtName: court.name,
      bookings: cb.length,
      revenue: cb.length * (config.slotPrice || 40),
      academyHours: +(
        academySlots.reduce(
          (a, s) => a + (new Date(s.endTime) - new Date(s.startTime)) / 60000,
          0,
        ) / 60
      ).toFixed(1),
      lessonHours: +(
        lessonSlots.reduce(
          (a, s) => a + (new Date(s.endTime) - new Date(s.startTime)) / 60000,
          0,
        ) / 60
      ).toFixed(1),
      academySessions: academySlots.length,
      lessonSessions: lessonSlots.length,
    };
  });

  const dailyStats = bookings.reduce((acc, b) => {
    const day = new Date(b.startTime).toISOString().slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  res.json({
    month,
    year,
    totalBookings: bookings.length,
    totalRevenue: bookings.length * (config.slotPrice || 40),
    totalAcademyHours: +blockedSlots
      .filter((s) => s.type === "academy")
      .reduce(
        (a, s) => a + (new Date(s.endTime) - new Date(s.startTime)) / 3600000,
        0,
      )
      .toFixed(1),
    totalLessonHours: +blockedSlots
      .filter((s) => s.type === "lesson")
      .reduce(
        (a, s) => a + (new Date(s.endTime) - new Date(s.startTime)) / 3600000,
        0,
      )
      .toFixed(1),
    courtStats,
    dailyStats,
  });
});

// ── TORNEI — PUBLIC (DEVE STARE PRIMA DI /:id) ────────────────────
app.get("/api/tournaments/public", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tournaments = await Tournament.find({
      status: "open",
      date: { $gte: today },
    })
      .populate("courts")
      .populate("players", "name surname")
      .populate("couples.player1", "name surname")
      .populate("couples.player2", "name surname")
      .sort({ date: 1 })
      .lean();
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ msg: "Errore", error: err.message });
  }
});

// ── TORNEI — ADMIN ────────────────────────────────────────────────
app.get("/api/tournaments", auth, async (req, res) => {
  res.json(await Tournament.find().populate(T_POPULATE));
});

app.post("/api/tournaments", auth, adminOnly, async (req, res) => {
  try {
    const tournament = new Tournament(req.body);
    await tournament.save();

    // Se ha courts + startTime + endTime + date → crea i blocked slot automaticamente
    if (
      req.body.courts?.length &&
      req.body.startTime &&
      req.body.endTime &&
      req.body.date
    ) {
      const dateStr = new Date(req.body.date).toISOString().slice(0, 10);
      const start = italyTime(dateStr, req.body.startTime);
      const end = italyTime(dateStr, req.body.endTime);
      for (const courtId of req.body.courts) {
        const slot = new BlockedSlot({
          court: courtId,
          type: "blocked",
          startTime: start,
          endTime: end,
          note: `🏆 ${req.body.name}`,
          tournamentId: tournament._id,
        });
        await slot.save();
      }
    }

    res.json(await Tournament.findById(tournament._id).populate(T_POPULATE));
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Errore creazione torneo", error: err.message });
  }
});

app.put("/api/tournaments/:id", auth, adminOnly, async (req, res) => {
  try {
    const t = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate(T_POPULATE);
    res.json(t);
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Errore aggiornamento torneo", error: err.message });
  }
});

app.delete("/api/tournaments/:id", auth, adminOnly, async (req, res) => {
  try {
    await Tournament.findByIdAndDelete(req.params.id);
    // Rimuovi anche i blocked slot associati
    await BlockedSlot.deleteMany({ tournamentId: req.params.id });
    res.json({ msg: "Torneo eliminato" });
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Errore eliminazione torneo", error: err.message });
  }
});

// ── TORNEI — ISCRIZIONI ───────────────────────────────────────────
app.post("/api/tournaments/:id/players", auth, async (req, res) => {
  try {
    const { playerId } = req.body;
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    const pid = playerId || req.user.id;
    if (!t.players.map((p) => p.toString()).includes(pid)) t.players.push(pid);
    await t.save();
    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    res.status(500).json({ msg: "Errore iscrizione", error: err.message });
  }
});

app.post("/api/tournaments/:id/couples", auth, async (req, res) => {
  try {
    const { player1Id, player2Id, player2Guest } = req.body;
    if (!player1Id)
      return res.status(400).json({ msg: "Giocatore 1 mancante" });

    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    if (!t.players.map((p) => p.toString()).includes(player1Id))
      t.players.push(player1Id);

    const p1Doc = await Player.findById(player1Id);
    const p1Name =
      [p1Doc?.name, p1Doc?.surname].filter(Boolean).join(" ") || "?";

    // Caso ospite senza account
    if (player2Guest) {
      t.couples.push({
        player1: player1Id,
        player2: null,
        guestName: player2Guest,
        name: `${p1Name} / ${player2Guest} (ospite)`,
      });
      await t.save();
      return res.json(await Tournament.findById(t._id).populate(T_POPULATE));
    }

    // Cerca per ObjectId, email o nome
    let resolvedP2;
    if (player2Id?.match(/^[0-9a-fA-F]{24}$/)) {
      resolvedP2 = await Player.findById(player2Id);
    } else if (player2Id) {
      resolvedP2 = await Player.findOne({
        $or: [
          { email: player2Id.trim().toLowerCase() },
          { name: { $regex: new RegExp(`^${player2Id.trim()}$`, "i") } },
          {
            $expr: {
              $regexMatch: {
                input: {
                  $concat: ["$name", " ", { $ifNull: ["$surname", ""] }],
                },
                regex: player2Id.trim(),
                options: "i",
              },
            },
          },
        ],
      });
    }

    if (!resolvedP2)
      return res
        .status(404)
        .json({ msg: `Giocatore "${player2Id}" non trovato`, notFound: true });

    if (player1Id === resolvedP2._id.toString())
      return res.status(400).json({ msg: "I giocatori devono essere diversi" });

    if (!t.players.map((p) => p.toString()).includes(resolvedP2._id.toString()))
      t.players.push(resolvedP2._id);

    const p2Name = [resolvedP2.name, resolvedP2.surname]
      .filter(Boolean)
      .join(" ");
    t.couples.push({
      player1: player1Id,
      player2: resolvedP2._id,
      name: `${p1Name} / ${p2Name}`,
    });
    await t.save();
    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    res.status(500).json({ msg: "Errore aggiunta coppia", error: err.message });
  }
});

app.post("/api/tournaments/:id/couples/register", auth, async (req, res) => {
  try {
    const { player1Id, newPlayer } = req.body;
    if (!newPlayer?.name || !newPlayer?.email)
      return res.status(400).json({ msg: "Nome e email obbligatori" });

    const exists = await Player.findOne({
      email: newPlayer.email.trim().toLowerCase(),
    });
    if (exists)
      return res
        .status(400)
        .json({ msg: "Email già registrata — cerca il giocatore per email" });

    const tempPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(tempPassword, 10);
    const newP = new Player({
      name: newPlayer.name.trim(),
      surname: newPlayer.surname?.trim() || "",
      email: newPlayer.email.trim().toLowerCase(),
      password: hashed,
      level: newPlayer.level || "intermedio",
      hand: newPlayer.hand || "destra",
      role: "player",
    });
    await newP.save();

    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    if (!t.players.map((p) => p.toString()).includes(player1Id))
      t.players.push(player1Id);
    t.players.push(newP._id);

    const p1Doc = await Player.findById(player1Id);
    const p1Name =
      [p1Doc?.name, p1Doc?.surname].filter(Boolean).join(" ") || "?";
    const p2Name = [newP.name, newP.surname].filter(Boolean).join(" ");

    t.couples.push({
      player1: player1Id,
      player2: newP._id,
      name: `${p1Name} / ${p2Name}`,
    });
    await t.save();

    res.json({
      tournament: await Tournament.findById(t._id).populate(T_POPULATE),
      newPlayer: {
        id: newP._id,
        name: p2Name,
        email: newP.email,
        tempPassword,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Errore registrazione partner", error: err.message });
  }
});

app.post("/api/tournaments/:id/pair", auth, adminOnly, async (req, res) => {
  const tournament = await Tournament.findById(req.params.id).populate(
    "players",
  );
  const sorted = tournament.players.sort((a, b) => {
    const levels = { agonista: 3, avanzato: 2, intermedio: 1, principiante: 0 };
    return levels[b.level] - levels[a.level];
  });
  const matches = [];
  for (let i = 0; i < sorted.length; i += 2) {
    if (sorted[i + 1])
      matches.push({ player1: sorted[i]._id, player2: sorted[i + 1]._id });
  }
  tournament.matches = matches;
  tournament.status = "running";
  await tournament.save();
  res.json({ matches });
});

// ── SPONSORS ──────────────────────────────────────────────────────
app.get("/api/sponsors", async (req, res) => {
  res.json(await Sponsor.find({ active: true }).sort({ order: 1 }));
});

app.post("/api/sponsors", auth, adminOnly, async (req, res) => {
  const sponsor = new Sponsor(req.body);
  await sponsor.save();
  res.json(sponsor);
});

app.put("/api/sponsors/:id", auth, adminOnly, async (req, res) => {
  const sponsor = await Sponsor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(sponsor);
});

app.delete("/api/sponsors/:id", auth, adminOnly, async (req, res) => {
  await Sponsor.findByIdAndDelete(req.params.id);
  res.json({ msg: "Sponsor rimosso" });
});

// ── START ─────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Routes: tournaments/public ✓ admin/players ✓ timezone fix ✓`);
});
