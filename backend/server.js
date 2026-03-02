require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// ── TUTTI I REQUIRE IN CIMA ────────────────────────────────────────
const Court = require("./models/Court");
const Player = require("./models/Player");
const Booking = require("./models/Booking");
const BlockedSlot = require("./models/BlockedSlot"); // ← SPOSTATO QUI
const Tournament = require("./models/Tournament");
const nodemailer = require("nodemailer");
const config = require("./config");

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
  });
  const endStr = new Date(booking.endTime).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
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
  } catch (e) {
    res.status(401).json({ msg: "Invalid token" });
  }
};

const PORT = process.env.PORT || 4000;

// ── INIT ───────────────────────────────────────────────────────────
app.get("/api/init", async (req, res) => {
  await Court.deleteMany({});
  await Court.insertMany(config.courts.map((name) => ({ name })));
  res.json({ msg: "Dati inizializzati" });
});

// ── AUTH ───────────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  const { email, password, name, level, hand } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const player = new Player({ email, password: hashed, name, level, hand });
  await player.save();
  const token = jwt.sign(
    { id: player._id, role: player.role },
    process.env.JWT_SECRET,
  );
  res.json({ token, player: { id: player._id, email, name, level } });
});

// ── LOGIN (una sola volta) ─────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const player = await Player.findOne({ email });
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
    },
  });
});

// Endpoint pubblico — nessun auth richiesto
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
// ── COURTS ────────────────────────────────────────────────────────
app.get("/api/courts", async (req, res) => {
  res.json(await Court.find());
});

app.put("/api/admin/courts/:id", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  const court = await Court.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(court);
});
// ── PUBLIC AVAILABILITY ────────────────────────────────────────────
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
app.patch("/api/bookings/:id/players", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ msg: "Prenotazione non trovata" });
    if (booking.player1.toString() !== req.user.id)
      return res.status(403).json({ msg: "Non autorizzato" });

    // Distingue tra player registrati e guest
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

// ── BOOKINGS ───────────────────────────────────────────────────────
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
    const durations = ["1h", "1h30min"];
    if (!durations.includes(duration))
      return res.status(400).json({ msg: "Durata deve essere 1h o 1h30min" });

    const minutes = duration === "1h" ? 60 : 90;
    const start = new Date(startTime);
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
    console.error("❌ BOOKING ERROR:", err.message, err.stack); // ← aggiungi
    res.status(500).json({ msg: "Errore creazione prenotazione" });
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

// ── ADMIN BOOKINGS ─────────────────────────────────────────────────
app.get("/api/admin/bookings", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  const bookings = await Booking.find({ status: "confirmed" })
    .populate("court player1")
    .sort({ startTime: 1 })
    .lean();
  res.json(bookings);
});

app.get("/api/admin/bookings/cancelled", auth, async (req, res) => {
  try {
    const player = await Player.findById(req.user.id);
    if (player.role !== "admin")
      return res.status(403).json({ msg: "Admin only" });
    const cancelled = await Booking.find({ status: "cancelled" })
      .populate("court player1 cancelledBy")
      .sort({ cancelledAt: -1 })
      .lean();
    res.json(cancelled);
  } catch (err) {
    res.status(500).json({ msg: "Errore server", err });
  }
});

app.delete("/api/admin/bookings/:id", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  const booking = await Booking.findById(req.params.id);
  if (!booking)
    return res.status(404).json({ msg: "Prenotazione non trovata" });
  booking.status = "cancelled";
  await booking.save();
  res.json({ msg: "Prenotazione cancellata dall'admin" });
});

// ── BLOCKED SLOTS ──────────────────────────────────────────────────
app.get("/api/blocked-slots", auth, async (req, res) => {
  const slots = await BlockedSlot.find().populate("court");
  res.json(slots);
});

app.post("/api/blocked-slots", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  const { court, type, startTime, endTime, note } = req.body;
  const overlap = await Booking.findOne({
    court,
    status: "confirmed",
    startTime: { $lt: new Date(endTime) },
    endTime: { $gt: new Date(startTime) },
  });
  if (overlap)
    return res.status(400).json({ msg: "Slot già prenotato da un utente" });
  const slot = new BlockedSlot({ court, type, startTime, endTime, note });
  await slot.save();
  res.json(slot);
});

app.delete("/api/blocked-slots/:id", auth, async (req, res) => {
  try {
    const player = await Player.findById(req.user.id);
    if (player.role !== "admin")
      return res.status(403).json({ msg: "Admin only" });
    const slot = await BlockedSlot.findByIdAndDelete(req.params.id);
    if (!slot) return res.status(404).json({ msg: "Slot non trovato" });
    res.json({ msg: "Slot rimosso" });
  } catch (err) {
    res.status(500).json({ msg: "Errore server", err });
  }
});

// ── SLOTS DISPONIBILI ──────────────────────────────────────────────
app.get("/api/slots/:courtId", async (req, res) => {
  const courtId = req.params.courtId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const court = await Court.findById(courtId).lean();
  if (!court || court.status !== "available") return res.json([]);

  // ── Finestra giornata in ora LOCALE (no Z) ─────────────────────
  // Coerente con come il frontend salva i BlockedSlot (new Date(`${date}T${time}`))
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

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

  console.log(
    `[slots] ${date} - blocchi trovati:`,
    dayBlocked.map((b) => ({
      start: new Date(b.startTime).toLocaleString("it-IT"),
      end: new Date(b.endTime).toLocaleString("it-IT"),
    })),
  );

  const slots = [];
  const startHour = ["Campo 2", "Campo 4"].includes(court.name) ? 8.5 : 8;

  for (let h = startHour; h <= 21.5; h += 1.5) {
    const hh = Math.floor(h);
    const mm = h % 1 === 0.5 ? 30 : 0;

    // ── Slot in ora LOCALE (no Z) — coerente con i BlockedSlot ────
    const slotStart = new Date(
      `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
    );
    const slotEnd = new Date(slotStart.getTime() + 90 * 60000);

    const hasBooking = dayBookings.some(
      (b) => new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart,
    );
    const hasBlocked = dayBlocked.some(
      (b) => new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart,
    );

    console.log(
      `  slot ${slotStart.toLocaleTimeString("it-IT")} → booking:${hasBooking} blocked:${hasBlocked}`,
    );

    if (!hasBooking && !hasBlocked) {
      slots.push({
        start: `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        end: `${date}T${String(Math.floor(h + 1.5)).padStart(2, "0")}:${String((h + 1.5) % 1 === 0.5 ? 30 : 0).padStart(2, "0")}`,
        duration: "1h30min",
      });
    }
  }

  res.json(slots);
});

// ── CALENDAR ───────────────────────────────────────────────────────
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
      let color, title;
      if (s.type === "academy") {
        color = { bg: "#3b82f6", border: "#2563eb" };
        title = `🎓 ${s.note || "Academy"}`;
      } else if (s.type === "lesson") {
        color = { bg: "#a855f7", border: "#9333ea" };
        title = `👨‍🏫 ${s.note || "Lezione"}`;
      } else {
        color = { bg: "#ef4444", border: "#ca8a04" };
        title = `🔒 ${s.note || "Campo Bloccato"}`;
      }
      return {
        id: `blocked-${s._id}`,
        title,
        start: s.startTime,
        end: s.endTime,
        extendedProps: {
          courtId: s.court._id.toString(),
          type: s.type,
          blockedSlotId: s._id.toString(),
        },
      };
    });

  res.json([...bookingEvents, ...blockedEvents]);
});

// ── STATS ──────────────────────────────────────────────────────────
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

app.get("/api/admin/stats", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stats = await Booking.aggregate([
    { $match: { startTime: { $gte: weekAgo }, status: "confirmed" } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
        count: { $sum: 1 },
        revenue: { $sum: 40 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const courtsStats = await Booking.aggregate([
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
  ]);
  res.json({ stats, courtsStats });
});

app.get("/api/admin/report", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
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
  const totalBookings = bookings.length;
  const totalRevenue = totalBookings * 40;
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
      revenue: cb.length * 40,
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
    totalBookings,
    totalRevenue,
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

// ── TORNEI ─────────────────────────────────────────────────────────
app.get("/api/tournaments", auth, async (req, res) => {
  res.json(
    await Tournament.find().populate("players matches.player1 matches.player2"),
  );
});

app.post("/api/tournaments", auth, async (req, res) => {
  const tournament = new Tournament(req.body);
  await tournament.save();
  res.json(tournament);
});

app.post("/api/tournaments/:id/pair", auth, async (req, res) => {
  const tournament = await Tournament.findById(req.params.id).populate(
    "players",
  );
  const sortedPlayers = tournament.players.sort((a, b) => {
    const levels = { agonista: 3, avanzato: 2, intermedio: 1, principiante: 0 };
    return levels[b.level] - levels[a.level];
  });
  const matches = [];
  for (let i = 0; i < sortedPlayers.length; i += 2) {
    if (sortedPlayers[i + 1])
      matches.push({
        player1: sortedPlayers[i]._id,
        player2: sortedPlayers[i + 1]._id,
      });
  }
  tournament.matches = matches;
  tournament.status = "running";
  await tournament.save();
  res.json({ matches });
});
const Sponsor = require("./models/Sponsor");

// Pubblico — visibile a tutti
app.get("/api/sponsors", async (req, res) => {
  res.json(await Sponsor.find({ active: true }).sort({ order: 1 }));
});

// Admin only
app.post("/api/sponsors", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  const sponsor = new Sponsor(req.body);
  await sponsor.save();
  res.json(sponsor);
});

app.put("/api/sponsors/:id", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  const sponsor = await Sponsor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(sponsor);
});

app.delete("/api/sponsors/:id", auth, async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (player.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  await Sponsor.findByIdAndDelete(req.params.id);
  res.json({ msg: "Sponsor rimosso" });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server on port ${PORT}`));
