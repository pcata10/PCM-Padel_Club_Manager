// ════════════════════════════════════════════════════════════════════
//  PadelMAN — Tournament Manager (Local Edition)
//  ✅ Runs 100% locally: no MongoDB, no internet required
//  📁 Data stored in ./data/*.db (plain text files, portable)
// ════════════════════════════════════════════════════════════════════
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const jwt     = require("jsonwebtoken");
const bcrypt  = require("bcryptjs");
const db      = require("./db");
const config  = require("./config");

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const PORT       = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "padel-local-secret-2024";

// ── Auth middleware ──────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ msg: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
};

const adminOnly = async (req, res, next) => {
  const player = await db.players.findOneAsync({ _id: req.user.id });
  if (player?.role !== "admin")
    return res.status(403).json({ msg: "Admin only" });
  next();
};

// ── POPULATE HELPERS ─────────────────────────────────────────────
// Manual join since NeDB doesn't support Mongoose populate.

async function populatePlayers(ids = []) {
  if (!ids.length) return [];
  const players = await db.players.findAsync({ _id: { $in: ids } });
  const map = Object.fromEntries(players.map((p) => [p._id, p]));
  return ids.map((id) => map[id]).filter(Boolean);
}

async function populateCourts(ids = []) {
  if (!ids.length) return [];
  const courts = await db.courts.findAsync({ _id: { $in: ids } });
  const map = Object.fromEntries(courts.map((c) => [c._id, c]));
  return ids.map((id) => map[id]).filter(Boolean);
}

async function populateTournament(t) {
  if (!t) return null;
  const playerIds = t.players || [];
  const courtIds  = t.courts  || [];

  const [players, courts] = await Promise.all([
    populatePlayers(playerIds),
    populateCourts(courtIds),
  ]);

  const playerMap = Object.fromEntries(players.map((p) => [p._id, p]));

  // Populate couples
  const couples = (t.couples || []).map((c) => ({
    ...c,
    player1: c.player1 ? (playerMap[c.player1] || c.player1) : null,
    player2: c.player2 ? (playerMap[c.player2] || c.player2) : null,
  }));

  const coupleMap = Object.fromEntries(couples.map((c) => [c._id, c]));

  // Populate groups
  const groups = (t.groups || []).map((g) => ({
    ...g,
    matches: (g.matches || []).map((m) => ({
      ...m,
      couple1: m.couple1 ? (coupleMap[m.couple1] || m.couple1) : null,
      couple2: m.couple2 ? (coupleMap[m.couple2] || m.couple2) : null,
      winner: m.winner ? (coupleMap[m.winner] || m.winner) : null,
    })),
  }));

  // Populate knockout rounds
  const knockoutRounds = (t.knockoutRounds || []).map((r) => ({
    ...r,
    matches: (r.matches || []).map((m) => ({
      ...m,
      couple1: m.couple1 ? (coupleMap[m.couple1] || m.couple1) : null,
      couple2: m.couple2 ? (coupleMap[m.couple2] || m.couple2) : null,
      winner: m.winner ? (coupleMap[m.winner] || m.winner) : null,
    })),
  }));

  // Strip passwords from players
  const safePlayers = players.map(({ password: _pw, ...p }) => p);

  return {
    ...t,
    players: safePlayers,
    courts,
    couples,
    groups,
    knockoutRounds,
    format: t.format || "gironi",
  };
}

// ── INIT / SEED ──────────────────────────────────────────────────
// On first boot, seed an admin user and courts if DB is empty.
async function seed() {
  const adminExists = await db.players.findOneAsync({ role: "admin" });
  if (!adminExists) {
    const hashed = await bcrypt.hash("admin123", 10);
    await db.players.insertAsync({
      email: "admin@padel.local",
      password: hashed,
      name: "Admin",
      surname: "",
      level: "avanzato",
      hand: "destra",
      role: "admin",
      matchesPlayed: 0,
      winRate: 0,
      createdAt: new Date().toISOString(),
    });
    console.log("✅ Admin seeded: admin@padel.local / admin123");
  }

  // Sincronizza i 4 campi indoor da config.courts
  await db.courts.removeAsync({}, { multi: true });
  const courts = config.courts.map((c, i) => ({
    name: typeof c === "string" ? c : c.name,
    type: "indoor",
    order: typeof c === "object" ? c.order : i + 1,
    status: "available",
  }));
  await db.courts.insertAsync(courts);
  console.log(`✅ Courts synced: ${courts.map((c) => `${c.name} (${c.type})`).join(", ")}`);
}

// ── HEALTH ───────────────────────────────────────────────────────
app.get("/ping", (_req, res) => res.send("pong"));

// ── CONFIG ───────────────────────────────────────────────────────
app.get("/api/config", (_req, res) => {
  res.json({
    clubName:      config.clubName,
    clubShortName: config.clubShortName,
    clubEmail:     config.clubEmail,
    clubPhone:     config.clubPhone,
    clubAddress:   config.clubAddress,
    clubLogoUrl:   config.clubLogoUrl,
    currency:      config.currency,
    slotPrice:     config.slotPrice,
    slotDuration:  config.slotDuration,
    openHour:      config.openHour,
    closeHour:     config.closeHour,
  });
});

// ── INIT COURTS ──────────────────────────────────────────────────
app.get("/api/init", async (_req, res) => {
  try {
    await db.courts.removeAsync({}, { multi: true });
    const courts = config.courts.map((c, i) => ({
      name: typeof c === "string" ? c : c.name,
      type: typeof c === "object" ? c.type : "indoor",
      order: typeof c === "object" ? c.order : i + 1,
      status: "available",
    }));
    await db.courts.insertAsync(courts);
    res.json({ msg: "Campi reinizializzati", courts });
  } catch (err) {
    res.status(500).json({ msg: "Errore init", error: err.message });
  }
});

// ── AUTH ─────────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name, level, hand } = req.body;
    const existing = await db.players.findOneAsync({ email: email.trim().toLowerCase() });
    if (existing) return res.status(400).json({ msg: "Email già registrata" });
    const hashed = await bcrypt.hash(password, 10);
    const player = await db.players.insertAsync({
      email: email.trim().toLowerCase(),
      password: hashed,
      name,
      surname: "",
      level: level || "intermedio",
      hand: hand || "destra",
      role: "player",
      matchesPlayed: 0,
      winRate: 0,
      createdAt: new Date().toISOString(),
    });
    const token = jwt.sign({ id: player._id, role: player.role }, JWT_SECRET);
    res.json({ token, player: { id: player._id, email: player.email, name, level, role: player.role } });
  } catch (err) {
    res.status(500).json({ msg: "Errore registrazione", error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const player = await db.players.findOneAsync({ email: email.trim().toLowerCase() });
    if (!player || !(await bcrypt.compare(password, player.password)))
      return res.status(400).json({ msg: "Credenziali errate" });
    const token = jwt.sign({ id: player._id, role: player.role }, JWT_SECRET);
    res.json({ token, player: { id: player._id, email: player.email, name: player.name, level: player.level, role: player.role } });
  } catch (err) {
    res.status(500).json({ msg: "Errore login", error: err.message });
  }
});

// ── COURTS ───────────────────────────────────────────────────────
app.get("/api/courts", async (_req, res) => {
  const courts = await db.courts.findAsync({});
  courts.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(courts);
});

app.put("/api/admin/courts/:id", auth, adminOnly, async (req, res) => {
  await db.courts.updateAsync({ _id: req.params.id }, { $set: req.body });
  const court = await db.courts.findOneAsync({ _id: req.params.id });
  res.json(court);
});

// ── PLAYERS (ADMIN) ──────────────────────────────────────────────
app.get("/api/admin/players", auth, adminOnly, async (_req, res) => {
  try {
    const players = await db.players.findAsync({});
    const safe = players
      .map(({ password: _pw, ...p }) => p)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    res.json(safe);
  } catch (err) {
    res.status(500).json({ msg: "Errore", error: err.message });
  }
});

app.post("/api/admin/players", auth, adminOnly, async (req, res) => {
  try {
    const { name, surname, email, level, hand, password } = req.body;
    if (!name) return res.status(400).json({ msg: "Nome obbligatorio" });

    let finalEmail = email?.trim().toLowerCase();
    if (!finalEmail) {
      finalEmail = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@local`;
    } else {
      const existing = await db.players.findOneAsync({ email: finalEmail });
      if (existing) return res.status(400).json({ msg: "Email già registrata" });
    }

    const hashed = await bcrypt.hash(password || Math.random().toString(36).slice(-8), 10);
    const player = await db.players.insertAsync({
      name,
      surname: surname || "",
      email: finalEmail,
      password: hashed,
      level: level || "intermedio",
      hand: hand || "destra",
      role: "player",
      matchesPlayed: 0,
      winRate: 0,
      createdAt: new Date().toISOString(),
    });
    const { password: _pw, ...safe } = player;
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ msg: "Errore creazione giocatore", error: err.message });
  }
});

app.put("/api/admin/players/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, surname, email, level, hand } = req.body;
    await db.players.updateAsync({ _id: req.params.id }, { $set: { name, surname, email, level, hand } });
    const player = await db.players.findOneAsync({ _id: req.params.id });
    const { password: _pw, ...safe } = player;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ msg: "Errore aggiornamento giocatore", error: err.message });
  }
});

app.delete("/api/admin/players/:id", auth, adminOnly, async (req, res) => {
  try {
    await db.players.removeAsync({ _id: req.params.id });
    res.json({ msg: "Giocatore eliminato" });
  } catch (err) {
    res.status(500).json({ msg: "Errore eliminazione giocatore", error: err.message });
  }
});

// ── BULK IMPORT PLAYERS ──────────────────────────────────────────
// POST /api/admin/players/bulk
// Body: { players: [{name, surname, email?, level?, hand?}] }
app.post("/api/admin/players/bulk", auth, adminOnly, async (req, res) => {
  try {
    const { players: list } = req.body;
    if (!Array.isArray(list) || !list.length)
      return res.status(400).json({ msg: "Lista vuota" });

    const results = { created: 0, skipped: 0, errors: [] };
    for (const p of list) {
      if (!p.name?.trim()) { results.errors.push("Nome mancante"); continue; }
      try {
        const email = p.email?.trim().toLowerCase()
          || `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@local`;
        const existing = await db.players.findOneAsync({ email });
        if (existing) { results.skipped++; continue; }
        const hashed = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
        await db.players.insertAsync({
          name: p.name.trim(),
          surname: p.surname?.trim() || "",
          email,
          password: hashed,
          level: p.level || "intermedio",
          hand: p.hand || "destra",
          role: "player",
          matchesPlayed: 0,
          winRate: 0,
          createdAt: new Date().toISOString(),
        });
        results.created++;
      } catch (e) {
        results.errors.push(`${p.name}: ${e.message}`);
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ msg: "Errore import", error: err.message });
  }
});

// ── TOURNAMENTS ──────────────────────────────────────────────────

app.get("/api/tournaments", auth, async (_req, res) => {
  try {
    const tournaments = await db.tournaments.findAsync({});
    tournaments.sort((a, b) => new Date(b.date) - new Date(a.date));
    const populated = await Promise.all(tournaments.map(populateTournament));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ msg: "Errore", error: err.message });
  }
});

app.get("/api/tournaments/:id", auth, async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    res.json(await populateTournament(t));
  } catch (err) {
    res.status(500).json({ msg: "Errore", error: err.message });
  }
});

app.post("/api/tournaments", auth, adminOnly, async (req, res) => {
  try {
    const { name, date, startTime, endTime, level, status, courts, format } = req.body;
    const tournament = await db.tournaments.insertAsync({
      name: name || "Nuovo Torneo",
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      startTime: startTime || "09:00",
      endTime: endTime || "21:00",
      level: level || "open",
      status: status || "open",
      format: format || "gironi",
      courts: courts || [],
      players: [],
      couples: [],
      groups: [],
      knockoutRounds: [],
      matches: [],
      createdAt: new Date().toISOString(),
    });
    res.json(await populateTournament(tournament));
  } catch (err) {
    res.status(500).json({ msg: "Errore creazione torneo", error: err.message });
  }
});

app.put("/api/tournaments/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, date, startTime, endTime, level, status, courts, format } = req.body;
    await db.tournaments.updateAsync(
      { _id: req.params.id },
      {
        $set: {
          name,
          date: date ? new Date(date).toISOString() : undefined,
          startTime,
          endTime,
          level,
          status,
          courts,
          format: format || undefined,
        },
      }
    );
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(t));
  } catch (err) {
    res.status(500).json({ msg: "Errore aggiornamento torneo", error: err.message });
  }
});

app.delete("/api/tournaments/:id", auth, adminOnly, async (req, res) => {
  try {
    await db.tournaments.removeAsync({ _id: req.params.id });
    res.json({ msg: "Torneo eliminato" });
  } catch (err) {
    res.status(500).json({ msg: "Errore eliminazione torneo", error: err.message });
  }
});

// ── TOURNAMENT — PLAYERS ─────────────────────────────────────────

app.post("/api/tournaments/:id/players", auth, async (req, res) => {
  try {
    const { playerId } = req.body;
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    const pid = playerId || req.user.id;
    if (!t.players.includes(pid)) {
      await db.tournaments.updateAsync({ _id: t._id }, { $push: { players: pid } });
    }
    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    res.status(500).json({ msg: "Errore iscrizione", error: err.message });
  }
});

app.delete("/api/tournaments/:id/players/:playerId", auth, adminOnly, async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const players = (t.players || []).filter((p) => p && p !== req.params.playerId);
    const couples = (t.couples || []).filter((c) => {
      const p1 = typeof c.player1 === "object" ? c.player1?._id : c.player1;
      const p2 = typeof c.player2 === "object" ? c.player2?._id : c.player2;
      return p1 !== req.params.playerId && p2 !== req.params.playerId;
    });

    await db.tournaments.updateAsync({ _id: req.params.id }, { $set: { players, couples } });
    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    console.error("Error removing player:", err);
    res.status(500).json({ msg: "Errore rimozione giocatore", error: err.message });
  }
});

// ── TOURNAMENT — COUPLES ─────────────────────────────────────────

// Helper: trova un giocatore per ID o nome, oppure lo crea al volo
async function getOrCreatePlayer(nameOrId) {
  if (!nameOrId || typeof nameOrId !== "string" || !nameOrId.trim()) return null;
  const raw = nameOrId.trim();

  // 1. Cerca per ID esatto
  if (raw.match(/^[0-9a-zA-Z_-]{16,}$/)) {
    const byId = await db.players.findOneAsync({ _id: raw });
    if (byId) return byId;
  }

  // 2. Cerca per nome / cognome / email tra i giocatori esistenti
  const allPlayers = await db.players.findAsync({});
  const lower = raw.toLowerCase();
  const existing = allPlayers.find((p) => {
    const fullName = `${p.name || ""} ${p.surname || ""}`.trim().toLowerCase();
    const reverseName = `${p.surname || ""} ${p.name || ""}`.trim().toLowerCase();
    return (
      p.email?.toLowerCase() === lower ||
      fullName === lower ||
      reverseName === lower ||
      p.name?.toLowerCase() === lower
    );
  });
  if (existing) return existing;

  // 3. Creazione automatica istantanea senza bloccare l'utente!
  const parts = raw.split(/\s+/);
  const name = parts[0] || raw;
  const surname = parts.slice(1).join(" ") || "";
  const randomPass = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
  const email = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@local`;

  const newPlayer = await db.players.insertAsync({
    name,
    surname,
    email,
    password: randomPass,
    level: "intermedio",
    hand: "destra",
    role: "player",
    matchesPlayed: 0,
    winRate: 0,
    createdAt: new Date().toISOString(),
  });
  return newPlayer;
}

app.post("/api/tournaments/:id/couples", auth, async (req, res) => {
  try {
    const { player1Id, player2Id, player1Name, player2Name, player2Guest, name: customName } = req.body;
    const p1Input = player1Name || player1Id;
    const p2Input = player2Name || player2Id;

    if (!p1Input) return res.status(400).json({ msg: "Giocatore 1 mancante" });

    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const p1Doc = await getOrCreatePlayer(p1Input);
    if (!p1Doc) return res.status(400).json({ msg: "Giocatore 1 non valido" });

    const p1Name = [p1Doc.name, p1Doc.surname].filter(Boolean).join(" ") || p1Doc.name;

    let players = [...(t.players || [])];
    if (!players.includes(p1Doc._id)) players.push(p1Doc._id);

    const coupleId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (player2Guest) {
      const couple = {
        _id: coupleId,
        player1: p1Doc._id,
        player2: null,
        guestName: player2Guest,
        name: customName || `${p1Name} / ${player2Guest} (ospite)`,
        seeded: false,
      };
      const couples = [...(t.couples || []), couple];
      await db.tournaments.updateAsync({ _id: req.params.id }, { $set: { players, couples } });
      const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
      return res.json(await populateTournament(updated));
    }

    if (!p2Input) return res.status(400).json({ msg: "Giocatore 2 mancante" });

    const p2Doc = await getOrCreatePlayer(p2Input);
    if (!p2Doc) return res.status(400).json({ msg: "Giocatore 2 non valido" });

    if (p1Doc._id === p2Doc._id)
      return res.status(400).json({ msg: "I due giocatori devono essere diversi" });

    if (!players.includes(p2Doc._id)) players.push(p2Doc._id);

    const p2Name = [p2Doc.name, p2Doc.surname].filter(Boolean).join(" ") || p2Doc.name;
    const couple = {
      _id: coupleId,
      player1: p1Doc._id,
      player2: p2Doc._id,
      guestName: "",
      name: customName || `${p1Name} / ${p2Name}`,
      seeded: false,
    };
    const couples = [...(t.couples || []), couple];
    await db.tournaments.updateAsync({ _id: req.params.id }, { $set: { players, couples } });
    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    res.status(500).json({ msg: "Errore aggiunta coppia", error: err.message });
  }
});

// Inserimento batch veloce (incolla lista coppie tipo "Mario Rossi - Luca Bianchi")
app.post("/api/tournaments/:id/couples/batch", auth, adminOnly, async (req, res) => {
  try {
    const { text, lines } = req.body;
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const rawLines = Array.isArray(lines)
      ? lines
      : (typeof text === "string" ? text.split("\n") : []);

    let players = [...(t.players || [])];
    let couples = [...(t.couples || [])];
    let addedCount = 0;

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Separa con trattino, barra, virgola o punto e virgola
      const parts = line.split(/\s*[-/;,|]\s*|\s+\be\b\s+/i).map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      const [p1Raw, p2Raw] = parts;
      const p1Doc = await getOrCreatePlayer(p1Raw);
      const p2Doc = await getOrCreatePlayer(p2Raw);

      if (!p1Doc || !p2Doc || p1Doc._id === p2Doc._id) continue;

      if (!players.includes(p1Doc._id)) players.push(p1Doc._id);
      if (!players.includes(p2Doc._id)) players.push(p2Doc._id);

      const p1Name = [p1Doc.name, p1Doc.surname].filter(Boolean).join(" ") || p1Doc.name;
      const p2Name = [p2Doc.name, p2Doc.surname].filter(Boolean).join(" ") || p2Doc.name;

      couples.push({
        _id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        player1: p1Doc._id,
        player2: p2Doc._id,
        guestName: "",
        name: `${p1Name} / ${p2Name}`,
        seeded: false,
      });
      addedCount++;
    }

    await db.tournaments.updateAsync({ _id: req.params.id }, { $set: { players, couples } });
    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json({ addedCount, tournament: await populateTournament(updated) });
  } catch (err) {
    res.status(500).json({ msg: "Errore batch coppie", error: err.message });
  }
});

app.delete("/api/tournaments/:id/couples/:coupleId", auth, adminOnly, async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const couples = (t.couples || []).filter((c) => c._id !== req.params.coupleId);
    await db.tournaments.updateAsync({ _id: req.params.id }, { $set: { couples } });
    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    res.status(500).json({ msg: "Errore rimozione coppia", error: err.message });
  }
});

app.patch("/api/tournaments/:id/couples/:coupleId/seed", auth, adminOnly, async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const couples = (t.couples || []).map((c) =>
      c._id === req.params.coupleId ? { ...c, seeded: req.body.seeded } : c
    );
    await db.tournaments.updateAsync({ _id: req.params.id }, { $set: { couples } });
    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    res.status(500).json({ msg: "Errore", error: err.message });
  }
});

// ── TOURNAMENT — DRAW / BRACKET ──────────────────────────────────
// Supporta sia Gironi che Eliminazione Diretta (Knockout)

function getRoundName(totalRounds, r) {
  const fromEnd = totalRounds - 1 - r;
  if (fromEnd === 0) return "Finale 🏆";
  if (fromEnd === 1) return "Semifinali";
  if (fromEnd === 2) return "Quarti di Finale";
  if (fromEnd === 3) return "Ottavi di Finale";
  if (fromEnd === 4) return "Sedicesimi di Finale";
  return `Turno ${r + 1}`;
}

function generateKnockoutBracket(couples) {
  const n = couples.length;
  if (n < 2) return [];

  let bracketSize = 2;
  while (bracketSize < n) {
    bracketSize *= 2;
  }

  const seeded = couples.filter((c) => c.seeded);
  const unseeded = shuffle(couples.filter((c) => !c.seeded));
  const ordered = [...seeded, ...unseeded];

  const slots = new Array(bracketSize).fill(null);
  for (let i = 0; i < ordered.length; i++) {
    slots[i] = ordered[i]._id;
  }

  const totalRounds = Math.log2(bracketSize);
  const rounds = [];

  let currentRoundMatchesCount = bracketSize / 2;
  for (let r = 0; r < totalRounds; r++) {
    const roundName = getRoundName(totalRounds, r);
    const matches = [];

    for (let m = 0; m < currentRoundMatchesCount; m++) {
      let couple1 = null;
      let couple2 = null;
      let winner = null;

      if (r === 0) {
        couple1 = slots[m * 2] || null;
        couple2 = slots[m * 2 + 1] || null;

        if (couple1 && !couple2) {
          winner = couple1;
        } else if (!couple1 && couple2) {
          winner = couple2;
        }
      }

      matches.push({
        _id: `m_ko_${r}_${m}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        roundIndex: r,
        matchIndex: m,
        couple1,
        couple2,
        score: "",
        winner,
      });
    }

    rounds.push({
      roundIndex: r,
      name: roundName,
      matches,
    });

    currentRoundMatchesCount /= 2;
  }

  // Avanza automaticamente le coppie che hanno avuto BYE nel primo turno
  if (rounds.length > 1) {
    rounds[0].matches.forEach((m, mIdx) => {
      if (m.winner) {
        const nextMatchIdx = Math.floor(mIdx / 2);
        const slot = mIdx % 2 === 0 ? "couple1" : "couple2";
        if (rounds[1].matches[nextMatchIdx]) {
          rounds[1].matches[nextMatchIdx][slot] = m.winner;
        }
      }
    });
  }

  return rounds;
}

app.post("/api/tournaments/:id/draw", auth, adminOnly, async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const couples = t.couples || [];
    const format = req.body.format || t.format || "gironi";

    if (format === "knockout") {
      if (couples.length < 2)
        return res.status(400).json({ msg: "Servono almeno 2 coppie per l'eliminazione diretta" });

      const knockoutRounds = generateKnockoutBracket(couples);
      await db.tournaments.updateAsync(
        { _id: req.params.id },
        {
          $set: {
            format: "knockout",
            knockoutRounds,
            groups: [],
            status: "running",
            matches: [],
          },
        }
      );
    } else {
      // Formato Gironi
      if (couples.length < 3)
        return res.status(400).json({ msg: "Servono almeno 3 coppie per i gironi" });

      // Sort: seeded first, then shuffle the rest
      const seeded = couples.filter((c) => c.seeded);
      const unseeded = shuffle(couples.filter((c) => !c.seeded));
      const ordered = [...seeded, ...unseeded];

      // Determine group count: aim for groups of 3-4 couples
      const n = ordered.length;
      let groupCount = Math.max(2, Math.floor(n / 4));
      if (n <= 4) groupCount = 1;
      if (n === 5 || n === 6) groupCount = 2;

      // Distribute couples into groups (snake draft)
      const groups = Array.from({ length: groupCount }, (_, i) => ({
        _id: `g_${i + 1}`,
        name: `Girone ${String.fromCharCode(65 + i)}`,
        couples: [],
        matches: [],
      }));

      ordered.forEach((c, idx) => {
        const g = idx % groupCount;
        groups[g].couples.push(c._id);
      });

      // Generate round-robin matches for each group
      for (const g of groups) {
        const gc = g.couples;
        g.matches = [];
        for (let i = 0; i < gc.length; i++) {
          for (let j = i + 1; j < gc.length; j++) {
            g.matches.push({
              _id: `m_${g._id}_${i}_${j}_${Date.now()}`,
              couple1: gc[i],
              couple2: gc[j],
              score: "",
              winner: null,
            });
          }
        }
      }

      await db.tournaments.updateAsync(
        { _id: req.params.id },
        {
          $set: {
            format: "gironi",
            groups,
            knockoutRounds: [],
            status: "running",
            matches: [],
          },
        }
      );
    }

    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    res.status(500).json({ msg: "Errore generazione tabellone", error: err.message });
  }
});

// ── TOURNAMENT — MATCH RESULT ────────────────────────────────────
app.put("/api/tournaments/:id/matches/:matchId", auth, adminOnly, async (req, res) => {
  try {
    const { score, winner } = req.body;
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    // 1. Update match inside groups
    const groups = (t.groups || []).map((g) => ({
      ...g,
      matches: (g.matches || []).map((m) =>
        m._id === req.params.matchId ? { ...m, score, winner } : m
      ),
    }));

    // 2. Update match inside knockoutRounds + avanza vincitore al turno successivo
    let knockoutRounds = t.knockoutRounds || [];
    knockoutRounds = knockoutRounds.map((r, rIdx) => {
      const matches = (r.matches || []).map((m, mIdx) => {
        if (m._id === req.params.matchId) {
          const updated = { ...m, score, winner };
          // Se c'è un vincitore e c'è un turno successivo, avanza la coppia vincente!
          if (winner && rIdx + 1 < knockoutRounds.length) {
            const nextRound = knockoutRounds[rIdx + 1];
            const nextMatchIdx = Math.floor(mIdx / 2);
            const slot = mIdx % 2 === 0 ? "couple1" : "couple2";
            if (nextRound && nextRound.matches && nextRound.matches[nextMatchIdx]) {
              nextRound.matches[nextMatchIdx][slot] = winner;
            }
          }
          return updated;
        }
        return m;
      });
      return { ...r, matches };
    });

    // 3. Top-level matches
    const matches = (t.matches || []).map((m) =>
      m._id === req.params.matchId ? { ...m, score, winner } : m
    );

    await db.tournaments.updateAsync(
      { _id: req.params.id },
      { $set: { groups, knockoutRounds, matches } }
    );

    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    res.status(500).json({ msg: "Errore salvataggio risultato", error: err.message });
  }
});

// ── EXPORT TOURNAMENT (CSV) ───────────────────────────────────────
app.get("/api/tournaments/:id/export", auth, adminOnly, async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const populated = await populateTournament(t);

    let csv = "Coppia,Giocatore 1,Giocatore 2,Seeded\n";
    for (const c of populated.couples || []) {
      const p1 = typeof c.player1 === "object"
        ? `${c.player1.name || ""} ${c.player1.surname || ""}`.trim()
        : c.player1 || "";
      const p2 = c.player2
        ? typeof c.player2 === "object"
          ? `${c.player2.name || ""} ${c.player2.surname || ""}`.trim()
          : c.player2
        : c.guestName || "(ospite)";
      csv += `"${c.name || ""}","${p1}","${p2}","${c.seeded ? "Sì" : "No"}"\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="torneo_${t._id}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ msg: "Errore export", error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  BOOKING CODE — COMMENTED OUT (not used in tournament edition)
// ════════════════════════════════════════════════════════════════
/*
  All booking-related routes have been removed from this edition.
  The following features are commented out:
  - GET/POST /api/bookings
  - PATCH /api/bookings/:id/cancel
  - DELETE /api/bookings/:id
  - GET/DELETE /api/admin/bookings
  - GET/POST/DELETE /api/blocked-slots
  - GET /api/availability
  - GET /api/slots/:courtId
  - GET /api/calendar
  - GET /api/dashboard
  - GET /api/admin/stats
  - GET /api/admin/report
  - Email notifications (nodemailer)

  To restore booking functionality, re-add the mongoose-based routes
  and switch back to the MongoDB version of server.js.
*/

// ── SPONSORS ──────────────────────────────────────────────────────
// (kept minimal for potential future use)
/*
app.get("/api/sponsors", async (_req, res) => { ... });
app.post("/api/sponsors", auth, adminOnly, async (req, res) => { ... });
*/

// ── UTILITY ──────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── STATIC FRONTEND (production / pen-drive mode) ─────────────────
// If frontend/dist exists alongside the backend, serve it statically.
// This lets you run just `node server.js` from the backend folder
// and access the full app at http://localhost:4000
const path = require("path");
const fs   = require("fs");
const frontendDist = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — serve index.html for all non-API routes
  app.get(/^(?!\/api|\/ping).*$/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  console.log(`🌐 Serving frontend from: ${frontendDist}`);
}

// ── START ─────────────────────────────────────────────────────────
seed()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Padel Tournament Manager running on http://localhost:${PORT}`);
      console.log(`📁 Data stored in: ${path.join(__dirname, "data")}`);
      console.log(`🔑 Default login: admin@padel.local / admin123`);
    });
  })
  .catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
