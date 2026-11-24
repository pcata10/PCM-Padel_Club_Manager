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

  // Populate knockoutGold & knockoutSilver for gironi_knockout format
  const knockoutGold = (t.knockoutGold || []).map((r) => ({
    ...r,
    matches: (r.matches || []).map((m) => ({
      ...m,
      couple1: m.couple1 ? (coupleMap[m.couple1] || m.couple1) : null,
      couple2: m.couple2 ? (coupleMap[m.couple2] || m.couple2) : null,
      winner: m.winner ? (coupleMap[m.winner] || m.winner) : null,
    })),
  }));

  const knockoutSilver = (t.knockoutSilver || []).map((r) => ({
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
    knockoutGold,
    knockoutSilver,
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

    // Verifica se è richiesto il cambio password al primo login (flag o password di default ancora attiva)
    const isDefaultAdmin = player.role === "admin" && (await bcrypt.compare("admin123", player.password));
    const mustChangePassword = Boolean(player.mustChangePassword || isDefaultAdmin);

    const token = jwt.sign({ id: player._id, role: player.role }, JWT_SECRET);
    res.json({
      token,
      mustChangePassword,
      player: {
        id: player._id,
        email: player.email,
        name: player.name,
        level: player.level,
        role: player.role,
        mustChangePassword,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: "Errore login", error: err.message });
  }
});

app.post("/api/change-password", auth, async (req, res) => {
  try {
    const { newPassword, currentPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ msg: "La nuova password deve contenere almeno 6 caratteri" });
    }

    if (newPassword.trim() === "admin123") {
      return res.status(400).json({ msg: "Scegli una password diversa da quella predefinita (admin123)" });
    }

    const player = await db.players.findOneAsync({ _id: req.user.id });
    if (!player) return res.status(404).json({ msg: "Utente non trovato" });

    // Se fornita la password attuale, verificala (facoltativa per il primo cambio forzato)
    if (currentPassword && !(await bcrypt.compare(currentPassword, player.password))) {
      return res.status(400).json({ msg: "Password attuale non corretta" });
    }

    const hashed = await bcrypt.hash(newPassword.trim(), 10);
    await db.players.updateAsync(
      { _id: player._id },
      {
        $set: {
          password: hashed,
          mustChangePassword: false,
          passwordChangedAt: new Date().toISOString(),
        },
      }
    );

    res.json({
      success: true,
      msg: "Password aggiornata con successo!",
      player: {
        id: player._id,
        email: player.email,
        name: player.name,
        role: player.role,
        mustChangePassword: false,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: "Errore cambio password", error: err.message });
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

// Public read-only endpoints (no auth required, spectator/clubhouse TV)
app.get("/api/public/tournaments", async (_req, res) => {
  try {
    const tournaments = await db.tournaments.findAsync({});
    tournaments.sort((a, b) => new Date(b.date) - new Date(a.date));
    const populated = await Promise.all(tournaments.map(populateTournament));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ msg: "Errore caricamento tornei pubblici", error: err.message });
  }
});

app.get("/api/public/tournaments/:id", async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });
    res.json(await populateTournament(t));
  } catch (err) {
    res.status(500).json({ msg: "Errore caricamento torneo", error: err.message });
  }
});

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

function getMatchSeedOrder(numMatches) {
  let order = [0];
  while (order.length < numMatches) {
    const nextOrder = [];
    const currentLen = order.length * 2;
    for (let i = 0; i < order.length; i++) {
      nextOrder.push(order[i]);
      nextOrder.push(currentLen - 1 - order[i]);
    }
    order = nextOrder;
  }
  return order;
}

function generateKnockoutBracket(couples, preserveOrder = false) {
  const n = couples.length;
  if (n < 2) return [];

  let bracketSize = 2;
  while (bracketSize < n) {
    bracketSize *= 2;
  }

  let ordered;
  if (preserveOrder) {
    ordered = [...couples];
  } else {
    const seeded = couples.filter((c) => c.seeded);
    const unseeded = shuffle(couples.filter((c) => !c.seeded));
    ordered = [...seeded, ...unseeded];
  }

  const numMatches = bracketSize / 2;
  const numByes = bracketSize - n;
  const seedOrder = getMatchSeedOrder(numMatches);
  const byeMatches = new Set(seedOrder.slice(0, numByes));

  const slots = new Array(bracketSize).fill(null);
  let teamIdx = 0;

  for (let m = 0; m < numMatches; m++) {
    if (byeMatches.has(m)) {
      slots[m * 2] = ordered[teamIdx++]?._id || null;
      slots[m * 2 + 1] = null; // BYE
    } else {
      slots[m * 2] = ordered[teamIdx++]?._id || null;
      slots[m * 2 + 1] = ordered[teamIdx++]?._id || null;
    }
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
      let score = "";

      if (r === 0) {
        couple1 = slots[m * 2] || null;
        couple2 = slots[m * 2 + 1] || null;

        if (couple1 && !couple2) {
          winner = couple1;
          score = "BYE";
        } else if (!couple1 && couple2) {
          winner = couple2;
          score = "BYE";
        }
      }

      matches.push({
        _id: `m_ko_${r}_${m}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        roundIndex: r,
        matchIndex: m,
        couple1,
        couple2,
        score,
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
      // ── ELIMINAZIONE DIRETTA PURA ──
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
    } else if (format === "gironi_knockout") {
      // ── GIRONI + ELIMINAZIONE DIRETTA (Gold & Silver) ──
      if (couples.length < 4)
        return res.status(400).json({ msg: "Servono almeno 4 coppie per gironi + eliminazione diretta" });

      // Sort: seeded first, then shuffle the rest
      const seeded = couples.filter((c) => c.seeded);
      const unseeded = shuffle(couples.filter((c) => !c.seeded));
      const ordered = [...seeded, ...unseeded];

      // Determine group count: aim for groups of 3-4 couples
      const n = ordered.length;
      let groupCount = Math.max(2, Math.floor(n / 4));
      if (n <= 4) groupCount = 2;
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
            format: "gironi_knockout",
            groups,
            knockoutGold: [],
            knockoutSilver: [],
            knockoutRounds: [],
            status: "running",
            matches: [],
          },
        }
      );
    } else {
      // ── GIRONI PURI (solo fase a gironi, senza eliminazione diretta) ──
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
            knockoutGold: [],
            knockoutSilver: [],
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

// ── TOURNAMENT — GENERATE KNOCKOUT FROM GROUPS (Gold & Silver) ──
// Generates Gold & Silver brackets based on group rankings with cross-pairing
app.post("/api/tournaments/:id/generate-knockout", auth, adminOnly, async (req, res) => {
  try {
    const t = await db.tournaments.findOneAsync({ _id: req.params.id });
    if (!t) return res.status(404).json({ msg: "Torneo non trovato" });

    const groups = t.groups || [];
    if (!groups.length) {
      return res.status(400).json({ msg: "Nessun girone presente. Genera prima la fase a gironi." });
    }
    const allCouples = t.couples || [];

    // Calcola la classifica per ogni girone (Vittorie desc, Sconfitte asc)
    const groupRankings = groups.map((g) => {
      const stats = {};
      (g.couples || []).forEach((cId) => {
        const id = typeof cId === "object" ? cId._id?.toString() : cId?.toString();
        if (id) stats[id] = { id, wins: 0, losses: 0, played: 0 };
      });

      (g.matches || []).filter((m) => m && m.winner).forEach((m) => {
        const w = typeof m.winner === "object" ? m.winner._id?.toString() : m.winner?.toString();
        const c1 = typeof m.couple1 === "object" ? m.couple1._id?.toString() : m.couple1?.toString();
        const c2 = typeof m.couple2 === "object" ? m.couple2._id?.toString() : m.couple2?.toString();
        const l = c1 === w ? c2 : c1;
        if (stats[w]) { stats[w].wins++; stats[w].played++; }
        if (stats[l]) { stats[l].losses++; stats[l].played++; }
      });

      const ranked = Object.values(stats).sort((a, b) => (b.wins - a.wins) || (a.losses - b.losses));
      return ranked.map((r) => r.id);
    });

    // Incroci Gold (1° e 2° di ogni girone) e Silver (3° e successivi)
    let goldCoupleIds = [];
    let silverCoupleIds = [];

    if (groupRankings.length === 2) {
      const gA = groupRankings[0];
      const gB = groupRankings[1];
      // Gold: Semifinale 1 (1°A vs 2°B), Semifinale 2 (1°B vs 2°A)
      if (gA[0]) goldCoupleIds.push(gA[0]);
      if (gB[1]) goldCoupleIds.push(gB[1]);
      if (gB[0]) goldCoupleIds.push(gB[0]);
      if (gA[1]) goldCoupleIds.push(gA[1]);

      // Silver: incroci per 3°, 4°, 5°...
      const maxLen = Math.max(gA.length, gB.length);
      for (let i = 2; i < maxLen; i += 2) {
        if (gA[i]) silverCoupleIds.push(gA[i]);
        if (gB[i + 1]) silverCoupleIds.push(gB[i + 1]);
        if (gB[i]) silverCoupleIds.push(gB[i]);
        if (gA[i + 1]) silverCoupleIds.push(gA[i + 1]);
      }
      gA.slice(2).concat(gB.slice(2)).forEach((id) => {
        if (!silverCoupleIds.includes(id)) silverCoupleIds.push(id);
      });
    } else {
      // Più di 2 gironi: 1° e 2° vanno al Gold con incrocio ciclico
      const firsts = [];
      const seconds = [];
      groupRankings.forEach((ranked) => {
        if (ranked[0]) firsts.push(ranked[0]);
        if (ranked[1]) seconds.push(ranked[1]);
        ranked.slice(2).forEach((id) => silverCoupleIds.push(id));
      });
      const nG = firsts.length;
      for (let i = 0; i < nG; i++) {
        goldCoupleIds.push(firsts[i]);
        if (seconds[(i + 1) % nG]) goldCoupleIds.push(seconds[(i + 1) % nG]);
      }
    }

    const findCouple = (id) => allCouples.find((c) => (c._id?.toString() || c._id) === id?.toString());
    const goldCouplesData = goldCoupleIds.map(findCouple).filter(Boolean);
    const silverCouplesData = silverCoupleIds.map(findCouple).filter(Boolean);

    const knockoutGold = goldCouplesData.length >= 2 ? generateKnockoutBracket(goldCouplesData, true) : [];
    const knockoutSilver = silverCouplesData.length >= 2 ? generateKnockoutBracket(silverCouplesData, true) : [];

    await db.tournaments.updateAsync(
      { _id: req.params.id },
      {
        $set: {
          format: "gironi_knockout",
          knockoutGold,
          knockoutSilver,
        },
      }
    );

    const updated = await db.tournaments.findOneAsync({ _id: req.params.id });
    res.json(await populateTournament(updated));
  } catch (err) {
    res.status(500).json({ msg: "Errore generazione fase eliminazione diretta", error: err.message });
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

    // 2b. Update match inside knockoutGold (gironi_knockout format)
    let knockoutGold = t.knockoutGold || [];
    knockoutGold = knockoutGold.map((r, rIdx) => {
      const matches = (r.matches || []).map((m, mIdx) => {
        if (m._id === req.params.matchId) {
          const updated = { ...m, score, winner };
          if (winner && rIdx + 1 < knockoutGold.length) {
            const nextRound = knockoutGold[rIdx + 1];
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

    // 2c. Update match inside knockoutSilver (gironi_knockout format)
    let knockoutSilver = t.knockoutSilver || [];
    knockoutSilver = knockoutSilver.map((r, rIdx) => {
      const matches = (r.matches || []).map((m, mIdx) => {
        if (m._id === req.params.matchId) {
          const updated = { ...m, score, winner };
          if (winner && rIdx + 1 < knockoutSilver.length) {
            const nextRound = knockoutSilver[rIdx + 1];
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
      { $set: { groups, knockoutRounds, knockoutGold, knockoutSilver, matches } }
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
