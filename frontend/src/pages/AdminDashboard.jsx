import { useState, useEffect } from "react";
import axios from "axios";
import NavBar from "../components/NavBar";
import CourtTimeline from "../components/CourtTimeline";
import SponsorFooter from "../components/SponsorFooter";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const SHOW_SPONSORS = false;

const COURT_COLORS = {
  "Campo 1": { bg: "#6366f1", border: "#4f46e5" },
  "Campo 2": { bg: "#8b5cf6", border: "#7c3aed" },
  "Campo 3": { bg: "#10b981", border: "#059669" },
  "Campo 4": { bg: "#14b8a6", border: "#0d9488" },
};

const STATUS_CONFIG = {
  available: {
    label: "Disponibile",
    badge: "bg-green-100 text-green-700",
    icon: "✅",
  },
  blocked: { label: "Blocca", badge: "bg-red-100 text-red-700", icon: "🔒" },
  academy: { label: "Academy", badge: "bg-blue-100 text-blue-700", icon: "🎓" },
  lesson: {
    label: "Lezione",
    badge: "bg-purple-100 text-purple-700",
    icon: "👨‍🏫",
  },
};

const SLOT_STYLES = {
  free: "bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-200",
  booking:
    "bg-red-100 text-red-700 border-red-200 cursor-pointer hover:brightness-95",
  blocked:
    "bg-red-100 text-red-700 border-red-200 cursor-pointer hover:brightness-95",
  academy:
    "bg-blue-100 text-blue-700 border-blue-200 cursor-pointer hover:brightness-95",
  lesson:
    "bg-purple-100 text-purple-700 border-purple-200 cursor-pointer hover:brightness-95",
};

const SLOT_ICONS = {
  free: "🟢",
  booking: "🔴",
  blocked: "🔒",
  academy: "🎓",
  lesson: "👨‍🏫",
};

const SLOT_STYLES_DESKTOP = {
  free: "bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-200",
  booking:
    "bg-red-100 text-red-700 border-red-200 cursor-pointer hover:brightness-95",
  blocked:
    "bg-red-100 text-red-700 border-red-200 cursor-pointer hover:brightness-95",
  academy:
    "bg-blue-100 text-blue-700 border-blue-200 cursor-pointer hover:brightness-95",
  lesson:
    "bg-purple-100 text-purple-700 border-purple-200 cursor-pointer hover:brightness-95",
  tournament:
    "bg-amber-200 text-amber-800 border-amber-400 cursor-not-allowed opacity-80",
};

const SLOT_LEGEND = [
  { type: "free", label: "Libero" },
  { type: "blocked", label: "Prenotato" },
  { type: "academy", label: "Academy" },
  { type: "lesson", label: "Lezione" },
];
const EVENT_STYLE = {
  booking: {
    bg: "bg-red-50",
    border: "border-red-100",
    icon: "🔴",
    label: "Prenotazione",
    text: "text-red-700",
  },
  blocked: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: "🔒",
    label: "Prenotato",
    text: "text-gray-600",
  },
  academy: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    icon: "🎓",
    label: "Academy",
    text: "text-blue-700",
  },
  lesson: {
    bg: "bg-purple-50",
    border: "border-purple-100",
    icon: "👨‍🏫",
    label: "Lezione",
    text: "text-purple-700",
  },
  tournament: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    icon: "🏆",
    label: "Torneo",
    text: "text-amber-700",
  },
};

function buildSlots(dateStr, courtEvts) {
  const slots = [];
  for (let h = 8; h <= 21.5; h += 1.5) {
    const hh = Math.floor(h);
    const mm = h % 1 === 0.5 ? 30 : 0;
    const slotStart = new Date(
      `${dateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
    );
    const slotEnd = new Date(slotStart.getTime() + 90 * 60000);
    const isPast = slotStart < new Date();
    const overlapping = courtEvts.find(
      (e) => new Date(e.start) < slotEnd && new Date(e.end) > slotStart,
    );
    let type = "free";
    if (overlapping) type = overlapping.extendedProps?.type || "booking";
    slots.push({
      time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      type,
      isPast,
      event: overlapping || null,
    });
  }
  return slots;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ stats: [], courtsStats: [] });
  const [courts, setCourts] = useState([]);
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [cancelledBookings, setCancelledBookings] = useState([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [slotDate, setSlotDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState("");
  const [slotStart, setSlotStart] = useState("19:00");
  const [blockStart, setBlockStart] = useState("19:00");
  const [blockEnd, setBlockEnd] = useState("20:30");
  const [blockPlayers, setBlockPlayers] = useState(["", "", "", ""]);
  const [sponsors, setSponsors] = useState([]);
  const [sponsorForm, setSponsorForm] = useState({
    name: "",
    logoUrl: "",
    linkUrl: "",
    order: 0,
  });

  const fetchSponsors = async () => {
    const res = await api.get("/api/sponsors");
    setSponsors(res.data);
  };

  const addSponsor = async () => {
    if (!sponsorForm.name || !sponsorForm.logoUrl)
      return alert("Nome e Logo obbligatori");
    await api.post("/api/sponsors", sponsorForm);
    setSponsorForm({ name: "", logoUrl: "", linkUrl: "", order: 0 });
    fetchSponsors();
  };

  const deleteSponsor = async (id) => {
    if (!window.confirm("Rimuovere sponsor?")) return;
    await api.delete(`/api/sponsors/${id}`);
    fetchSponsors();
  };

  useEffect(() => {
    fetchData();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, courtsRes, calendarRes, bookingsRes] = await Promise.all(
        [
          api.get("/api/admin/stats"),
          api.get("/api/courts"),
          api.get("/api/calendar"),
          api.get("/api/admin/bookings"),
        ],
      );
      setStats(statsRes.data);
      setCourts(
        [...courtsRes.data].sort((a, b) =>
          a.name.localeCompare(b.name, "it", { numeric: true }),
        ),
      );
      setBookings(bookingsRes.data);
      const colored = calendarRes.data.map((e) => ({
        ...e,
        backgroundColor:
          e.extendedProps?.type === "academy"
            ? "#3b82f6"
            : e.extendedProps?.type === "lesson"
              ? "#a855f7"
              : e.extendedProps?.type === "blocked"
                ? "#eab308"
                : e.extendedProps?.type === "tournament"
                  ? "#f59e0b"
                  : COURT_COLORS[e.courtName]?.bg || "#10b981",
        borderColor:
          e.extendedProps?.type === "academy"
            ? "#2563eb"
            : e.extendedProps?.type === "lesson"
              ? "#9333ea"
              : e.extendedProps?.type === "blocked"
                ? "#ca8a04"
                : e.extendedProps?.type === "tournament"
                  ? "#d97706"
                  : COURT_COLORS[e.courtName]?.border || "#059669",
      }));
      setEvents(colored);
    } catch (err) {
      if (err.response?.status === 403) alert("Richiede ruolo Admin");
    } finally {
      setLoading(false);
    }
    try {
      const cancelledRes = await api.get("/api/admin/bookings/cancelled");
      setCancelledBookings(cancelledRes.data);
    } catch {}
    fetchSponsors();
  };

  const handleStatusClick = (court, status) => {
    if (status === "available") {
      updateCourtStatus(court._id, status, "");
    } else {
      setNote("");
      setSlotDate(new Date().toISOString().slice(0, 10));
      setSlotStart("19:00");
      setBlockStart("19:00");
      setBlockEnd("20:30");
      setBlockPlayers(["", "", "", ""]);
      setModal({ court, status });
    }
  };

  const updateCourtStatus = async (courtId, status, blockedNote = "") => {
    try {
      await api.put(`/api/admin/courts/${courtId}`, { status, blockedNote });
      setModal(null);
      fetchData();
    } catch {
      alert("Errore aggiornamento campo");
    }
  };

  const saveBlockedSlot = async () => {
    const filteredPlayers = blockPlayers.filter((p) => p.trim());
    if (modal.status === "blocked" && filteredPlayers.length === 0) {
      alert("⚠️ Inserire almeno il nome del primo giocatore");
      return;
    }
    if (
      (modal.status === "academy" || modal.status === "lesson") &&
      !note.trim()
    ) {
      alert("⚠️ La nota è obbligatoria per Academy e Lezione");
      return;
    }
    try {
      let startTime, endTime;
      if (modal.status === "blocked") {
        startTime = `${slotDate}T${blockStart}:00+01:00`;
        endTime = `${slotDate}T${blockEnd}:00+01:00`;
        if (endTime <= startTime) {
          alert("L'ora di fine deve essere dopo l'ora di inizio");
          return;
        }
      } else {
        startTime = `${slotDate}T${slotStart}:00+01:00`;
        const endDate = new Date(
          new Date(startTime).getTime() +
            (modal.status === "academy" ? 90 : 60) * 60000,
        );
        endTime = endDate.toISOString();
      }
      const courtEvents = events.filter(
        (e) => e.extendedProps?.courtId === modal.court._id.toString(),
      );
      const overlaps = courtEvents.filter(
        (e) => new Date(e.start) < endTime && new Date(e.end) > startTime,
      );
      if (overlaps.length > 0) {
        const labels = {
          booking: "Prenotazione",
          academy: "Academy",
          lesson: "Lezione",
          blocked: "Blocco",
          tournament: "Torneo",
        };
        const detail = overlaps
          .map(
            (e) =>
              `• ${labels[e.extendedProps?.type] || "Evento"}: ${new Date(e.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} - ${new Date(e.end).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`,
          )
          .join("\n");
        alert(
          `⚠️ Sovrapposizione con eventi esistenti:\n${detail}\n\nModifica l'orario.`,
        );
        return;
      }
      await api.post("/api/blocked-slots", {
        court: modal.court._id,
        type: modal.status,
        startTime,
        endTime,
        note,
        players: filteredPlayers,
      });
      setModal(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.msg || "Errore salvataggio slot");
    }
  };

  const handleEventClick = async (info) => {
    const type = info.event.extendedProps?.type;
    if (type === "tournament") return;
    if (type === "academy" || type === "lesson" || type === "blocked") {
      const labels = {
        academy: "🎓 Academy",
        lesson: "👨‍🏫 Lezione",
        blocked: "🔒 Campo Bloccato",
      };
      if (
        window.confirm(
          `Rimuovere questo slot?\n${labels[type]}\n${info.event.start.toLocaleString("it-IT")}`,
        )
      ) {
        try {
          await api.delete(
            `/api/blocked-slots/${info.event.extendedProps?.blockedSlotId}`,
          );
          await fetchData();
        } catch (err) {
          alert(err.response?.data?.msg || "Errore rimozione slot");
        }
      }
    } else {
      setModal({ type: "booking", event: info.event });
    }
  };

  const handleSlotClick = (slot, court, dateStr) => {
    if (slot.isPast) return;
    if (slot.type === "tournament") return;
    if (slot.type === "free") {
      const end = new Date(`${dateStr}T${slot.time}:00`);
      end.setMinutes(end.getMinutes() + 90);
      setSlotDate(dateStr);
      setSlotStart(slot.time);
      setBlockStart(slot.time);
      setBlockEnd(
        `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      );
      setNote("");
      setBlockPlayers(["", "", "", ""]);
      setModal({ court, status: "blocked", mobileSlot: true });
    } else if (slot.event) {
      handleEventClick({
        event: {
          ...slot.event,
          id: slot.event.id,
          start: new Date(slot.event.start),
          end: new Date(slot.event.end),
          extendedProps: slot.event.extendedProps,
          title: slot.event.title,
        },
      });
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-400">
        <div className="text-xl text-emerald-600">Caricando dashboard...</div>
      </div>
    );

  const dayEvents = events.filter(
    (e) =>
      new Date(e.start).toLocaleDateString("sv-SE", {
        timeZone: "Europe/Rome",
      }) === slotDate,
  );

  const sortedCourts = [...courts].sort((a, b) =>
    a.name.localeCompare(b.name, "it", { numeric: true }),
  );

  // ── Riepilogo giornaliero da dayEvents (prenotazioni + slot admin) ──
  const dailySummaryByCourt = sortedCourts
    .map((court) => {
      const courtId = court._id?.toString();
      const evts = dayEvents
        .filter((e) => e.extendedProps?.courtId === courtId)
        .filter((e) => e.extendedProps?.type !== "tournament")
        .sort((a, b) => new Date(a.start) - new Date(b.start));
      return { court, evts };
    })
    .filter((g) => g.evts.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-300">
      <NavBar />
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-6 pb-12 pt-10">
        {/* ── HEADER + DATE PICKER ── */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center bg-blue-800 bg-clip-text text-transparent">
            ✏️ Dashboard Amministratore
            {slotDate && (
              <p className="text-sm text-black mt-1 px-1 capitalize font-normal">
                {new Date(slotDate + "T00:00:00").toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </h2>
          <div className="flex justify-center mb-4">
            <input
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-300 text-sm"
              style={{
                WebkitAppearance: "none",
                appearance: "none",
                maxWidth: "40%",
                boxSizing: "border-box",
                backgroundColor: "lightyellow",
                borderColor: "goldenrod",
              }}
            />
          </div>

          {isMobile ? (
            <div className="space-y-4">
              {/* ── Slot grid per campo ── */}
              {sortedCourts.map((court) => {
                const courtEvents = dayEvents.filter(
                  (e) => e.extendedProps?.courtId === court._id?.toString(),
                );
                const allSlots = buildSlots(slotDate, courtEvents);
                return (
                  <div
                    key={court._id}
                    className="bg-white/90 rounded-3xl shadow-lg overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-700 to-blue-950 flex items-center justify-between">
                      <span className="font-bold text-white text-base">
                        {court.name}
                      </span>
                      <span className="text-xs text-white/80 capitalize">
                        {new Date(slotDate + "T00:00:00").toLocaleDateString(
                          "it-IT",
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          },
                        )}
                      </span>
                    </div>
                    <div className="p-3 grid grid-cols-4 gap-1.5">
                      {allSlots.map((slot) => (
                        <div
                          key={slot.time}
                          onClick={() => handleSlotClick(slot, court, slotDate)}
                          className={`rounded-xl border px-1 py-1.5 text-center transition-all
                            ${slot.isPast ? "opacity-30" : ""}
                            ${SLOT_STYLES[slot.type]}
                            ${slot.type === "tournament" ? "cursor-not-allowed" : ""}
                          `}
                        >
                          <div className="text-xs font-bold leading-tight">
                            {slot.time}
                          </div>
                          <div className="text-[10px] mt-0.5">
                            {SLOT_ICONS[slot.type]}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                      {SLOT_LEGEND.map(({ type, label }) => (
                        <span
                          key={type}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SLOT_STYLES[type]}`}
                        >
                          {SLOT_ICONS[type]} {label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* ── Riepilogo eventi del giorno per campo (MOBILE) ── */}
              {dailySummaryByCourt.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">
                    📋 Riepilogo giornata
                  </h3>
                  {dailySummaryByCourt.map(({ court, evts }) => (
                    <div
                      key={court._id}
                      className="bg-white/90 rounded-3xl shadow-lg overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-gradient-to-r from-slate-600 to-slate-800 flex items-center justify-between">
                        <span className="font-bold text-white text-base">
                          {court.name}
                        </span>
                        <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full font-semibold">
                          {evts.length} event{evts.length === 1 ? "o" : "i"}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {evts.map((e) => {
                          const type = e.extendedProps?.type || "booking";
                          const style =
                            EVENT_STYLE[type] || EVENT_STYLE.booking;
                          const startT = new Date(e.start).toLocaleTimeString(
                            "it-IT",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Europe/Rome",
                            },
                          );
                          const endT = new Date(e.end).toLocaleTimeString(
                            "it-IT",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Europe/Rome",
                            },
                          );
                          // nomi giocatori (booking) o nota (admin slot)
                          const names = e.extendedProps?.playerNames || [];
                          const guests = e.extendedProps?.guestPlayers || [];
                          const player1 =
                            e.extendedProps?.player1Name ||
                            (type === "booking" ? e.title : null);
                          return (
                            <div
                              key={e.id}
                              className={`px-4 py-3 flex items-start gap-3 ${style.bg}`}
                            >
                              <div className="min-w-[58px] text-center pt-0.5">
                                <div className="text-xs font-bold text-gray-800">
                                  {startT}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {endT}
                                </div>
                                <div className="text-base mt-0.5">
                                  {style.icon}
                                </div>
                              </div>
                              <div className="flex-1 pt-0.5">
                                <div
                                  className={`text-xs font-bold mb-1 ${style.text}`}
                                >
                                  {style.label}
                                  {e.extendedProps?.note && (
                                    <span className="font-normal text-gray-500 ml-1">
                                      — {e.extendedProps.note}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {player1 && (
                                    <span className="text-xs bg-white/80 border text-gray-700 px-2 py-0.5 rounded-full font-medium">
                                      👤 {player1}
                                    </span>
                                  )}
                                  {names.map((n, i) => (
                                    <span
                                      key={i}
                                      className="text-xs bg-white/80 border text-gray-700 px-2 py-0.5 rounded-full font-medium"
                                    >
                                      👤 {n}
                                    </span>
                                  ))}
                                  {guests.map((n, i) => (
                                    <span
                                      key={i}
                                      className="text-xs bg-white/60 border text-gray-500 px-2 py-0.5 rounded-full font-medium"
                                    >
                                      👤 {n}
                                    </span>
                                  ))}
                                  {/* slot admin: mostra giocatori dal extendedProps se presenti */}
                                  {(e.extendedProps?.players || []).map(
                                    (n, i) => (
                                      <span
                                        key={i}
                                        className="text-xs bg-white/80 border text-gray-700 px-2 py-0.5 rounded-full font-medium"
                                      >
                                        👤 {n}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {dailySummaryByCourt.length === 0 && (
                <div className="bg-white/70 rounded-3xl p-5 text-center text-gray-400 text-sm">
                  Nessun evento programmato per questo giorno
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ── DESKTOP: timeline ── */}
              <CourtTimeline
                courts={sortedCourts}
                events={dayEvents}
                onEventClick={handleEventClick}
              />

              {/* ── DESKTOP: slot grid ── */}
              <div
                className={`mt-6 grid gap-4 ${
                  courts.filter((c) => c.status === "available").length === 1
                    ? "grid-cols-1 max-w-sm mx-auto"
                    : courts.filter((c) => c.status === "available").length ===
                        2
                      ? "grid-cols-2 max-w-2xl mx-auto"
                      : courts.filter((c) => c.status === "available")
                            .length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2 xl:grid-cols-4"
                }`}
              >
                {[...courts]
                  .filter((c) => c.status === "available")
                  .sort((a, b) =>
                    a.name.localeCompare(b.name, "it", { numeric: true }),
                  )
                  .map((court) => {
                    const courtEvts = dayEvents.filter(
                      (e) => e.extendedProps?.courtId === court._id?.toString(),
                    );
                    const allSlots = buildSlots(slotDate, courtEvts);
                    const freeCount = allSlots.filter(
                      (s) => !s.isPast && s.type === "free",
                    ).length;
                    return (
                      <div
                        key={court._id}
                        className="bg-white/90 rounded-3xl shadow-lg overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
                          <span className="font-bold text-white">
                            {court.name}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white font-semibold">
                            {freeCount} liberi
                          </span>
                        </div>
                        <div className="p-3 grid grid-cols-4 gap-1.5">
                          {allSlots.map((slot) => (
                            <div
                              key={slot.time}
                              onClick={() =>
                                handleSlotClick(slot, court, slotDate)
                              }
                              className={`rounded-xl border px-1 py-1.5 text-center transition-all duration-150
                                ${slot.isPast ? "opacity-25" : ""}
                                ${SLOT_STYLES_DESKTOP[slot.type]}
                              `}
                            >
                              <div className="text-xs font-bold leading-tight">
                                {slot.time}
                              </div>
                              <div className="text-[10px] mt-0.5">
                                {SLOT_ICONS[slot.type]}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                          {SLOT_LEGEND.map(({ type, label }) => (
                            <span
                              key={type}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SLOT_STYLES[type]}`}
                            >
                              {SLOT_ICONS[type]} {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex justify-center mt-4">
                <button
                  onClick={fetchData}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-semibold text-sm"
                >
                  🔄 Aggiorna
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── PRENOTAZIONI CANCELLATE
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 md:p-8 shadow-xl">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">
              🗑️ Prenotazioni Cancellate ({cancelledBookings.length})
            </h2>
            <button
              onClick={() => setShowCancelled((prev) => !prev)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-all"
            >
              {showCancelled ? "🙈 Nascondi" : "👁 Mostra"}
            </button>
          </div>
          {showCancelled &&
            (isMobile ? (
              <div className="space-y-3">
                {cancelledBookings.map((booking) => (
                  <div key={booking._id} className="bg-red-50 rounded-2xl p-4 border border-red-100 opacity-80">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold text-gray-700">{booking.player1?.name}</div>
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">Cancellata</span>
                    </div>
                    <div className="text-xs text-gray-400 mb-1">{booking.player1?.email}</div>
                    <div className="text-sm text-gray-600">🏸 {booking.court?.name}</div>
                    <div className="text-sm text-gray-600">
                      📅{" "}
                      {new Date(booking.startTime).toLocaleString("it-IT", {
                        weekday: "short", day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    {booking.cancelledAt && (
                      <div className="text-xs text-red-400 mt-1">
                        🗑 Cancellata il {new Date(booking.cancelledAt).toLocaleString("it-IT")}
                        {booking.cancelledBy?.name && ` da ${booking.cancelledBy.name}`}
                      </div>
                    )}
                  </div>
                ))}
                {cancelledBookings.length === 0 && (
                  <p className="text-center text-gray-400 py-8">Nessuna prenotazione cancellata</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-gradient-to-r from-red-400 to-rose-500 text-white">
                    <tr>
                      <th className="py-4 px-6 rounded-tl-2xl">Giocatore</th>
                      <th className="py-4 px-6">Campo</th>
                      <th className="py-4 px-6">Data prenotazione</th>
                      <th className="py-4 px-6">Durata</th>
                      <th className="py-4 px-6 rounded-tr-2xl">Cancellata il</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledBookings.map((booking, i) => (
                      <tr key={booking._id} className={`border-b border-gray-100 opacity-75 ${i % 2 === 0 ? "bg-red-50/50" : "bg-white"}`}>
                        <td className="py-4 px-6 font-bold text-gray-700">
                          {booking.player1?.name}
                          <div className="text-xs text-gray-400 font-normal">{booking.player1?.email}</div>
                        </td>
                        <td className="py-4 px-6 text-gray-600">{booking.court?.name}</td>
                        <td className="py-4 px-6 text-gray-600">{new Date(booking.startTime).toLocaleString("it-IT")}</td>
                        <td className="py-4 px-6 text-gray-600">{booking.duration || "—"}</td>
                        <td className="py-4 px-6">
                          <div className="text-red-500 text-sm font-semibold">
                            {booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString("it-IT") : "—"}
                          </div>
                          {booking.cancelledBy?.name && (
                            <div className="text-xs text-gray-400">da {booking.cancelledBy.name}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {cancelledBookings.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-gray-400 text-xl">
                          Nessuna prenotazione cancellata
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
        </div>── */}

        {/* ── GESTIONE SPONSOR ── (commentato)
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 md:p-8 shadow-xl">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-5">🏷️ Sponsor</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <input placeholder="Nome sponsor *" value={sponsorForm.name}
              onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
              className="p-3 border-2 border-gray-200 rounded-2xl text-sm" />
            <input placeholder="URL Logo (https://...) *" value={sponsorForm.logoUrl}
              onChange={(e) => setSponsorForm({ ...sponsorForm, logoUrl: e.target.value })}
              className="p-3 border-2 border-gray-200 rounded-2xl text-sm" />
            <input placeholder="URL sito sponsor" value={sponsorForm.linkUrl}
              onChange={(e) => setSponsorForm({ ...sponsorForm, linkUrl: e.target.value })}
              className="p-3 border-2 border-gray-200 rounded-2xl text-sm" />
            <button onClick={addSponsor} className="py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600">
              ➕ Aggiungi
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            {sponsors.map((s) => (
              <div key={s._id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 border">
                <img src={s.logoUrl} alt={s.name} className="h-8 object-contain" />
                <span className="font-semibold text-gray-700 text-sm">{s.name}</span>
                <button onClick={() => deleteSponsor(s._id)} className="text-red-400 hover:text-red-600 text-lg font-bold">✕</button>
              </div>
            ))}
            {sponsors.length === 0 && <p className="text-gray-400 text-sm">Nessuno sponsor aggiunto</p>}
          </div>
        </div>
        ── fine blocco GESTIONE SPONSOR commentato) */}
      </div>
      <SponsorFooter />

      {/* ── MODAL ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-md w-full overflow-y-auto max-h-[90vh]">
            {/* BOOKING */}
            {modal.type === "booking" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">
                    🎾 Prenotazione
                  </h3>
                  <button
                    onClick={() => setModal(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm w-20">
                      👤 Giocatore
                    </span>
                    <span className="font-bold text-gray-800">
                      {modal.event.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm w-20">📅 Data</span>
                    <span className="font-semibold text-gray-700">
                      {modal.event.start.toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm w-20">
                      ⏰ Orario
                    </span>
                    <span className="font-semibold text-gray-700">
                      {modal.event.start.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" → "}
                      {modal.event.end?.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {modal.event.extendedProps?.playerNames?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-gray-500 text-sm mb-1">
                        👥 Altri giocatori
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {modal.event.extendedProps.playerNames.map(
                          (name, i) => (
                            <span
                              key={i}
                              className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold"
                            >
                              👤 {name}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {modal.event.extendedProps?.guestPlayers?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-gray-500 text-sm mb-1">
                        👥 Ospiti
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {modal.event.extendedProps.guestPlayers.map(
                          (name, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold"
                            >
                              👤 {name}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
                  >
                    Chiudi
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Cancellare la prenotazione di ${modal.event.title}?`,
                        )
                      )
                        return;
                      try {
                        await api.patch(
                          `/api/bookings/${modal.event.id}/cancel`,
                        );
                        setModal(null);
                        fetchData();
                      } catch (err) {
                        alert(
                          err.response?.data?.msg || "Errore cancellazione",
                        );
                      }
                    }}
                    className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600"
                  >
                    🗑 Cancella
                  </button>
                </div>
              </>
            )}

            {/* SLOT: blocked / academy / lesson */}
            {modal.type !== "booking" && (
              <>
                <h3 className="text-xl md:text-2xl font-bold mb-1 text-gray-800">
                  {STATUS_CONFIG[modal.status].icon}{" "}
                  {STATUS_CONFIG[modal.status].label}
                </h3>
                <p className="text-gray-500 mb-5 text-sm md:text-base">
                  Campo: <strong>{modal.court.name}</strong>
                </p>

                {modal.mobileSlot && (
                  <div className="flex gap-2 mb-5">
                    {["blocked", "academy", "lesson"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setModal({ ...modal, status: s })}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          modal.status === s
                            ? s === "blocked"
                              ? "bg-red-500 text-white"
                              : s === "academy"
                                ? "bg-blue-500 text-white"
                                : "bg-purple-500 text-white"
                            : s === "blocked"
                              ? "bg-red-100 text-red-700"
                              : s === "academy"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {STATUS_CONFIG[s].icon}
                        <br />
                        {STATUS_CONFIG[s].label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Giocatori: solo per blocked */}
                {modal.status === "blocked" && (
                  <div className="mb-5">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      👤 Giocatori <span className="text-red-500">*</span>
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        (almeno 1 obbligatorio)
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {blockPlayers.map((p, i) => (
                        <input
                          key={i}
                          type="text"
                          placeholder={
                            i === 0 ? "Giocatore 1 *" : `Giocatore ${i + 1}`
                          }
                          value={p}
                          onChange={(e) => {
                            const updated = [...blockPlayers];
                            updated[i] = e.target.value;
                            setBlockPlayers(updated);
                          }}
                          className={`w-full p-2.5 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 ${
                            i === 0 && !blockPlayers[0].trim()
                              ? "border-red-300 focus:ring-red-300"
                              : "border-gray-200 focus:ring-emerald-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {modal.status === "blocked" && (
                  <>
                    <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm font-bold text-center mb-4">
                      🔒 Il campo sarà non prenotabile per l'intervallo scelto
                    </div>
                    <div className="space-y-4 mb-5">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          📅 Data
                        </label>
                        <input
                          type="date"
                          value={slotDate}
                          onChange={(e) => setSlotDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                          className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-300 text-sm"
                          style={{
                            WebkitAppearance: "none",
                            appearance: "none",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">
                            ⏰ Dalle
                          </label>
                          <input
                            type="time"
                            value={blockStart}
                            onChange={(e) => setBlockStart(e.target.value)}
                            step="1800"
                            className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-300 text-sm"
                            style={{
                              WebkitAppearance: "none",
                              appearance: "none",
                              maxWidth: "100%",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">
                            ⏰ Alle
                          </label>
                          <input
                            type="time"
                            value={blockEnd}
                            onChange={(e) => setBlockEnd(e.target.value)}
                            step="1800"
                            className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-300 text-base"
                            style={{
                              WebkitAppearance: "none",
                              appearance: "none",
                              maxWidth: "100%",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      </div>
                      {blockStart && blockEnd && blockEnd > blockStart && (
                        <div className="bg-gray-50 rounded-xl px-4 py-2 text-sm text-gray-600 text-center">
                          ⏱ Durata blocco:{" "}
                          <strong>
                            {(() => {
                              const [hs, ms] = blockStart
                                .split(":")
                                .map(Number);
                              const [he, me] = blockEnd.split(":").map(Number);
                              const mins = he * 60 + me - (hs * 60 + ms);
                              return mins >= 60
                                ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`
                                : `${mins}min`;
                            })()}
                          </strong>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setModal(null)}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={saveBlockedSlot}
                        className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600"
                      >
                        🔒 Blocca Campo
                      </button>
                    </div>
                  </>
                )}

                {(modal.status === "academy" || modal.status === "lesson") && (
                  <>
                    <div
                      className={`px-4 py-2 rounded-xl text-sm font-bold text-center mb-4 ${modal.status === "academy" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}
                    >
                      {modal.status === "academy"
                        ? "🎓 Durata fissa: 1h 30min"
                        : "👨‍🏫 Durata fissa: 1h"}
                    </div>
                    <div className="space-y-4 mb-5">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          📅 Data
                        </label>
                        <input
                          type="date"
                          value={slotDate}
                          onChange={(e) => setSlotDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                          className="w-full p-3 md:p-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-300 text-base"
                          style={{
                            WebkitAppearance: "none",
                            appearance: "none",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          ⏰ Orario inizio
                        </label>
                        <input
                          type="time"
                          value={slotStart}
                          onChange={(e) => setSlotStart(e.target.value)}
                          step="1800"
                          className="w-full p-3 md:p-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-300 text-base"
                          style={{
                            WebkitAppearance: "none",
                            appearance: "none",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                        {slotStart && (
                          <p className="text-sm text-gray-500 mt-2 px-1">
                            ⏱ Fine prevista:{" "}
                            <strong>
                              {(() => {
                                const [h, m] = slotStart.split(":").map(Number);
                                const end = new Date(
                                  0,
                                  0,
                                  0,
                                  h,
                                  m + (modal.status === "academy" ? 90 : 60),
                                );
                                return end.toTimeString().slice(0, 5);
                              })()}
                            </strong>
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          📝 Nota <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder={
                            modal.status === "academy"
                              ? "es. Corso Principianti"
                              : "es. Lezione Mario Rossi"
                          }
                          className={`w-full p-3 md:p-4 border-2 rounded-2xl focus:ring-2 text-base ${
                            !note.trim()
                              ? "border-red-300 focus:ring-red-300"
                              : "border-gray-200 focus:ring-blue-300"
                          }`}
                        />
                        {!note.trim() && (
                          <p className="text-xs text-red-400 mt-1 px-1">
                            La nota è obbligatoria
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setModal(null)}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={saveBlockedSlot}
                        className={`flex-1 py-3 text-white rounded-2xl font-bold ${modal.status === "academy" ? "bg-blue-500 hover:bg-blue-600" : "bg-purple-500 hover:bg-purple-600"}`}
                      >
                        Blocca Slot
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
