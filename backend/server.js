require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

// ── Models ─────────────────────────────────────────────────────────
const Court = require("./models/Court");
const Player = require("./models/Player");
const Booking = require("./models/Booking");
const BlockedSlot = require("./models/BlockedSlot");
const Tournament = require("./models/Tournament");
const Sponsor = require("./models/Sponsor");
const config = require("./config");

// ── App ────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;

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
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ── Mailer ─────────────────────────────────────────────────────────
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

// ── Middleware auth ────────────────────────────────────────────────
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

// Helper: verifica che l'utente sia admin
const requireAdmin = async (req, res) => {
  const player = await Player.findById(req.user.id);
  if (!player || player.role !== "admin") {
    res.status(403).json({ msg: "Admin only" });
    return null;
  }
  return player;
};

// ── Populate string comune per Tournament ─────────────────────────
const T_POPULATE = [
  { path: "players" },
  { path: "courts" },
  { path: "couples.player1" },
  { path: "couples.player2" },
  { path: "matches.couple1" },
  { path: "matches.couple2" },
  { path: "matches.winner" },
];

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════
app.get("/api/init", async (req, res) => {
  await Court.deleteMany({});
  await Court.insertMany(config.courts.map((name) => ({ name })));
  res.json({ msg: "Dati inizializzati" });
});

// ══════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name, level, hand } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const player = new Player({ email, password: hashed, name, level, hand });
    await player.save();
    const token = jwt.sign(
      { id: player._id, role: player.role },
      process.env.JWT_SECRET,
    );
    res.json({ token, player: { id: player._id, email, name, level } });
  } catch (err) {
    res.status(500).json({ msg: "Errore registrazione", error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ msg: "Errore login", error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// CONFIG (pubblico)
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// COURTS
// ══════════════════════════════════════════════════════════════════
app.get("/api/courts", async (req, res) => {
  res.json(await Court.find());
});

app.put("/api/admin/courts/:id", auth, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const court = await Court.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(court);
});

// ══════════════════════════════════════════════════════════════════
// AVAILABILITY (pubblica)
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// SLOTS DISPONIBILI
// ══════════════════════════════════════════════════════════════════
app.get("/api/slots/:courtId", async (req, res) => {
  const courtId = req.params.courtId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const court = await Court.findById(courtId).lean();
  if (!court || court.status !== "available") return res.json([]);

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

  const slots = [];
  const startHour = ["Campo 2", "Campo 4"].includes(court.name) ? 8.5 : 8;

  for (let h = startHour; h <= 21.5; h += 1.5) {
    const hh = Math.floor(h);
    const mm = h % 1 === 0.5 ? 30 : 0;
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

    if (!hasBooking && !hasBlocked) {
      const endH = Math.floor(h + 1.5);
      const endM = (h + 1.5) % 1 === 0.5 ? 30 : 0;
      slots.push({
        start: `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        end: `${date}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        duration: "1h30min",
      });
    }
  }
  res.json(slots);
});

// ══════════════════════════════════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════════════════════════════════
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
      const found = await Player.findOne({
        $or: [
          { email: input.trim().toLowerCase() },
          { name: { $regex: new RegExp(`^${input.trim()}$`, "i") } },
        ],
      });
      if (found) {
        if (found._id.toString() !== req.user.id)
          registeredPlayerIds.push(found._id);
      } else {
        guestPlayers.push(input.trim());
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
      return res.status(400).json({ msg: "Già cancellata" });
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

// ══════════════════════════════════════════════════════════════════
// ADMIN BOOKINGS
// ══════════════════════════════════════════════════════════════════
app.get("/api/admin/bookings", auth, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const bookings = await Booking.find({ status: "confirmed" })
    .populate("court player1")
    .sort({ startTime: 1 })
    .lean();
  res.json(bookings);
});

app.get("/api/admin/bookings/cancelled", auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
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
  if (!(await requireAdmin(req, res))) return;
  const booking = await Booking.findById(req.params.id);
  if (!booking)
    return res.status(404).json({ msg: "Prenotazione non trovata" });
  booking.status = "cancelled";
  await booking.save();
  res.json({ msg: "Prenotazione cancellata dall'admin" });
});

// ══════════════════════════════════════════════════════════════════
// BLOCKED SLOTS
// ══════════════════════════════════════════════════════════════════
app.get("/api/blocked-slots", auth, async (req, res) => {
  res.json(await BlockedSlot.find().populate("court"));
});

app.post("/api/blocked-slots", auth, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
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
    if (!(await requireAdmin(req, res))) return;
    const slot = await BlockedSlot.findByIdAndDelete(req.params.id);
    if (!slot) return res.status(404).json({ msg: "Slot non trovato" });
    res.json({ msg: "Slot rimosso" });
  } catch (err) {
    res.status(500).json({ msg: "Errore server", err });
  }
});

// ══════════════════════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════════════════════
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
      const cfgMap = {
        academy: {
          color: { bg: "#3b82f6", border: "#2563eb" },
          label: `🎓 ${s.note || "Academy"}`,
        },
        lesson: {
          color: { bg: "#a855f7", border: "#9333ea" },
          label: `👨‍🏫 ${s.note || "Lezione"}`,
        },
      };
      const { color, label } = cfgMap[s.type] || {
        color: { bg: "#ef4444", border: "#ca8a04" },
        label: `🔒 ${s.note || "Campo Bloccato"}`,
      };
      return {
        id: `blocked-${s._id}`,
        title: label,
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

// ══════════════════════════════════════════════════════════════════
// STATS / DASHBOARD
// ══════════════════════════════════════════════════════════════════
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
  if (!(await requireAdmin(req, res))) return;
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

app.get("/api/admin/report", auth, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
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
    const hrs = (arr) =>
      +(
        arr.reduce(
          (a, s) => a + (new Date(s.endTime) - new Date(s.startTime)) / 60000,
          0,
        ) / 60
      ).toFixed(1);
    const acad = cs.filter((s) => s.type === "academy");
    const less = cs.filter((s) => s.type === "lesson");
    return {
      courtName: court.name,
      bookings: cb.length,
      revenue: cb.length * 40,
      academyHours: hrs(acad),
      lessonHours: hrs(less),
      academySessions: acad.length,
      lessonSessions: less.length,
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
    totalRevenue: bookings.length * 40,
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

// ══════════════════════════════════════════════════════════════════
// SPONSORS
// ══════════════════════════════════════════════════════════════════
app.get("/api/sponsors", async (req, res) => {
  res.json(await Sponsor.find({ active: true }).sort({ order: 1 }));
});

app.post("/api/sponsors", auth, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const sponsor = new Sponsor(req.body);
  await sponsor.save();
  res.json(sponsor);
});

app.put("/api/sponsors/:id", auth, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const sponsor = await Sponsor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(sponsor);
});

app.delete("/api/sponsors/:id", auth, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  await Sponsor.findByIdAndDelete(req.params.id);
  res.json({ msg: "Sponsor rimosso" });
});

// ══════════════════════════════════════════════════════════════════
// ADMIN PLAYERS
// ══════════════════════════════════════════════════════════════════
app.get("/api/admin/players", auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const players = await Player.find().select("-password").sort({ name: 1 });
    res.json(players);
  } catch (err) {
    res.status(500).json({ msg: "Errore server", error: err.message });
  }
});

app.post("/api/admin/players", auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { name, email, password, level, hand } = req.body;

    console.log("📥 Body ricevuto:", req.body); // ← aggiungi questo

    if (!name) return res.status(400).json({ msg: "Nome obbligatorio" });

    const finalEmail = email?.trim() || `guest_${Date.now()}@torneo.local`;
    if (email?.trim()) {
      const exists = await Player.findOne({ email: finalEmail });
      if (exists) return res.status(400).json({ msg: "Email già registrata" });
    }

    const validLevels = ["principiante", "intermedio", "avanzato", "agonista"];
    const finalLevel = validLevels.includes(level) ? level : "intermedio";

    const hashed = await bcrypt.hash(
      password || Math.random().toString(36).slice(-8),
      10,
    );
    const newPlayer = new Player({
      name: name.trim(),
      email: finalEmail,
      password: hashed,
      level: finalLevel,
      hand: hand || "destra",
      role: "player",
    });

    console.log("💾 Player da salvare:", newPlayer); // ← aggiungi questo

    await newPlayer.save();
    res.json(newPlayer);
  } catch (err) {
    // ← questo è il log più importante
    console.error("❌ CREATE PLAYER ERROR:", err.message);
    console.error("❌ FULL ERROR:", JSON.stringify(err, null, 2));
    res
      .status(500)
      .json({ msg: "Errore creazione giocatore", error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// TOURNAMENTS — CRUD base
// ══════════════════════════════════════════════════════════════════
app.get("/api/tournaments", auth, async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .populate(T_POPULATE)
      .sort({ date: -1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ msg: "Errore server", error: err.message });
  }
});

app.get("/api/tournaments/:id", auth, async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id).populate(T_POPULATE);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    res.json(t);
  } catch (err) {
    res.status(500).json({ msg: "Errore server" });
  }
});

app.post("/api/tournaments", auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const t = new Tournament(req.body);
    await t.save();
    res.json(t);
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Errore creazione torneo", error: err.message });
  }
});

app.put("/api/tournaments/:id", auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const t = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate(T_POPULATE);
    res.json(t);
  } catch (err) {
    res.status(500).json({ msg: "Errore modifica torneo" });
  }
});

app.delete("/api/tournaments/:id", auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ msg: "Torneo eliminato" });
  } catch (err) {
    res.status(500).json({ msg: "Errore eliminazione torneo" });
  }
});

// ══════════════════════════════════════════════════════════════════
// TOURNAMENTS — GIOCATORI
// ══════════════════════════════════════════════════════════════════
app.post("/api/tournaments/:id/players", auth, async (req, res) => {
  try {
    const { playerId } = req.body;
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    if (!t.players.map((p) => p.toString()).includes(playerId))
      t.players.push(playerId);
    await t.save();
    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Errore aggiunta giocatore", error: err.message });
  }
});

app.delete("/api/tournaments/:id/players/:playerId", auth, async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    t.players = t.players.filter((p) => p.toString() !== req.params.playerId);
    await t.save();
    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    res.status(500).json({ msg: "Errore rimozione giocatore" });
  }
});

// ══════════════════════════════════════════════════════════════════
// TOURNAMENTS — COPPIE
// ══════════════════════════════════════════════════════════════════
app.post("/api/tournaments/:id/couples", auth, async (req, res) => {
  try {
    const { player1Id, player2Id, name } = req.body;
    if (!player1Id || !player2Id)
      return res.status(400).json({ msg: "Servono due giocatori" });
    if (player1Id === player2Id)
      return res.status(400).json({ msg: "I giocatori devono essere diversi" });

    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    // Auto-aggiungi i giocatori alla lista players del torneo
    if (!t.players.map((p) => p.toString()).includes(player1Id))
      t.players.push(player1Id);
    if (!t.players.map((p) => p.toString()).includes(player2Id))
      t.players.push(player2Id);

    // Nome automatico se non fornito
    let coupleName = name?.trim();
    if (!coupleName) {
      const [p1, p2] = await Promise.all([
        Player.findById(player1Id),
        Player.findById(player2Id),
      ]);
      coupleName = `${p1?.name || "?"} / ${p2?.name || "?"}`;
    }

    t.couples.push({
      player1: player1Id,
      player2: player2Id,
      name: coupleName,
    });
    await t.save();
    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    res.status(500).json({ msg: "Errore aggiunta coppia", error: err.message });
  }
});

app.delete("/api/tournaments/:id/couples/:coupleId", auth, async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    t.couples.pull({ _id: req.params.coupleId });
    await t.save();
    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    res.status(500).json({ msg: "Errore rimozione coppia" });
  }
});

// Toggle testa di serie
app.patch(
  "/api/tournaments/:id/couples/:coupleId/seed",
  auth,
  async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const t = await Tournament.findById(req.params.id);
      if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
      const couple = t.couples.id(req.params.coupleId);
      if (!couple) return res.status(404).json({ msg: "Coppia non trovata" });
      couple.seeded = req.body.seeded ?? !couple.seeded;
      await t.save();
      res.json(await Tournament.findById(t._id).populate(T_POPULATE));
    } catch (err) {
      res.status(500).json({ msg: "Errore aggiornamento seed" });
    }
  },
);

// ══════════════════════════════════════════════════════════════════
// TOURNAMENTS — MATCH (risultati)
// ══════════════════════════════════════════════════════════════════
app.put("/api/tournaments/:id/matches/:matchId", auth, async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    const match = t.matches.id(req.params.matchId);
    if (!match) return res.status(404).json({ msg: "Match non trovato" });

    if (req.body.score !== undefined) match.score = req.body.score;
    if (req.body.winner !== undefined) match.winner = req.body.winner;
    if (req.body.couple1 !== undefined) match.couple1 = req.body.couple1;
    if (req.body.couple2 !== undefined) match.couple2 = req.body.couple2;
    if (req.body.court !== undefined) match.court = req.body.court;
    if (req.body.time !== undefined) match.time = req.body.time;

    // Se match di girone completato → prova ad avanzare al bracket
    if (match.phase === "group" && match.winner) {
      advanceBracket(t);
    }
    // Se match di bracket completato → avanza il vincitore al turno successivo
    if ((match.phase === "gold" || match.phase === "silver") && match.winner) {
      advanceBracketWinner(t, match);
    }

    await t.save();
    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Errore aggiornamento match", error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// TOURNAMENTS — GENERA TABELLONE
// ══════════════════════════════════════════════════════════════════
app.post("/api/tournaments/:id/draw", auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    if (t.couples.length < 3)
      return res.status(400).json({ msg: "Servono almeno 3 coppie" });

    // ── 1. Separa seeds e non-seeds ──────────────────────────────
    const seeded = t.couples.filter((c) => c.seeded);
    const nonSeeded = shuffle(t.couples.filter((c) => !c.seeded));

    // ── 2. Calcola numero e dimensione gironi ────────────────────
    const total = t.couples.length;
    let numGroups;
    if (total % 4 === 0)
      numGroups = total / 4; // tutti da 4
    else if (total % 3 === 0)
      numGroups = total / 3; // tutti da 3
    else numGroups = Math.ceil(total / 4); // misto

    // ── 3. Crea gironi e distribuisci seeds (uno per girone) ─────
    const groups = Array.from({ length: numGroups }, (_, i) => ({
      number: i + 1,
      couples: [],
    }));
    seeded.forEach((c, i) => {
      groups[i % numGroups].couples.push(c._id);
    });

    // Distribuisci i non-seeded riempiendo i gironi con meno coppie
    for (const c of nonSeeded) {
      const minLen = Math.min(...groups.map((g) => g.couples.length));
      const target = groups.find((g) => g.couples.length === minLen);
      target.couples.push(c._id);
    }

    // ── 4. Genera match round-robin per ogni girone ──────────────
    const groupMatches = [];
    for (const group of groups) {
      const cs = group.couples;
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          groupMatches.push({
            couple1: cs[i],
            couple2: cs[j],
            phase: "group",
            group: group.number,
            score: "",
          });
        }
      }
    }

    // ── 5. Genera placeholder bracket Gold e Silver ──────────────
    // Gold: numGroups * 2 qualificate (prime 2 per girone)
    // Silver: numGroups qualificate (terze)
    const goldMatches = generateEmptyBracket("gold", numGroups * 2);
    const silverMatches = generateEmptyBracket("silver", numGroups);

    // ── 6. Salva ─────────────────────────────────────────────────
    t.groups = groups;
    t.matches = [...groupMatches, ...goldMatches, ...silverMatches];
    t.status = "running";
    await t.save();

    res.json(await Tournament.findById(t._id).populate(T_POPULATE));
  } catch (err) {
    console.error("❌ DRAW ERROR:", err);
    res
      .status(500)
      .json({ msg: "Errore generazione tabellone", error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// UTILITY — Generazione bracket e avanzamento
// ══════════════════════════════════════════════════════════════════

function generateEmptyBracket(phase, numTeams) {
  if (numTeams < 2) return [];
  const slots = nextPowerOf2(numTeams);
  const rounds = Math.log2(slots);
  const labels = { 1: "F", 2: "SF", 4: "QF", 8: "R16", 16: "R32" };
  const matches = [];
  for (let r = 1; r <= rounds; r++) {
    const matchesInRound = slots / Math.pow(2, r);
    const label = labels[matchesInRound] || `R${matchesInRound * 2}`;
    for (let m = 0; m < matchesInRound; m++) {
      matches.push({
        couple1: null,
        couple2: null,
        phase,
        round: label,
        score: "",
      });
    }
  }
  return matches;
}

function advanceBracket(t) {
  // Controlla se tutti i match di girone sono completati
  const groupNums = [
    ...new Set(
      t.matches.filter((m) => m.phase === "group").map((m) => m.group),
    ),
  ];
  const allDone = groupNums.every((gNum) =>
    t.matches
      .filter((m) => m.phase === "group" && m.group === gNum)
      .every((m) => m.winner),
  );
  if (!allDone) return;

  // Calcola classifica per ogni girone
  const rankings = {};
  for (const gNum of groupNums) {
    const gCouples = t.groups.find((g) => g.number === gNum)?.couples || [];
    const stats = {};
    gCouples.forEach((id) => {
      stats[id.toString()] = { id, wins: 0, losses: 0 };
    });
    t.matches
      .filter((m) => m.phase === "group" && m.group === gNum && m.winner)
      .forEach((m) => {
        const w = m.winner.toString();
        const l =
          m.couple1.toString() === w
            ? m.couple2.toString()
            : m.couple1.toString();
        if (stats[w]) stats[w].wins++;
        if (stats[l]) stats[l].losses++;
      });
    rankings[gNum] = Object.values(stats).sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses,
    );
  }

  // Popola Gold con prime 2 di ogni girone, Silver con le terze
  const goldTeams = [
    ...groupNums.map((g) => rankings[g][0]?.id),
    ...groupNums.map((g) => rankings[g][1]?.id),
  ].filter(Boolean);
  const silverTeams = groupNums.map((g) => rankings[g][2]?.id).filter(Boolean);

  fillFirstRound(t, "gold", goldTeams);
  fillFirstRound(t, "silver", silverTeams);
}

function fillFirstRound(t, phase, teams) {
  const ROUND_ORDER = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
  const phaseMatches = t.matches.filter((m) => m.phase === phase);
  if (!phaseMatches.length) return;
  const firstRoundLabel = phaseMatches
    .map((m) => m.round)
    .sort((a, b) => (ROUND_ORDER[a] ?? 5) - (ROUND_ORDER[b] ?? 5))[0];

  const firstRoundMatches = phaseMatches.filter(
    (m) => m.round === firstRoundLabel,
  );
  for (let i = 0; i < firstRoundMatches.length; i++) {
    firstRoundMatches[i].couple1 = teams[i * 2] || null;
    firstRoundMatches[i].couple2 = teams[i * 2 + 1] || null;
  }
}

function advanceBracketWinner(t, completedMatch) {
  const phase = completedMatch.phase;
  const ROUND_ORDER = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
  const phaseMatches = t.matches.filter((m) => m.phase === phase);

  // Trova il round successivo
  const rounds = [...new Set(phaseMatches.map((m) => m.round))].sort(
    (a, b) => (ROUND_ORDER[a] ?? 5) - (ROUND_ORDER[b] ?? 5),
  );
  const currentRoundIdx = rounds.indexOf(completedMatch.round);
  if (currentRoundIdx === -1 || currentRoundIdx === rounds.length - 1) return; // È la finale

  const currentRound = rounds[currentRoundIdx];
  const nextRound = rounds[currentRoundIdx + 1];
  const currentMatches = phaseMatches.filter((m) => m.round === currentRound);
  const nextMatches = phaseMatches.filter((m) => m.round === nextRound);

  // Controlla se tutti i match del round corrente sono completati
  if (!currentMatches.every((m) => m.winner)) return;

  // Mappa i vincitori nel round successivo
  const winners = currentMatches.map((m) => m.winner);
  for (let i = 0; i < nextMatches.length; i++) {
    nextMatches[i].couple1 = winners[i * 2] || null;
    nextMatches[i].couple2 = winners[i * 2 + 1] || null;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// ══════════════════════════════════════════════════════════════════
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`),
);
