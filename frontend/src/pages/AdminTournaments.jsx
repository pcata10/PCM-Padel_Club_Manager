import { useState, useEffect } from "react";
import axios from "axios";
import html2canvas from "html2canvas";
import NavBar from "../components/NavBar";
import SponsorFooter from "../components/SponsorFooter";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Costanti ────────────────────────────────────────────────────
const STATUS_CFG = {
  open: {
    label: "Iscrizioni aperte",
    badge: "bg-green-100 text-green-700",
    icon: "🟢",
  },
  running: {
    label: "In corso",
    badge: "bg-yellow-100 text-yellow-700",
    icon: "⚡",
  },
  finished: {
    label: "Concluso",
    badge: "bg-gray-100 text-gray-500",
    icon: "🏁",
  },
};
const LEVEL_CFG = {
  intermedio: { label: "Intermedio", badge: "bg-orange-100 text-orange-700" },
  agonista: { label: "Agonista", badge: "bg-red-100 text-red-700" },
};
const ROUND_ORDER = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
const ROUND_LABEL = {
  F: "🏆 Finale",
  SF: "Semifinale",
  QF: "Quarti di finale",
  R16: "Ottavi",
  R32: "Sedicesimi",
};

const EMPTY_FORM = {
  name: "",
  date: "",
  startTime: "09:00",
  endTime: "18:00",
  courts: [],
  level: "intermedio",
  status: "open",
  format: "gironi",
};
const EMPTY_NEW_PLAYER = {
  name: "",
  surname: "",
  email: "",
  level: "intermedio",
  hand: "destra",
};

const TABS = [
  { id: "couples", label: "🤝 Coppie" },
  { id: "players", label: "👤 Giocatori" },
  { id: "draw", label: "🏆 Tabellone" },
];

// ── Helpers ──────────────────────────────────────────────────────
function Badge({ className, children }) {
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="font-semibold">{title}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  );
}

// Mostra "Cognome1 / Cognome2" se disponibili, altrimenti il nome coppia
function coupleShortName(couple) {
  if (!couple) return "?";
  const s1 = couple.player1?.surname?.trim();
  const s2 = couple.player2?.surname?.trim();
  if (s1 && s2) return `${s1} / ${s2}`;
  // fallback: primo token del nome coppia (es. "Marco Rossi / Luigi Verdi" → "Rossi / Verdi")
  if (couple.name) {
    const parts = couple.name.split("/").map((p) => p.trim().split(" ").pop());
    if (parts.length === 2) return parts.join(" / ");
    return couple.name;
  }
  return "?";
}

// Nome completo per liste e modal
function coupleFullName(couple) {
  if (!couple) return "?";
  if (couple.name) return couple.name;
  const n1 = [couple.player1?.name, couple.player1?.surname]
    .filter(Boolean)
    .join(" ");
  const n2 = [couple.player2?.name, couple.player2?.surname]
    .filter(Boolean)
    .join(" ");
  return n1 && n2 ? `${n1} / ${n2}` : "?";
}

// ── BracketColumn ────────────────────────────────────────────────
function BracketColumn({ round, matches, couples, phase, onMatchClick }) {
  return (
    <div className="flex flex-col gap-3 min-w-[180px]">
      <div
        className={`text-center text-xs font-bold py-1.5 rounded-xl text-white ${phase === "gold"
          ? "bg-gradient-to-r from-amber-500 to-yellow-500"
          : "bg-gradient-to-r from-slate-400 to-gray-500"
          }`}
      >
        {ROUND_LABEL[round] || round}
      </div>
      {matches.map((m) => {
        const c1 = couples.find(
          (c) => c._id?.toString() === m.couple1?.toString(),
        );
        const c2 = couples.find(
          (c) => c._id?.toString() === m.couple2?.toString(),
        );
        const hasBoth = c1 && c2;
        return (
          <div
            key={m._id}
            onClick={() => hasBoth && onMatchClick(m, c1, c2)}
            className={`rounded-2xl border overflow-hidden transition-all select-none
              ${m.winner ? "border-green-200 shadow-sm" : "border-gray-200"}
              ${hasBoth ? "cursor-pointer hover:shadow-md" : "opacity-40 cursor-not-allowed"}
            `}
          >
            {[c1, c2].map((c, i) => (
              <div
                key={i}
                className={`px-3 py-2 text-xs font-bold flex items-center justify-between
                  ${i === 0 ? "border-b border-gray-100" : ""}
                  ${m.winner?.toString() === c?._id?.toString()
                    ? "bg-green-50 text-green-700"
                    : m.winner
                      ? "bg-gray-50 text-gray-400"
                      : "bg-white text-slate-700"
                  }
                `}
              >
                <span className="truncate">
                  {c ? (
                    <>
                      {c.seeded && <span className="mr-0.5">⭐</span>}
                      {coupleShortName(c)}
                    </>
                  ) : (
                    <em className="text-gray-300 font-normal">In attesa</em>
                  )}
                </span>
                {m.winner?.toString() === c?._id?.toString() && (
                  <span className="ml-1 shrink-0 text-green-500">✓</span>
                )}
              </div>
            ))}
            {m.score && (
              <div className="text-center text-[10px] py-0.5 bg-yellow-50 text-yellow-700 font-bold border-t border-yellow-100">
                {m.score}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── BracketSection ───────────────────────────────────────────────
function BracketSection({ phase, matches, couples, onMatchClick }) {
  if (!matches.length) return null;
  const rounds = [...new Set(matches.map((m) => m.round))].sort(
    (a, b) => (ROUND_ORDER[a] ?? 9) - (ROUND_ORDER[b] ?? 9),
  );

  const isGold = phase === "gold";
  const title = isGold ? "🥇 Fase Gold" : "🥈 Fase Silver";
  const subtitle = isGold ? "Prime 2 di ogni girone" : "Terze classificate";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold
          ${isGold ? "bg-amber-500" : "bg-slate-400"}`}
        >
          {isGold ? "2" : "3"}
        </span>
        <h4 className="font-bold text-slate-700">{title}</h4>
        <span className="text-xs text-gray-400">— {subtitle}</span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max pb-1">
          {rounds.map((round) => (
            <BracketColumn
              key={round}
              round={round}
              matches={matches.filter((m) => m.round === round)}
              couples={couples}
              phase={phase}
              onMatchClick={onMatchClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── KnockoutBracketView (Eliminazione Diretta) ────────────────────
function KnockoutBracketView({ rounds, couples, onMatchClick }) {
  if (!rounds || !rounds.length) return null;

  const resolveCouple = (cRef) => {
    if (!cRef) return null;
    if (typeof cRef === "object" && cRef._id) return cRef;
    return couples.find((c) => c._id?.toString() === cRef.toString()) || null;
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max items-start py-3 px-1">
        {rounds.map((round, rIdx) => (
          <div key={round.name || rIdx} className="w-64 flex flex-col gap-3">
            {/* Round Title Header */}
            <div className="bg-gradient-to-r from-slate-900 to-black text-yellow-400 font-black text-xs px-4 py-2.5 rounded-2xl text-center shadow-md flex items-center justify-between border border-neutral-800">
              <span>{round.name}</span>
              <span className="text-[10px] bg-neutral-800 text-yellow-300 font-bold px-2 py-0.5 rounded-full">
                {round.matches.length} {round.matches.length === 1 ? "match" : "match"}
              </span>
            </div>

            {/* Matches in Round */}
            <div className="flex flex-col gap-3 flex-1 justify-around">
              {round.matches.map((m, mIdx) => {
                const c1 = resolveCouple(m.couple1);
                const c2 = resolveCouple(m.couple2);
                const winnerId =
                  typeof m.winner === "object" ? m.winner?._id : m.winner;
                const isFinished = !!winnerId;
                const isPlayable = !!c1 && !!c2;

                return (
                  <div
                    key={m._id || mIdx}
                    onClick={() => isPlayable && onMatchClick(m, c1, c2)}
                    className={`rounded-2xl border-2 transition-all overflow-hidden select-none shadow-sm ${isPlayable
                        ? "cursor-pointer hover:shadow-lg hover:border-yellow-400"
                        : "opacity-60 cursor-not-allowed"
                      } ${isFinished
                        ? "border-emerald-300 bg-white"
                        : "border-slate-200 bg-white"
                      }`}
                  >
                    {/* Top subheader */}
                    <div className="bg-slate-50 border-b border-slate-100 px-3 py-1 flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>Match #{mIdx + 1}</span>
                      {m.score ? (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-extrabold text-[10px]">
                          {m.score}
                        </span>
                      ) : isPlayable ? (
                        <span className="text-teal-600 font-semibold hover:underline">
                          Risultato ✏️
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">In attesa</span>
                      )}
                    </div>

                    {/* Team 1 */}
                    <div
                      className={`px-3 py-2 text-xs font-bold flex items-center justify-between border-b border-slate-100 ${winnerId &&
                          (winnerId === c1?._id ||
                            winnerId?.toString() === c1?._id?.toString())
                          ? "bg-emerald-50 text-emerald-800"
                          : winnerId
                            ? "bg-slate-50 text-slate-400"
                            : "bg-white text-slate-700"
                        }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {c1?.seeded && (
                          <span className="text-amber-500 text-[10px]">⭐</span>
                        )}
                        <span className="truncate">
                          {c1 ? coupleShortName(c1) : "(In attesa)"}
                        </span>
                      </div>
                      {winnerId &&
                        (winnerId === c1?._id ||
                          winnerId?.toString() === c1?._id?.toString()) && (
                          <span className="text-emerald-600 font-extrabold text-xs ml-1">
                            ✓
                          </span>
                        )}
                    </div>

                    {/* Team 2 */}
                    <div
                      className={`px-3 py-2 text-xs font-bold flex items-center justify-between ${winnerId &&
                          (winnerId === c2?._id ||
                            winnerId?.toString() === c2?._id?.toString())
                          ? "bg-emerald-50 text-emerald-800"
                          : winnerId
                            ? "bg-slate-50 text-slate-400"
                            : "bg-white text-slate-700"
                        }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {c2?.seeded && (
                          <span className="text-amber-500 text-[10px]">⭐</span>
                        )}
                        <span className="truncate">
                          {c2 ? coupleShortName(c2) : "(In attesa)"}
                        </span>
                      </div>
                      {winnerId &&
                        (winnerId === c2?._id ||
                          winnerId?.toString() === c2?._id?.toString()) && (
                          <span className="text-emerald-600 font-extrabold text-xs ml-1">
                            ✓
                          </span>
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

// ════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ════════════════════════════════════════════════════════════════
export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedT, setSelectedT] = useState(null);
  const [activeTab, setActiveTab] = useState("couples");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // modal giocatore
  const [playerModal, setPlayerModal] = useState(null);
  const [playerTab, setPlayerTab] = useState("search");
  const [playerSearch, setPlayerSearch] = useState("");
  const [newPlayerForm, setNewPlayerForm] = useState(EMPTY_NEW_PLAYER);

  // modal coppia
  const [coupleModal, setCoupleModal] = useState(null);
  const [coupleTab, setCoupleTab] = useState("direct"); // "direct" | "batch"
  const [coupleForm, setCoupleForm] = useState({
    player1: "",
    player2: "",
    name: "",
  });
  const [batchCouplesText, setBatchCouplesText] = useState("");

  // modal risultato
  const [scoreModal, setScoreModal] = useState(null);
  const [scoreForm, setScoreForm] = useState({ score: "", winner: "" });

  const [drawLoading, setDrawLoading] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  // modal conferma azioni
  const [confirmAction, setConfirmAction] = useState(null); // { title, sub, onConfirm, btnText, color }

  // ── Fetch ────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, cRes] = await Promise.all([
        api.get("/api/tournaments"),
        api.get("/api/admin/players"),
        api.get("/api/courts"),
      ]);
      setTournaments(tRes.data);
      setAllPlayers(pRes.data);
      setCourts(cRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshT = async (id) => {
    const res = await api.get(`/api/tournaments/${id}`);
    setSelectedT(res.data);
    setTournaments((prev) => prev.map((t) => (t._id === id ? res.data : t)));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ── Torneo CRUD ──────────────────────────────────────────────
  const saveTournament = async () => {
    if (!form.name || !form.date) return alert("Nome e data obbligatori");
    try {
      if (editingId) await api.put(`/api/tournaments/${editingId}`, form);
      else await api.post("/api/tournaments", form);
      await fetchAll();
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      alert(err.response?.data?.msg || "Errore salvataggio torneo");
    }
  };

  const deleteTournament = async (id) => {
    try {
      await api.delete(`/api/tournaments/${id}`);
      if (selectedT?._id === id) setSelectedT(null);
      await fetchAll();
      setConfirmAction(null);
    } catch (err) {
      alert("Errore eliminazione torneo");
    }
  };

  const startEdit = (t) => {
    setForm({
      name: t.name,
      date: t.date.slice(0, 10),
      startTime: t.startTime || "09:00",
      endTime: t.endTime || "18:00",
      level: t.level,
      status: t.status,
      format: t.format || "gironi",
      courts: t.courts?.map((c) => c._id || c) || [],
    });
    setEditingId(t._id);
    setShowForm(true);
    setSelectedT(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Giocatori ────────────────────────────────────────────────
  const addRegisteredPlayer = async (tid, playerId) => {
    try {
      await api.post(`/api/tournaments/${tid}/players`, { playerId });
      await refreshT(tid);
    } catch (err) {
      alert(err.response?.data?.msg || "Errore aggiunta giocatore");
    }
  };

  const addNewPlayer = async (tid) => {
    if (!newPlayerForm.name) return alert("Nome obbligatorio");
    try {
      const res = await api.post("/api/admin/players", {
        name: newPlayerForm.name.trim(),
        surname: newPlayerForm.surname.trim(),
        email: newPlayerForm.email.trim() || undefined,
        level: newPlayerForm.level,
        hand: newPlayerForm.hand,
        password: Math.random().toString(36).slice(-8),
      });
      await api.post(`/api/tournaments/${tid}/players`, {
        playerId: res.data._id,
      });
      await fetchAll();
      await refreshT(tid);
      setNewPlayerForm(EMPTY_NEW_PLAYER);
      setPlayerTab("search");
    } catch (err) {
      alert(err.response?.data?.msg || "Errore creazione giocatore");
    }
  };

  const removePlayer = async (tid, playerId) => {
    try {
      await api.delete(`/api/tournaments/${tid}/players/${playerId}`);
      await refreshT(tid);
      setConfirmAction(null);
    } catch (err) {
      alert(err.response?.data?.msg || "Errore rimozione giocatore");
    }
  };

  // ── Coppie ────────────────────────────────────────────────────
  const addCouple = async (tid) => {
    if (!coupleForm.player1?.trim() || !coupleForm.player2?.trim())
      return alert("Inserisci i nomi di entrambi i giocatori");
    if (
      coupleForm.player1.trim().toLowerCase() ===
      coupleForm.player2.trim().toLowerCase()
    )
      return alert("I due giocatori devono avere nomi diversi");
    try {
      await api.post(`/api/tournaments/${tid}/couples`, {
        player1Name: coupleForm.player1.trim(),
        player2Name: coupleForm.player2.trim(),
        name: coupleForm.name?.trim() || undefined,
      });
      await refreshT(tid);
      await fetchAll();
      setCoupleModal(null);
      setCoupleForm({ player1: "", player2: "", name: "" });
    } catch (err) {
      alert(err.response?.data?.msg || "Errore aggiunta coppia");
    }
  };

  const addBatchCouples = async (tid) => {
    if (!batchCouplesText.trim())
      return alert("Incolla o inserisci almeno una coppia");
    try {
      const res = await api.post(`/api/tournaments/${tid}/couples/batch`, {
        text: batchCouplesText,
      });
      await refreshT(tid);
      await fetchAll();
      alert(`✅ Aggiunte con successo ${res.data.addedCount} coppie!`);
      setCoupleModal(null);
      setBatchCouplesText("");
    } catch (err) {
      alert(err.response?.data?.msg || "Errore aggiunta batch");
    }
  };

  const removeCouple = async (tid, coupleId) => {
    try {
      await api.delete(`/api/tournaments/${tid}/couples/${coupleId}`);
      await refreshT(tid);
      setConfirmAction(null);
    } catch (err) {
      alert(err.response?.data?.msg || "Errore rimozione coppia");
    }
  };

  const toggleSeed = async (tid, coupleId, current) => {
    try {
      await api.patch(`/api/tournaments/${tid}/couples/${coupleId}/seed`, {
        seeded: !current,
      });
      await refreshT(tid);
    } catch (err) {
      alert(err.response?.data?.msg || "Errore");
    }
  };

  // ── Tabellone ─────────────────────────────────────────────────
  const generateDraw = async (tid, chosenFormat) => {
    const t = tournaments.find((x) => x._id === tid);
    const format = chosenFormat || t?.format || "gironi";
    const minCouples = format === "knockout" ? 2 : 3;
    if ((t?.couples?.length || 0) < minCouples)
      return alert(
        `Servono almeno ${minCouples} coppie per ${format === "knockout" ? "l'eliminazione diretta" : "i gironi"
        } (${t?.couples?.length || 0} attualmente iscritte)`
      );

    setDrawLoading(true);
    try {
      await api.post(`/api/tournaments/${tid}/draw`, { format });
      await fetchAll();
      await refreshT(tid);
      setConfirmAction(null);
    } catch (err) {
      alert(err.response?.data?.msg || "Errore generazione tabellone");
    } finally {
      setDrawLoading(false);
    }
  };

  const exportDrawAsImage = async (format = "png") => {
    const el = document.getElementById("tournament-draw-capture");
    if (!el) return alert("Nessun tabellone trovato da esportare");
    setExportingImage(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      const safeName = (selectedT?.name || "tabellone").replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );
      link.download = `${safeName}_tabellone.${format}`;
      link.href = canvas.toDataURL(
        format === "jpeg" ? "image/jpeg" : "image/png",
        0.95
      );
      link.click();
    } catch (err) {
      console.error("Export image error:", err);
      alert("Errore durante l'esportazione dell'immagine");
    } finally {
      setExportingImage(false);
    }
  };

  // ── Risultati ─────────────────────────────────────────────────
  const saveScore = async () => {
    if (!scoreForm.winner) return alert("Seleziona il vincitore");
    try {
      await api.put(
        `/api/tournaments/${scoreModal.tournamentId}/matches/${scoreModal.matchId}`,
        scoreForm,
      );
      setScoreModal(null);
      setScoreForm({ score: "", winner: "" });
      await refreshT(scoreModal.tournamentId);
    } catch (err) {
      alert(err.response?.data?.msg || "Errore salvataggio");
    }
  };

  // ── Helpers locali ────────────────────────────────────────────
  const tPlayers = (t) =>
    (t?.players || [])
      .map((p) =>
        typeof p === "object" ? p : allPlayers.find((pl) => pl._id === p),
      )
      .filter(Boolean);

  const filteredPlayers = allPlayers.filter((p) =>
    `${p.name} ${p.surname || ""} ${p.email}`
      .toLowerCase()
      .includes(playerSearch.toLowerCase()),
  );

  const playerDisplayName = (p) =>
    [p.name, p.surname].filter(Boolean).join(" ");

  const groupRanking = (t, groupIdentifier) => {
    const group = t.groups?.find(
      (g) =>
        g.number === groupIdentifier ||
        g.name === groupIdentifier ||
        g._id === groupIdentifier
    );
    if (!group) return [];
    const stats = {};
    (group.couples || []).forEach((cItem) => {
      const id =
        typeof cItem === "object"
          ? cItem._id?.toString()
          : cItem?.toString();
      if (!id) return;
      stats[id] = { id, wins: 0, losses: 0, played: 0 };
    });

    const allGroupMatches = [
      ...(group.matches || []),
      ...(t.matches || []).filter(
        (m) =>
          m.phase === "group" &&
          (m.group === groupIdentifier || m.group === group.number)
      ),
    ];

    allGroupMatches
      .filter((m) => m.winner)
      .forEach((m) => {
        const w =
          typeof m.winner === "object"
            ? m.winner._id?.toString()
            : m.winner?.toString();
        const c1 =
          typeof m.couple1 === "object"
            ? m.couple1._id?.toString()
            : m.couple1?.toString();
        const c2 =
          typeof m.couple2 === "object"
            ? m.couple2._id?.toString()
            : m.couple2?.toString();
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
        couple: t.couples?.find((c) => c._id?.toString() === s.id),
      }));
  };

  // ── Loading ───────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-400">
        <div className="text-xl text-emerald-600">Caricando Tornei...</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-300">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-10 pb-20 space-y-6">
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold text-slate-800">🏆 Tornei</h1>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setForm(EMPTY_FORM);
            }}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 rounded-2xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow"
          >
            {showForm ? "✕ Annulla" : "+ Nuovo Torneo"}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════
            FORM CREA / MODIFICA TORNEO
        ══════════════════════════════════════════════════════ */}
        {showForm && (
          <div className="bg-white/95 rounded-3xl shadow-xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-800">
              {editingId ? "✏️ Modifica Torneo" : "➕ Nuovo Torneo"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Nome torneo *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="es. Torneo Intermedio"
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  📅 Data *
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  style={{ WebkitAppearance: "none", appearance: "none" }}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    ⏰ Inizio
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    step="1800"
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                    style={{ WebkitAppearance: "none", appearance: "none" }}
                    className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    ⏰ Fine
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    step="1800"
                    onChange={(e) =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                    style={{ WebkitAppearance: "none", appearance: "none" }}
                    className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  ⚔️ Formato Torneo
                </label>
                <select
                  value={form.format || "gironi"}
                  onChange={(e) =>
                    setForm({ ...form, format: e.target.value })
                  }
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm font-semibold text-slate-800"
                >
                  <option value="gironi">🏆 Torneo a Gironi (All'italiana)</option>
                  <option value="knockout">
                    ⚡ Eliminazione Diretta (Tabellone KO)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  🎯 Livello
                </label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm"
                >
                  <option value="intermedio">Intermedio</option>
                  <option value="agonista">Agonista</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  📌 Stato
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm"
                >
                  <option value="open">🟢 Iscrizioni aperte</option>
                  <option value="running">⚡ In corso</option>
                  <option value="finished">🏁 Concluso</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  🏟 Campi coinvolti
                </label>
                <div className="flex flex-wrap gap-2">
                  {courts.map((court) => {
                    const sel = form.courts.includes(court._id);
                    return (
                      <button
                        key={court._id}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            courts: sel
                              ? f.courts.filter((id) => id !== court._id)
                              : [...f.courts, court._id],
                          }))
                        }
                        className={`px-4 py-2 rounded-2xl text-sm font-semibold border-2 transition-all ${sel
                          ? "bg-slate-700 text-white border-slate-800"
                          : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                          }`}
                      >
                        {sel ? "✓ " : ""}
                        {court.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
              >
                Annulla
              </button>
              <button
                onClick={saveTournament}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold hover:from-emerald-600 hover:to-teal-700"
              >
                {editingId ? "💾 Salva modifiche" : "➕ Crea torneo"}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            LISTA TORNEI
        ══════════════════════════════════════════════════════ */}
        {tournaments.length === 0 ? (
          <div className="bg-white/80 rounded-3xl shadow p-12 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-gray-400 text-lg">Nessun torneo creato</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tournaments.map((t) => {
              const isOpen = selectedT?._id === t._id;
              return (
                <div
                  key={t._id}
                  className={`bg-white/95 rounded-3xl shadow-lg overflow-hidden transition-all ${isOpen ? "ring-2 ring-emerald-400" : ""
                    }`}
                >
                  {/* ── Card header ── */}
                  <div
                    className="px-5 py-4 flex items-start md:items-center justify-between flex-wrap gap-3 cursor-pointer hover:bg-slate-50 transition-all"
                    onClick={() => {
                      setSelectedT(isOpen ? null : t);
                      setActiveTab("couples");
                    }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-slate-800">
                          {t.name}
                        </span>
                        <Badge
                          className={
                            t.format === "knockout"
                              ? "bg-purple-100 text-purple-700 font-bold"
                              : "bg-amber-100 text-amber-700 font-bold"
                          }
                        >
                          {t.format === "knockout"
                            ? "⚡ Eliminazione Diretta"
                            : "🏆 Gironi"}
                        </Badge>
                        <Badge
                          className={
                            LEVEL_CFG[t.level]?.badge ||
                            "bg-gray-100 text-gray-500"
                          }
                        >
                          {LEVEL_CFG[t.level]?.label || t.level}
                        </Badge>
                        <Badge className={STATUS_CFG[t.status]?.badge}>
                          {STATUS_CFG[t.status]?.icon}{" "}
                          {STATUS_CFG[t.status]?.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span>
                          📅{" "}
                          {new Date(t.date).toLocaleDateString("it-IT", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <span>
                          ⏰ {t.startTime || "09:00"} – {t.endTime || "18:00"}
                        </span>
                        {t.courts?.length > 0 && (
                          <span>
                            🏟 {t.courts.map((c) => c.name || c).join(", ")}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge className="bg-teal-100 text-teal-700">
                          🤝 {t.couples?.length || 0} coppie
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-700">
                          👤 {t.players?.length || 0} giocatori
                        </Badge>
                        {t.groups?.length > 0 && (
                          <Badge className="bg-slate-100 text-slate-600">
                            ⬡ {t.groups.length} gironi
                          </Badge>
                        )}
                        {t.matches?.filter((m) => m.phase === "group").length >
                          0 && (
                            <Badge className="bg-amber-100 text-amber-700">
                              🎾{" "}
                              {
                                t.matches.filter(
                                  (m) => m.phase === "group" && m.winner,
                                ).length
                              }
                              /
                              {
                                t.matches.filter((m) => m.phase === "group")
                                  .length
                              }{" "}
                              match gironi
                            </Badge>
                          )}
                      </div>
                    </div>
                    <div
                      className="flex gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => startEdit(t)}
                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-200"
                      >
                        ✏️ Modifica
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({
                            title: `Eliminare ${t.name}?`,
                            sub: "Tutti i dati, iscrizioni e match verranno persi per sempre.",
                            onConfirm: () => deleteTournament(t._id),
                            btnText: "Sì, elimina torneo",
                            color: "from-red-500 to-rose-600",
                          })
                        }
                        className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-200"
                      >
                        🗑 Elimina
                      </button>
                      <span className="text-gray-300 text-lg self-center">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* ── Dettaglio espandibile ── */}
                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {/* Tab bar */}
                      <div className="flex border-b border-gray-100 bg-slate-50">
                        {TABS.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === tab.id
                              ? "border-b-2 border-emerald-500 text-emerald-700 bg-white"
                              : "text-gray-400 hover:text-gray-600"
                              }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="px-5 py-5">
                        {/* ══ TAB: COPPIE ════════════════════════════════════ */}
                        {activeTab === "couples" && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-gray-700">
                                🤝 Coppie iscritte
                                <span className="ml-1.5 text-sm font-normal text-gray-400">
                                  ({t.couples?.length || 0})
                                </span>
                              </h3>
                              <button
                                onClick={() => {
                                  setCoupleModal(t._id);
                                  setCoupleTab("direct");
                                  setCoupleForm({
                                    player1: "",
                                    player2: "",
                                    name: "",
                                  });
                                  setBatchCouplesText("");
                                }}
                                className="text-sm bg-teal-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-teal-600 transition-all flex items-center gap-1.5 shadow-sm"
                              >
                                <span>➕</span> Aggiungi coppia
                              </button>
                            </div>

                            {t.couples?.filter((c) => c.seeded).length > 0 && (
                              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 mb-4 flex flex-wrap gap-2 items-center">
                                <span className="text-xs font-bold text-amber-700">
                                  ⭐ Teste di serie:
                                </span>
                                {t.couples
                                  .filter((c) => c.seeded)
                                  .map((c) => (
                                    <span
                                      key={c._id}
                                      className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold"
                                    >
                                      {coupleShortName(c)}
                                    </span>
                                  ))}
                              </div>
                            )}

                            {!t.couples?.length ? (
                              <EmptyState
                                icon="🤝"
                                title="Nessuna coppia iscritta"
                                sub='Clicca "+ Aggiungi coppia" per iniziare'
                              />
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {t.couples.map((c) => (
                                  <div
                                    key={c._id}
                                    className={`flex items-center justify-between rounded-2xl px-4 py-3 border transition-all ${c.seeded
                                      ? "bg-amber-50 border-amber-200"
                                      : "bg-teal-50 border-teal-100"
                                      }`}
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        {c.seeded && (
                                          <span className="text-amber-500">
                                            ⭐
                                          </span>
                                        )}
                                        <span className="text-sm font-bold text-slate-700">
                                          {coupleShortName(c)}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-400 mt-0.5">
                                        {[c.player1?.name, c.player1?.surname]
                                          .filter(Boolean)
                                          .join(" ")}
                                        {" · "}
                                        {[c.player2?.name, c.player2?.surname]
                                          .filter(Boolean)
                                          .join(" ")}
                                      </div>
                                    </div>
                                    <div className="flex gap-1.5 ml-3 shrink-0">
                                      <button
                                        onClick={() =>
                                          toggleSeed(t._id, c._id, c.seeded)
                                        }
                                        title={
                                          c.seeded
                                            ? "Rimuovi testa di serie"
                                            : "Segna come testa di serie"
                                        }
                                        className={`text-xs px-2.5 py-1 rounded-xl font-semibold transition-all ${c.seeded
                                          ? "bg-amber-200 text-amber-800 hover:bg-amber-300"
                                          : "bg-gray-100 text-gray-400 hover:bg-amber-100 hover:text-amber-600"
                                          }`}
                                      >
                                        ⭐
                                      </button>
                                      <button
                                        onClick={() =>
                                          setConfirmAction({
                                            title: "Rimuovere questa coppia?",
                                            sub: `Sei sicuro di voler rimuovere la coppia "${coupleShortName(c)}"?`,
                                            onConfirm: () => removeCouple(t._id, c._id),
                                            btnText: "Rimuovi coppia",
                                            color: "from-red-500 to-rose-600",
                                          })
                                        }
                                        className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-xl font-semibold hover:bg-red-200"
                                      >
                                        🗑
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ══ TAB: GIOCATORI ════════════════════════════════ */}
                        {activeTab === "players" && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-gray-700">
                                👤 Giocatori iscritti
                                <span className="ml-1.5 text-sm font-normal text-gray-400">
                                  ({tPlayers(t).length})
                                </span>
                              </h3>
                              <button
                                onClick={() => {
                                  setPlayerModal(t._id);
                                  setPlayerSearch("");
                                  setPlayerTab("search");
                                }}
                                className="text-sm bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-600 transition-all"
                              >
                                + Aggiungi giocatore
                              </button>
                            </div>
                            {tPlayers(t).length === 0 ? (
                              <EmptyState
                                icon="👤"
                                title="Nessun giocatore iscritto"
                              />
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {tPlayers(t).map((p) => (
                                  <div
                                    key={p._id}
                                    className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2.5"
                                  >
                                    <div>
                                      <span className="text-sm font-semibold text-slate-700">
                                        {playerDisplayName(p)}
                                      </span>
                                      <div className="flex gap-1.5 mt-0.5">
                                        <Badge className="bg-gray-100 text-gray-500">
                                          {p.level}
                                        </Badge>
                                        {p.hand && (
                                          <Badge className="bg-gray-100 text-gray-500">
                                            {p.hand}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        setConfirmAction({
                                          title: "Rimuovere giocatore?",
                                          sub: `Stai per rimuovere "${playerDisplayName(p)}" dal torneo. Sarà rimosso anche da eventuali coppie.`,
                                          onConfirm: () => removePlayer(t._id, p._id),
                                          btnText: "Rimuovi giocatore",
                                          color: "from-red-500 to-rose-600",
                                        })
                                      }
                                      className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-xl font-semibold hover:bg-red-200 ml-3"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ══ TAB: TABELLONE ════════════════════════════════ */}
                        {activeTab === "draw" && (
                          <div>
                            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                              <div>
                                <h3 className="font-bold text-gray-700">
                                  🏆 Tabellone
                                </h3>
                                {t.groups?.length > 0 && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {t.groups.length} gironi ·{" "}
                                    {t.couples?.filter((c) => c.seeded).length}{" "}
                                    teste di serie
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    title: t.groups?.length > 0 ? "Rigenerare tabellone?" : "Generare tabellone?",
                                    sub: "Tutti i risultati e i match esistenti verranno resettati.",
                                    onConfirm: () => generateDraw(t._id),
                                    btnText: "Genera ora",
                                    color: "from-amber-500 to-orange-600",
                                  })
                                }
                                disabled={
                                  drawLoading || (t.couples?.length || 0) < 3
                                }
                                className={`text-sm px-4 py-2 rounded-xl font-semibold transition-all ${(t.couples?.length || 0) < 3
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                                  }`}
                              >
                                {drawLoading
                                  ? "⏳ Generando..."
                                  : t.groups?.length > 0
                                    ? "🔄 Rigenera"
                                    : "🎲 Genera tabellone"}
                              </button>
                            </div>

                            {(t.couples?.length || 0) < 3 && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 text-sm text-yellow-700 mb-4">
                                ⚠️ Servono almeno 3 coppie (
                                {t.couples?.length || 0} iscritte)
                              </div>
                            )}

                            {!t.groups?.length ? (
                              <EmptyState
                                icon="🎲"
                                title="Tabellone non ancora generato"
                                sub='Aggiungi le coppie (min. 3) e clicca "Genera tabellone"'
                              />
                            ) : (
                              <div className="space-y-8">
                                {/* Info box fasi */}
                                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                  {[
                                    {
                                      icon: "⬡",
                                      label: "Fase Gironi",
                                      desc: "Round-robin",
                                      color: "bg-slate-100 text-slate-600",
                                    },
                                    {
                                      icon: "🥇",
                                      label: "Fase Gold",
                                      desc: "1° e 2° per girone",
                                      color: "bg-amber-100 text-amber-700",
                                    },
                                    {
                                      icon: "🥈",
                                      label: "Fase Silver",
                                      desc: "3° classificato",
                                      color: "bg-gray-100 text-gray-600",
                                    },
                                  ].map((s) => (
                                    <div
                                      key={s.label}
                                      className={`rounded-2xl p-3 ${s.color}`}
                                    >
                                      <div className="text-xl mb-1">
                                        {s.icon}
                                      </div>
                                      <div className="font-bold">{s.label}</div>
                                      <div className="opacity-70 mt-0.5">
                                        {s.desc}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* ── FASE 1: GIRONI ── */}
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="w-6 h-6 bg-slate-700 text-white rounded-full text-xs flex items-center justify-center font-bold">
                                      1
                                    </span>
                                    <h4 className="font-bold text-slate-700">
                                      Fase a Gironi
                                    </h4>
                                    <span className="text-xs text-gray-400">
                                      —{" "}
                                      {
                                        t.matches.filter(
                                          (m) =>
                                            m.phase === "group" && m.winner,
                                        ).length
                                      }
                                      /
                                      {
                                        t.matches.filter(
                                          (m) => m.phase === "group",
                                        ).length
                                      }{" "}
                                      completati
                                    </span>
                                  </div>

                                  <div
                                    className={`grid gap-4 ${t.groups.length <= 2
                                      ? "grid-cols-1 md:grid-cols-2"
                                      : t.groups.length === 3
                                        ? "grid-cols-1 md:grid-cols-3"
                                        : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
                                      }`}
                                  >
                                    {t.groups.map((group) => {
                                      const ranking = groupRanking(
                                        t,
                                        group.number,
                                      );
                                      const gMatches = t.matches.filter(
                                        (m) =>
                                          m.phase === "group" &&
                                          m.group === group.number,
                                      );
                                      const done = gMatches.filter(
                                        (m) => m.winner,
                                      ).length;

                                      return (
                                        <div
                                          key={group.number}
                                          className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
                                        >
                                          {/* Header girone */}
                                          <div className="px-4 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-between">
                                            <span className="font-bold text-white text-sm">
                                              Girone {group.number}
                                            </span>
                                            <span className="text-xs text-white/60">
                                              {done}/{gMatches.length} ✓
                                            </span>
                                          </div>

                                          {/* Classifica */}
                                          <div className="px-3 py-2 border-b border-gray-100 space-y-1">
                                            {ranking.map((s, idx) => (
                                              <div
                                                key={s.id}
                                                className="flex items-center justify-between text-xs py-1"
                                              >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                  <span
                                                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${idx === 0
                                                      ? "bg-amber-400 text-white"
                                                      : idx === 1
                                                        ? "bg-slate-300 text-slate-700"
                                                        : "bg-gray-100 text-gray-400"
                                                      }`}
                                                  >
                                                    {idx + 1}
                                                  </span>
                                                  {s.couple?.seeded && (
                                                    <span className="text-amber-500 text-[10px] shrink-0">
                                                      ⭐
                                                    </span>
                                                  )}
                                                  <span
                                                    className={`font-semibold truncate ${idx > 1 ? "text-gray-400" : "text-slate-700"}`}
                                                  >
                                                    {coupleShortName(s.couple)}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                                  <span className="text-green-600 font-bold">
                                                    {s.wins}V
                                                  </span>
                                                  <span className="text-red-400">
                                                    {s.losses}S
                                                  </span>
                                                  <span
                                                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${idx < 2
                                                      ? "bg-amber-100 text-amber-700"
                                                      : "bg-gray-100 text-gray-400"
                                                      }`}
                                                  >
                                                    {idx < 2
                                                      ? "Gold"
                                                      : "Silver"}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Match del girone */}
                                          <div className="px-3 py-2 space-y-1.5">
                                            {gMatches.map((m) => {
                                              const c1 = t.couples.find(
                                                (c) =>
                                                  c._id?.toString() ===
                                                  m.couple1?.toString(),
                                              );
                                              const c2 = t.couples.find(
                                                (c) =>
                                                  c._id?.toString() ===
                                                  m.couple2?.toString(),
                                              );
                                              return (
                                                <div
                                                  key={m._id}
                                                  onClick={() => {
                                                    setScoreModal({
                                                      matchId: m._id,
                                                      tournamentId: t._id,
                                                      c1,
                                                      c2,
                                                    });
                                                    setScoreForm({
                                                      score: m.score || "",
                                                      winner:
                                                        m.winner?.toString() ||
                                                        "",
                                                    });
                                                  }}
                                                  className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-xs cursor-pointer transition-all ${m.winner
                                                    ? "bg-green-50 border border-green-100 hover:bg-green-100"
                                                    : "bg-gray-50 border border-gray-100 hover:bg-blue-50 hover:border-blue-200"
                                                    }`}
                                                >
                                                  <span
                                                    className={`font-bold truncate max-w-[60px] ${m.winner?.toString() ===
                                                      c1?._id?.toString()
                                                      ? "text-green-700"
                                                      : "text-gray-600"
                                                      }`}
                                                  >
                                                    {coupleShortName(c1)}
                                                  </span>
                                                  <span
                                                    className={`mx-1 px-1.5 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${m.score
                                                      ? "bg-yellow-100 text-yellow-700"
                                                      : "bg-gray-100 text-gray-400"
                                                      }`}
                                                  >
                                                    {m.score || "vs"}
                                                  </span>
                                                  <span
                                                    className={`font-bold truncate max-w-[60px] text-right ${m.winner?.toString() ===
                                                      c2?._id?.toString()
                                                      ? "text-green-700"
                                                      : "text-gray-600"
                                                      }`}
                                                  >
                                                    {coupleShortName(c2)}
                                                  </span>
                                                  <span className="ml-1 shrink-0">
                                                    {m.winner ? "✅" : "✏️"}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* ── FASE 2: GOLD ── */}
                                <BracketSection
                                  phase="gold"
                                  matches={t.matches.filter(
                                    (m) => m.phase === "gold",
                                  )}
                                  couples={t.couples}
                                  onMatchClick={(m, c1, c2) => {
                                    setScoreModal({
                                      matchId: m._id,
                                      tournamentId: t._id,
                                      c1,
                                      c2,
                                    });
                                    setScoreForm({
                                      score: m.score || "",
                                      winner: m.winner?.toString() || "",
                                    });
                                  }}
                                />

                                {/* ── FASE 3: SILVER ── */}
                                <BracketSection
                                  phase="silver"
                                  matches={t.matches.filter(
                                    (m) => m.phase === "silver",
                                  )}
                                  couples={t.couples}
                                  onMatchClick={(m, c1, c2) => {
                                    setScoreModal({
                                      matchId: m._id,
                                      tournamentId: t._id,
                                      c1,
                                      c2,
                                    });
                                    setScoreForm({
                                      score: m.score || "",
                                      winner: m.winner?.toString() || "",
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SponsorFooter />

      {/* ══════════════════════════════════════════════════════════
          MODAL: AGGIUNGI GIOCATORE
      ══════════════════════════════════════════════════════════ */}
      {playerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  👤 Aggiungi giocatore
                </h3>
                <button
                  onClick={() => setPlayerModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPlayerTab("search")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${playerTab === "search"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  🔍 Giocatori esistenti
                </button>
                <button
                  onClick={() => setPlayerTab("new")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${playerTab === "new"
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  ➕ Nuovo giocatore
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {playerTab === "search" ? (
                <>
                  <input
                    type="text"
                    placeholder="🔍 Cerca per nome, cognome o email..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-300"
                  />
                  <div className="space-y-2">
                    {filteredPlayers.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">
                        Nessun giocatore trovato
                      </p>
                    ) : (
                      filteredPlayers.map((p) => {
                        const cur = tournaments.find(
                          (t) => t._id === playerModal,
                        );
                        const alreadyIn = cur?.players?.some(
                          (pl) => (pl._id || pl) === p._id,
                        );
                        return (
                          <div
                            key={p._id}
                            className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-100"
                          >
                            <div>
                              <span className="text-sm font-semibold text-slate-700">
                                {playerDisplayName(p)}
                              </span>
                              {!p.email?.includes("@torneo.local") && (
                                <span className="text-xs text-gray-400 ml-2">
                                  {p.email}
                                </span>
                              )}
                              <div className="flex gap-1.5 mt-0.5">
                                <Badge className="bg-gray-100 text-gray-500">
                                  {p.level}
                                </Badge>
                                {p.hand && (
                                  <Badge className="bg-gray-100 text-gray-500">
                                    {p.hand}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <button
                              disabled={alreadyIn}
                              onClick={() =>
                                addRegisteredPlayer(playerModal, p._id)
                              }
                              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ml-3 shrink-0 ${alreadyIn
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                            >
                              {alreadyIn ? "✓ Iscritto" : "+ Iscrivi"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 text-sm text-emerald-700">
                    ℹ️ Verrà creato un nuovo account con password temporanea
                    casuale
                  </div>

                  {/* Nome + Cognome separati */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={newPlayerForm.name}
                        onChange={(e) =>
                          setNewPlayerForm({
                            ...newPlayerForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="es. Marco"
                        className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Cognome *
                      </label>
                      <input
                        type="text"
                        value={newPlayerForm.surname}
                        onChange={(e) =>
                          setNewPlayerForm({
                            ...newPlayerForm,
                            surname: e.target.value,
                          })
                        }
                        placeholder="es. Rossi"
                        className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Email{" "}
                      <span className="font-normal text-gray-400">
                        (opzionale)
                      </span>
                    </label>
                    <input
                      type="email"
                      value={newPlayerForm.email}
                      onChange={(e) =>
                        setNewPlayerForm({
                          ...newPlayerForm,
                          email: e.target.value,
                        })
                      }
                      placeholder="email@esempio.com"
                      className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Livello
                      </label>
                      <select
                        value={newPlayerForm.level}
                        onChange={(e) =>
                          setNewPlayerForm({
                            ...newPlayerForm,
                            level: e.target.value,
                          })
                        }
                        className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm"
                      >
                        <option value="principiante">Principiante</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzato">Avanzato</option>
                        <option value="agonista">Agonista</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Mano
                      </label>
                      <select
                        value={newPlayerForm.hand}
                        onChange={(e) =>
                          setNewPlayerForm({
                            ...newPlayerForm,
                            hand: e.target.value,
                          })
                        }
                        className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm"
                      >
                        <option value="destra">Destra</option>
                        <option value="sinistra">Sinistra</option>
                        <option value="ambidestro">Ambidestro</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => addNewPlayer(playerModal)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold hover:from-emerald-600 hover:to-teal-700"
                  >
                    ➕ Crea e iscrivi al torneo
                  </button>
                </>
              )}
            </div>

            <div className="px-6 pb-6 shrink-0 border-t border-gray-100 pt-4">
              <button
                onClick={() => setPlayerModal(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL: AGGIUNGI COPPIA (Semplificato & Rapido)
      ══════════════════════════════════════════════════════════ */}
      {coupleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  🤝 Aggiungi Coppia
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Scrivi direttamente i nomi: i giocatori vengono creati automaticamente!
                </p>
              </div>
              <button
                onClick={() => setCoupleModal(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Schede: Singola Rapida vs Incolla Multiplo */}
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setCoupleTab("direct")}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${coupleTab === "direct"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                ⚡ Inserimento Diretto
              </button>
              <button
                type="button"
                onClick={() => setCoupleTab("batch")}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${coupleTab === "batch"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                📋 Incolla Lista (Multiplo)
              </button>
            </div>

            {/* Datalist per autocompletamento rapido */}
            <datalist id="all-players-datalist">
              {allPlayers.map((p) => (
                <option
                  key={p._id}
                  value={playerDisplayName(p)}
                >
                  {p.level ? `Livello: ${p.level}` : ""}
                </option>
              ))}
            </datalist>

            {coupleTab === "direct" ? (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Giocatore 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="all-players-datalist"
                    value={coupleForm.player1}
                    onChange={(e) =>
                      setCoupleForm({ ...coupleForm, player1: e.target.value })
                    }
                    placeholder="Es. Mario Rossi (scrivi o seleziona)"
                    className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Giocatore 2 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="all-players-datalist"
                    value={coupleForm.player2}
                    onChange={(e) =>
                      setCoupleForm({ ...coupleForm, player2: e.target.value })
                    }
                    placeholder="Es. Luca Bianchi (scrivi o seleziona)"
                    className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nome Coppia{" "}
                    <span className="font-normal text-gray-400 lowercase">
                      (opzionale, auto-generato)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={coupleForm.name}
                    onChange={(e) =>
                      setCoupleForm({ ...coupleForm, name: e.target.value })
                    }
                    placeholder={
                      coupleForm.player1 && coupleForm.player2
                        ? `${coupleForm.player1} / ${coupleForm.player2}`
                        : "Es. I Campioni"
                    }
                    className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <span>✨</span>
                  <span>
                    Non serve creare i giocatori prima: se non sono registrati, il sistema li crea automaticamente!
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCoupleModal(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all text-sm"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => addCouple(coupleModal)}
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-teal-100 transition-all text-sm flex items-center justify-center gap-1.5"
                  >
                    ➕ Aggiungi Coppia
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Incolla o scrivi una coppia per riga:
                  </label>
                  <textarea
                    rows={6}
                    value={batchCouplesText}
                    onChange={(e) => setBatchCouplesText(e.target.value)}
                    placeholder={`Mario Rossi - Luca Bianchi\nAndrea Neri / Paolo Verdi\nGiovanni Gialli - Fabio Viola\nRoberto Bruno, Stefano Rosa`}
                    className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm font-mono focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all leading-relaxed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Puoi separare i due giocatori con <code className="bg-gray-100 px-1 rounded">-</code>, <code className="bg-gray-100 px-1 rounded">/</code>, oppure <code className="bg-gray-100 px-1 rounded">,</code>.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-800 flex items-center gap-2">
                  <span>⚡</span>
                  <span>
                    Ideale per incollare la lista da WhatsApp, Excel o Note in un solo istante!
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCoupleModal(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all text-sm"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => addBatchCouples(coupleModal)}
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-teal-100 transition-all text-sm flex items-center justify-center gap-1.5"
                  >
                    ⚡ Aggiungi Tutte le Coppie
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL: RISULTATO MATCH
      ══════════════════════════════════════════════════════════ */}
      {scoreModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                🎾 Risultato match
              </h3>
              <button
                onClick={() => setScoreModal(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
              >
                ✕
              </button>
            </div>

            {/* Preview */}
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-center gap-3 text-sm">
              <div className="text-right flex-1">
                <div className="font-bold text-slate-800">
                  {coupleShortName(scoreModal.c1)}
                </div>
                <div className="text-xs text-gray-400">
                  {coupleFullName(scoreModal.c1)}
                </div>
              </div>
              <span className="text-gray-300 font-light text-lg shrink-0">
                vs
              </span>
              <div className="text-left flex-1">
                <div className="font-bold text-slate-800">
                  {coupleShortName(scoreModal.c2)}
                </div>
                <div className="text-xs text-gray-400">
                  {coupleFullName(scoreModal.c2)}
                </div>
              </div>
            </div>

            {/* Punteggio */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Punteggio
              </label>
              <input
                type="text"
                value={scoreForm.score}
                onChange={(e) =>
                  setScoreForm({ ...scoreForm, score: e.target.value })
                }
                placeholder="es. 6-3 7-5"
                className="w-full p-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-amber-300"
              />
            </div>

            {/* Vincitore */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Vincitore
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[scoreModal.c1, scoreModal.c2].map((c) => (
                  <button
                    key={c?._id}
                    onClick={() =>
                      setScoreForm({ ...scoreForm, winner: c?._id?.toString() })
                    }
                    className={`py-3 px-3 rounded-2xl text-sm font-bold transition-all text-center ${scoreForm.winner === c?._id?.toString()
                      ? "bg-green-500 text-white shadow-md scale-[1.02]"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                  >
                    {c?.seeded ? "⭐ " : ""}
                    {coupleShortName(c)}
                    {scoreForm.winner === c?._id?.toString() && (
                      <div className="text-[10px] mt-0.5 font-normal opacity-80">
                        ✓ Vincitore
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setScoreModal(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
              >
                Annulla
              </button>
              <button
                onClick={saveScore}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-2xl font-bold hover:from-amber-600 hover:to-yellow-600"
              >
                💾 Salva
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════
          MODAL: CONFERMA AZIONE
      ══════════════════════════════════════════════════════════ */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-200">
            <div className={`text-5xl mb-4 ${confirmAction.color?.includes('amber') ? 'text-amber-500' : 'text-red-500'}`}>⚠️</div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{confirmAction.title}</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              {confirmAction.sub}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmAction.onConfirm}
                className={`w-full py-4 bg-gradient-to-r ${confirmAction.color} text-white rounded-2xl font-bold hover:shadow-lg transition-all text-lg`}
              >
                {confirmAction.btnText}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
