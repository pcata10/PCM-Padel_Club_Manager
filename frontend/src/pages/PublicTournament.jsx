import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useConfig } from "../hooks/useConfig";

const STATUS_CFG = {
  draft: { label: "Bozza", badge: "bg-gray-100 text-gray-600" },
  open: { label: "Iscrizioni Aperte", badge: "bg-blue-100 text-blue-700" },
  ongoing: { label: "In Corso 🔴", badge: "bg-emerald-100 text-emerald-800 font-bold" },
  finished: { label: "Concluso 🏆", badge: "bg-purple-100 text-purple-700 font-bold" },
};

const LEVEL_CFG = {
  principiante: { label: "Principiante", badge: "bg-emerald-100 text-emerald-700" },
  intermedio: { label: "Intermedio", badge: "bg-blue-100 text-blue-700" },
  avanzato: { label: "Avanzato", badge: "bg-purple-100 text-purple-700" },
  tutti: { label: "Open (Tutti i livelli)", badge: "bg-amber-100 text-amber-700" },
};

function coupleFullName(c) {
  if (!c) return "—";
  if (c.p1 && c.p2) {
    const n1 = [c.p1.name, c.p1.surname].filter(Boolean).join(" ");
    const n2 = [c.p2.name, c.p2.surname].filter(Boolean).join(" ");
    return `${n1} / ${n2}`;
  }
  return c.name || "Coppia";
}

function coupleShortName(c) {
  if (!c) return "—";
  if (c.p1 && c.p2) {
    const getSurname = (p) => {
      if (p.surname && p.surname.trim()) return p.surname.trim();
      if (p.name) {
        const parts = p.name.trim().split(/\s+/);
        return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
      }
      return "";
    };
    const s1 = getSurname(c.p1);
    const s2 = getSurname(c.p2);
    if (s1 && s2) return `${s1} / ${s2}`;
    if (s1 || s2) return s1 || s2;
  }
  return c.name || "Coppia";
}

// ── Read-only Knockout Bracket Component ───────────────────────
function PublicBracketView({ rounds, couples }) {
  if (!rounds || !rounds.length) {
    return (
      <div className="py-16 text-center text-slate-500 font-medium">
        Tabellone non ancora generato o in fase di sorteggio.
      </div>
    );
  }

  const resolveCouple = (cRef) => {
    if (!cRef) return null;
    if (typeof cRef === "object" && cRef._id) return cRef;
    return couples?.find((c) => c._id?.toString() === cRef.toString()) || null;
  };

  return (
    <div className="overflow-x-auto pb-6 pt-2">
      <div className="flex gap-6 min-w-max items-stretch py-2 px-1">
        {rounds.map((round, rIdx) => (
          <div key={round.name || rIdx} className="w-72 flex flex-col gap-3">
            {/* Header del Turno */}
            <div className="bg-slate-900 border border-slate-800 text-yellow-400 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-2xl text-center shadow-md flex items-center justify-between">
              <span>{round.name}</span>
              <span className="text-[10px] bg-slate-800 text-yellow-300 font-bold px-2 py-0.5 rounded-full lowercase">
                {round.matches.length} {round.matches.length === 1 ? "partita" : "partite"}
              </span>
            </div>

            {/* Partite del Turno */}
            <div className="flex flex-col gap-3 flex-1 justify-around">
              {round.matches.map((m, mIdx) => {
                const c1 = resolveCouple(m.couple1);
                const c2 = resolveCouple(m.couple2);
                const winnerId = typeof m.winner === "object" ? m.winner?._id : m.winner;
                const isBye = m.score === "BYE" || (!c2 && c1 && !!winnerId) || (!c1 && c2 && !!winnerId);
                const isFinished = !!winnerId;

                return (
                  <div
                    key={m._id || mIdx}
                    className={`rounded-2xl border transition-all overflow-hidden shadow-sm ${
                      isBye
                        ? "border-purple-200 bg-purple-50/30"
                        : isFinished
                        ? "border-emerald-300 bg-white"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    {/* Header Partita */}
                    <div className="bg-slate-50 border-b border-slate-100 px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>Gara #{mIdx + 1}</span>
                      {isBye ? (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          BYE 🚀
                        </span>
                      ) : m.score ? (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-extrabold text-[11px] border border-amber-200">
                          {m.score}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Da disputare</span>
                      )}
                    </div>

                    {/* Squadra 1 */}
                    <div
                      title={coupleFullName(c1)}
                      className={`px-3 py-2.5 text-xs font-bold flex items-center justify-between border-b border-slate-100 ${
                        winnerId && (winnerId === c1?._id || winnerId?.toString() === c1?._id?.toString())
                          ? "bg-emerald-50 text-emerald-800 font-extrabold"
                          : winnerId && !isBye
                          ? "bg-slate-50/60 text-slate-400"
                          : "text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-2">
                        {c1?.seeded && <span className="text-amber-500 text-[11px] shrink-0">⭐</span>}
                        <span className="truncate">
                          {c1 ? coupleShortName(c1) : isBye ? "(BYE — Passa il turno)" : "(In attesa)"}
                        </span>
                      </div>
                      {winnerId && (winnerId === c1?._id || winnerId?.toString() === c1?._id?.toString()) && (
                        <span className="text-emerald-600 font-extrabold text-xs shrink-0">✓ Vince</span>
                      )}
                    </div>

                    {/* Squadra 2 */}
                    <div
                      title={coupleFullName(c2)}
                      className={`px-3 py-2.5 text-xs font-bold flex items-center justify-between ${
                        winnerId && (winnerId === c2?._id || winnerId?.toString() === c2?._id?.toString())
                          ? "bg-emerald-50 text-emerald-800 font-extrabold"
                          : winnerId && !isBye
                          ? "bg-slate-50/60 text-slate-400"
                          : "text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-2">
                        {c2?.seeded && <span className="text-amber-500 text-[11px] shrink-0">⭐</span>}
                        <span className="truncate">
                          {c2 ? coupleShortName(c2) : isBye ? "(BYE — Passa il turno)" : "(In attesa)"}
                        </span>
                      </div>
                      {winnerId && (winnerId === c2?._id || winnerId?.toString() === c2?._id?.toString()) && (
                        <span className="text-emerald-600 font-extrabold text-xs shrink-0">✓ Vince</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Read-only Gironi View Component ─────────────────────────────
function PublicGironiView({ groups, couples, allMatches }) {
  if (!groups || !groups.length) {
    return (
      <div className="py-16 text-center text-slate-500 font-medium">
        Gironi non ancora configurati o in fase di sorteggio.
      </div>
    );
  }

  const computeRanking = (group) => {
    const stats = {};
    (group.couples || []).forEach((cItem) => {
      const id = typeof cItem === "object" ? cItem._id?.toString() : cItem?.toString();
      if (!id) return;
      stats[id] = { id, wins: 0, losses: 0, played: 0 };
    });

    const gMatches = [
      ...(group.matches || []),
      ...(allMatches || []).filter(
        (m) => m.phase === "group" && (m.group === group._id || m.group === group.name || m.group === group.number)
      ),
    ];

    gMatches
      .filter((m) => m.winner)
      .forEach((m) => {
        const w = typeof m.winner === "object" ? m.winner._id?.toString() : m.winner?.toString();
        const c1 = typeof m.couple1 === "object" ? m.couple1._id?.toString() : m.couple1?.toString();
        const c2 = typeof m.couple2 === "object" ? m.couple2._id?.toString() : m.couple2?.toString();
        const l = c1 === w ? c2 : c1;
        if (stats[w]) {
          stats[w].wins++;
          stats[w].played++;
        }
        if (stats[l]) {
          stats[l].losses++;
          stats[l].played++;
        }
      });

    return Object.values(stats)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      .map((s) => ({
        ...s,
        couple: couples?.find((c) => c._id?.toString() === s.id),
      }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {groups.map((group) => {
        const ranking = computeRanking(group);
        const gMatches = group.matches || [];
        const completed = gMatches.filter((m) => m.winner).length;

        return (
          <div
            key={group._id || group.name}
            className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden flex flex-col"
          >
            {/* Titolo Girone */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-extrabold text-base tracking-wide flex items-center gap-2">
                🏆 {group.name}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-yellow-300 border border-slate-700">
                {completed}/{gMatches.length} completate
              </span>
            </div>

            {/* Classifica */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                Classifica Girone
              </div>
              <div className="space-y-1.5">
                {ranking.map((s, idx) => (
                  <div
                    key={s.id}
                    title={coupleFullName(s.couple)}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? "bg-amber-400 text-slate-900 shadow-sm"
                            : idx === 1
                            ? "bg-slate-300 text-slate-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      {s.couple?.seeded && <span className="text-amber-500 text-xs">⭐</span>}
                      <span className="font-bold text-slate-800 truncate text-xs md:text-sm">
                        {coupleShortName(s.couple)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-700 font-extrabold text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        {s.wins} V
                      </span>
                      <span className="text-slate-500 font-semibold text-xs bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {s.losses} S
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lista Incontri */}
            <div className="p-4 flex-1 flex flex-col">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                Incontri in programma
              </div>
              <div className="space-y-2 flex-1">
                {gMatches.map((m, mIdx) => {
                  const c1 = couples?.find(
                    (c) => c._id?.toString() === (typeof m.couple1 === "object" ? m.couple1?._id?.toString() : m.couple1?.toString())
                  );
                  const c2 = couples?.find(
                    (c) => c._id?.toString() === (typeof m.couple2 === "object" ? m.couple2?._id?.toString() : m.couple2?.toString())
                  );
                  const winnerId = typeof m.winner === "object" ? m.winner?._id?.toString() : m.winner?.toString();

                  return (
                    <div
                      key={m._id || mIdx}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs md:text-sm border transition-all ${
                        winnerId
                          ? "bg-emerald-50/50 border-emerald-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <span
                        title={coupleFullName(c1)}
                        className={`flex-1 min-w-0 font-bold truncate ${
                          winnerId === c1?._id?.toString() ? "text-emerald-700 font-black" : "text-slate-700"
                        }`}
                      >
                        {coupleShortName(c1)}
                      </span>
                      <span
                        className={`mx-2 px-2 py-0.5 rounded-full font-extrabold text-[11px] shrink-0 ${
                          m.score
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-xs"
                            : "bg-white text-slate-400 border border-slate-200"
                        }`}
                      >
                        {m.score || "vs"}
                      </span>
                      <span
                        title={coupleFullName(c2)}
                        className={`flex-1 min-w-0 font-bold truncate text-right ${
                          winnerId === c2?._id?.toString() ? "text-emerald-700 font-black" : "text-slate-700"
                        }`}
                      >
                        {coupleShortName(c2)}
                      </span>
                      <span className="ml-2 shrink-0">
                        {winnerId ? "✅" : "⏳"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Public Tournament Component ────────────────────────────
export default function PublicTournament() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const tournamentId = paramId || searchParams.get("id");
  const config = useConfig();

  const [tournaments, setTournaments] = useState([]);
  const [selectedT, setSelectedT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState("auto"); // auto, gold, silver, gironi, couples
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(15);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const countdownRef = useRef(15);

  // Carica elenco o singolo torneo pubblico
  const fetchTournaments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get("/api/public/tournaments");
      const list = res.data || [];
      setTournaments(list);

      // Seleziona torneo in base a query param o il primo disponibile
      let current = null;
      if (tournamentId) {
        current = list.find((t) => t._id?.toString() === tournamentId.toString());
      }
      if (!current && list.length > 0) {
        current = list[0];
      }
      setSelectedT(current);
    } catch (err) {
      console.error("Errore recupero tornei pubblici:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [tournamentId]);

  // Polling automatico ogni 15 secondi se abilitato
  useEffect(() => {
    if (!autoRefresh) return;

    countdownRef.current = 15;
    setCountdown(15);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchTournaments(true);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, tournamentId]);

  // Toggle Schermo Intero
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const token = localStorage.getItem("token");

  if (loading && !selectedT) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-lg text-slate-300">Caricamento tabellone live...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-yellow-400 selection:text-slate-950">
      {/* ── Top Bar / Live Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo e Titolo App */}
          <div className="flex items-center gap-3">
            <Link
              to="/live"
              className="font-black text-lg md:text-xl text-yellow-400 flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span>🎾</span>
              <span>{config.clubName || "Padel Live"}</span>
            </Link>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>LIVE</span>
            </div>
          </div>

          {/* Selettore Torneo se più di uno */}
          {tournaments.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="tournamentSelect" className="text-xs text-slate-400 hidden sm:inline">
                Torneo:
              </label>
              <select
                id="tournamentSelect"
                value={selectedT?._id || ""}
                onChange={(e) => {
                  const found = tournaments.find((t) => t._id === e.target.value);
                  if (found) setSelectedT(found);
                }}
                className="bg-slate-800 border border-slate-700 text-white text-xs md:text-sm rounded-xl px-3 py-1.5 font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
              >
                {tournaments.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controlli Live (Aggiornamento + Schermo Intero + Nav) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? "Pausa aggiornamento automatico" : "Attiva aggiornamento automatico"}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition-all ${
                autoRefresh
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900"
              }`}
            >
              <span>{autoRefresh ? "🔄" : "⏸"}</span>
              <span className="hidden sm:inline">
                {autoRefresh ? `Auto (${countdown}s)` : "Pausa"}
              </span>
            </button>

            <button
              onClick={() => fetchTournaments(true)}
              className="text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold transition-all"
              title="Aggiorna dati ora"
            >
              ↻
            </button>

            <button
              onClick={toggleFullscreen}
              className="text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold transition-all"
              title="Schermo Intero (TV)"
            >
              ⛶
            </button>

            {token ? (
              <Link
                to="/admin/tournaments"
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-3 py-1.5 rounded-xl shadow-md transition-all ml-1"
              >
                ⚙️ Admin
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl transition-all ml-1"
              >
                Accedi
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {!selectedT ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
            <span className="text-4xl">🏆</span>
            <h2 className="text-xl font-bold text-slate-200 mt-4">Nessun torneo in corso o programmato</h2>
            <p className="text-sm text-slate-400 mt-1">Non appena un torneo sarà creato, comparirà automaticamente qui.</p>
          </div>
        ) : (
          <>
            {/* Banner Torneo */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-3xl p-5 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-yellow-500/10 to-transparent pointer-events-none"></div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-yellow-400 text-slate-950 shadow-md">
                      {selectedT.format === "knockout"
                        ? "⚡ Eliminazione Diretta"
                        : selectedT.format === "gironi_knockout"
                        ? "🥇🥈 Gironi + Eliminazione Diretta"
                        : "🏆 Fase a Gironi"}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                        STATUS_CFG[selectedT.status]?.badge || "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {STATUS_CFG[selectedT.status]?.label || selectedT.status}
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {LEVEL_CFG[selectedT.level]?.label || selectedT.level}
                    </span>
                  </div>

                  <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                    {selectedT.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-400 pt-1">
                    <span>
                      📅{" "}
                      {new Date(selectedT.date).toLocaleDateString("it-IT", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span>
                      ⏰ {selectedT.startTime || "09:00"} – {selectedT.endTime || "18:00"}
                    </span>
                    {selectedT.courts?.length > 0 && (
                      <span>
                        🏟️ {selectedT.courts.map((c) => c.name || c).join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Statistiche Rapide */}
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center min-w-[90px]">
                    <div className="text-xl md:text-2xl font-black text-yellow-400">
                      {selectedT.couples?.length || 0}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Coppie</div>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center min-w-[90px]">
                    <div className="text-xl md:text-2xl font-black text-emerald-400">
                      {selectedT.matches?.filter((m) => m.winner).length || 0}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Partite Fatte</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tabs Navigazione per tornei misti o partecipanti */}
            {selectedT.format === "gironi_knockout" ? (
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
                <button
                  onClick={() => setActiveSubTab("auto")}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all shrink-0 ${
                    activeSubTab === "auto" || activeSubTab === "gold"
                      ? "bg-yellow-400 text-slate-950 shadow-md"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  🥇 Tabellone Gold
                </button>
                <button
                  onClick={() => setActiveSubTab("silver")}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all shrink-0 ${
                    activeSubTab === "silver"
                      ? "bg-slate-200 text-slate-900 shadow-md"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  🥈 Tabellone Silver
                </button>
                <button
                  onClick={() => setActiveSubTab("gironi")}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all shrink-0 ${
                    activeSubTab === "gironi"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  📊 Gironi di Qualificazione
                </button>
                <button
                  onClick={() => setActiveSubTab("couples")}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all shrink-0 ${
                    activeSubTab === "couples"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  👥 Partecipanti ({selectedT.couples?.length || 0})
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setActiveSubTab("auto")}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all ${
                    activeSubTab !== "couples"
                      ? "bg-yellow-400 text-slate-950 shadow-md"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {selectedT.format === "knockout" ? "⚡ Tabellone Partite" : "🏆 Gironi e Classifiche"}
                </button>
                <button
                  onClick={() => setActiveSubTab("couples")}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all ${
                    activeSubTab === "couples"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  👥 Elenco Coppie ({selectedT.couples?.length || 0})
                </button>
              </div>
            )}

            {/* ── Visualizzazione Contenuto Principale ── */}

            {/* TAB: COPPIE PARTECIPANTI */}
            {activeSubTab === "couples" && (
              <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                  <span>👥</span> Coppie Iscritte al Torneo
                </h3>
                {selectedT.couples?.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">Nessuna coppia iscritta al momento.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedT.couples.map((c, idx) => (
                      <div
                        key={c._id || idx}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-200 truncate">
                            {c.seeded && <span className="text-amber-400 text-xs shrink-0">⭐ Testa di serie</span>}
                            <span className="truncate">{coupleFullName(c)}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {c.name || "Coppia"}
                          </div>
                        </div>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg font-bold shrink-0">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FORMAT: SOLO ELIMINAZIONE DIRETTA */}
            {selectedT.format === "knockout" && activeSubTab !== "couples" && (
              <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                  <span>⚡</span> Tabellone ad Eliminazione Diretta
                </h3>
                <PublicBracketView rounds={selectedT.knockoutRounds} couples={selectedT.couples} />
              </div>
            )}

            {/* FORMAT: SOLO GIRONI */}
            {selectedT.format === "gironi" && activeSubTab !== "couples" && (
              <div className="space-y-6">
                <PublicGironiView
                  groups={selectedT.groups}
                  couples={selectedT.couples}
                  allMatches={selectedT.matches}
                />
              </div>
            )}

            {/* FORMAT: GIRONI + KO */}
            {selectedT.format === "gironi_knockout" && activeSubTab !== "couples" && (
              <div className="space-y-6">
                {(activeSubTab === "auto" || activeSubTab === "gold") && (
                  <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-lg font-black text-yellow-400 flex items-center gap-2">
                        <span>🥇</span> Tabellone GOLD — Prime 2 di ogni girone
                      </h3>
                      {(!selectedT.knockoutGold || selectedT.knockoutGold.length === 0) && (
                        <span className="text-xs text-amber-300/80 bg-amber-950/40 border border-amber-800/60 px-3 py-1 rounded-xl">
                          In attesa del completamento dei gironi
                        </span>
                      )}
                    </div>
                    <PublicBracketView rounds={selectedT.knockoutGold} couples={selectedT.couples} />
                  </div>
                )}

                {activeSubTab === "silver" && (
                  <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-lg font-black text-slate-300 flex items-center gap-2">
                        <span>🥈</span> Tabellone SILVER — Terze classificate
                      </h3>
                      {(!selectedT.knockoutSilver || selectedT.knockoutSilver.length === 0) && (
                        <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-3 py-1 rounded-xl">
                          In attesa del completamento dei gironi
                        </span>
                      )}
                    </div>
                    <PublicBracketView rounds={selectedT.knockoutSilver} couples={selectedT.couples} />
                  </div>
                )}

                {activeSubTab === "gironi" && (
                  <PublicGironiView
                    groups={selectedT.groups}
                    couples={selectedT.couples}
                    allMatches={selectedT.matches}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Pannello Live Tornei • {config.clubName || "Gestione Tornei Padel"} • Visualizzazione di sola lettura
      </footer>
    </div>
  );
}

