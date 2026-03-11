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
  blocked: { label: "Prenota", badge: "bg-red-100 text-red-700", icon: "🔒" },
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
    label: "Prenotazione",
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

function getDateFromOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ── Helper: converte sempre in Date e formatta orario ──
const toTime = (d) =>
  new Date(d).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });

const ConfirmModal = ({ data, onClose }) => {
  if (!data) return null;
  const colors = {
    red: {
      bg: "bg-red-50",
      border: "border-red-200",
      btn: "bg-red-500 hover:bg-red-600",
      icon: "text-red-400",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      btn: "bg-blue-500 hover:bg-blue-600",
      icon: "text-blue-400",
    },
    purple: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      btn: "bg-purple-500 hover:bg-purple-600",
      icon: "text-purple-400",
    },
    gray: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      btn: "bg-gray-600 hover:bg-gray-700",
      icon: "text-gray-400",
    },
  };
  const c = colors[data.color] || colors.red;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div
          className={`${c.bg} ${c.border} border-b px-6 pt-6 pb-4 text-center`}
        >
          <div className="text-5xl mb-2">{data.icon}</div>
          <h3 className="text-lg font-black text-gray-800">{data.title}</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            {data.message}
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 text-sm transition-all"
          >
            Annulla
          </button>
          <button
            onClick={() => {
              data.onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-white rounded-2xl font-bold text-sm transition-all ${c.btn}`}
          >
            {data.confirmLabel || "Conferma"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DatePickerPill = ({ value }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl w-fit">
    <span className="text-sm">📅</span>
    <span className="text-xs font-semibold text-blue-800 capitalize">
      {new Date(value + "T00:00:00").toLocaleDateString("it-IT", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
    </span>
  </div>
);

const TIME_SLOTS = [];
for (let h = 7; h <= 21; h++) {
  for (const m of [0, 30]) {
    if (h === 7 && m === 0) continue;
    TIME_SLOTS.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
  }
}
TIME_SLOTS.push("22:00");

function buildSlots(dateStr, courtEvts) {
  const slots = [];
  for (let h = 8; h < 22; h += 0.5) {
    const hh = Math.floor(h);
    const mm = h % 1 !== 0 ? 30 : 0;
    const slotStart = new Date(
      `${dateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
    );
    const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
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
  const [confirmModal, setConfirmModal] = useState(null);
  const [editingPlayers, setEditingPlayers] = useState(false);
  const [editPlayers, setEditPlayers] = useState([]);
  const [editGuests, setEditGuests] = useState([]);
  const [dayOffset, setDayOffset] = useState(0);
  const slotDate = getDateFromOffset(dayOffset);
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
  const [modalDate, setModalDate] = useState(slotDate);

  const closeModal = () => {
    setModal(null);
    setEditingPlayers(false);
  };

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
      closeModal();
      fetchData();
    } catch {
      alert("Errore aggiornamento campo");
    }
  };

  const saveBlockedSlot = async () => {
    const filteredPlayers = blockPlayers.filter((p) => p.trim());
    if (modal.status === "blocked") {
      if (filteredPlayers.length === 0) {
        alert("⚠️ Inserire almeno il nome del primo giocatore");
        return;
      }
    } else if (modal.status === "academy" || modal.status === "lesson") {
      if (!note.trim()) {
        alert("⚠️ La nota è obbligatoria per Academy e Lezione");
        return;
      }
    }
    try {
      let startTime, endTime;
      if (modal.status === "blocked") {
        startTime = `${modalDate}T${blockStart}:00+01:00`;
        endTime = `${modalDate}T${blockEnd}:00+01:00`;
        if (endTime <= startTime) {
          alert("L'ora di fine deve essere dopo l'ora di inizio");
          return;
        }
      } else {
        startTime = `${modalDate}T${slotStart}:00+01:00`;
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
        (e) =>
          new Date(e.start) < new Date(endTime) &&
          new Date(e.end) > new Date(startTime),
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
              `• ${labels[e.extendedProps?.type] || "Evento"}: ${toTime(e.start)} - ${toTime(e.end)}`,
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
      closeModal();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.msg || "Errore salvataggio slot");
    }
  };

  const handleEventClick = async (info) => {
    const type = info.event.extendedProps?.type;
    if (type === "tournament") return;

    // blocked CON giocatori → apri modal dettaglio/modifica
    if (type === "blocked" && info.event.extendedProps?.players?.length > 0) {
      setModal({
        type: "booking",
        event: {
          ...info.event,
          start: new Date(info.event.start),
          end: new Date(info.event.end),
        },
      });
      return;
    }

    if (type === "academy" || type === "lesson" || type === "blocked") {
      const labels = {
        academy: "Academy",
        lesson: "Lezione",
        blocked: "Campo Bloccato",
      };
      const colors = { academy: "blue", lesson: "purple", blocked: "gray" };
      const icons = { academy: "🎓", lesson: "🏫", blocked: "🔒" };
      setConfirmModal({
        title: `Rimuovere ${labels[type]}?`,
        message: `${new Date(info.event.start).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })} · ${toTime(info.event.start)} → ${toTime(info.event.end)}`,
        icon: icons[type],
        color: colors[type],
        confirmLabel: "Rimuovi",
        onConfirm: async () => {
          try {
            await api.delete(
              `/api/blocked-slots/${info.event.extendedProps?.blockedSlotId}`,
            );
            await fetchData();
          } catch (err) {
            alert(err.response?.data?.msg || "Errore rimozione slot");
          }
        },
      });
    } else {
      setModal({
        type: "booking",
        event: {
          ...info.event,
          start: new Date(info.event.start),
          end: new Date(info.event.end),
        },
      });
    }
  };

  const handleSlotClick = (slot, court, dateStr) => {
    if (slot.isPast) return;
    if (slot.type === "tournament") return;
    if (slot.type === "free") {
      const end = new Date(`${dateStr}T${slot.time}:00`);
      end.setMinutes(end.getMinutes() + 90);
      setModalDate(dateStr);
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

  const saveEditedPlayers = async () => {
    try {
      const isBlocked = modal.event.extendedProps?.type === "blocked";
      const players = editPlayers.filter((p) => p.trim());
      if (isBlocked) {
        await api.patch(
          `/api/blocked-slots/${modal.event.extendedProps.blockedSlotId}/players`,
          { players },
        );
      } else {
        await api.patch(`/api/bookings/${modal.event.id}/players`, {
          playerNames: players,
        });
      }
      setEditingPlayers(false);
      closeModal();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.msg || "Errore salvataggio giocatori");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-400">
        <div className="text-xl text-blue-950">
          Caricamento DASHBOARD in corso 🕓
        </div>
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

  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      offset: i,
      dateStr: d.toISOString().slice(0, 10),
      dayNum: d.getDate(),
      month: d.toLocaleDateString("it-IT", { month: "short" }),
    };
  });

  const CourtCard = ({ court, isOutdoor = false }) => {
    const courtEvts = dayEvents.filter(
      (e) => e.extendedProps?.courtId === court._id?.toString(),
    );
    const allSlots = buildSlots(slotDate, courtEvts);
    const headerClass = isOutdoor
      ? "bg-gradient-to-r from-orange-400 to-orange-600"
      : "bg-gradient-to-r from-blue-600 to-indigo-600";
    return (
      <div className="bg-white/90 rounded-3xl shadow-lg overflow-hidden">
        <div
          className={`px-4 py-3 ${headerClass} flex items-center justify-between`}
        >
          <span className="font-bold text-white">
            {isOutdoor ? "🌤 " : "🏠 "}
            {court.name}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white font-semibold capitalize">
            {new Date(slotDate + "T00:00:00").toLocaleDateString("it-IT", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <div className="p-3 grid grid-cols-4 gap-1.5">
          {allSlots.map((slot) => (
            <div
              key={slot.time}
              onClick={() => handleSlotClick(slot, court, slotDate)}
              className={`rounded-xl border px-1 py-1.5 text-center transition-all duration-150 ${slot.isPast ? "opacity-25" : ""} ${SLOT_STYLES_DESKTOP[slot.type]}`}
            >
              <div className="text-xs font-bold leading-tight">{slot.time}</div>
              <div className="text-[10px] mt-0.5">{SLOT_ICONS[slot.type]}</div>
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
  };

  const indoorCourts = [...courts]
    .filter((c) => c.status === "available" && c.type !== "outdoor")
    .sort((a, b) => a.name.localeCompare(b.name, "it", { numeric: true }));
  const outdoorCourts = [...courts]
    .filter((c) => c.status === "available" && c.type === "outdoor")
    .sort((a, b) => a.name.localeCompare(b.name, "it", { numeric: true }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-300">
      <NavBar />
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-6 pb-12 pt-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center bg-blue-800 bg-clip-text text-transparent">
            ✏️ Pannello Amministratore
          </h2>

          {/* SLIDER GIORNI */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-md px-4 py-4 mb-6">
            <div className="text-center mb-3">
              <p className="text-lg font-black text-blue-900 capitalize">
                {new Date(slotDate + "T00:00:00").toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
              {days.map(({ offset, dateStr, dayNum, month }) => {
                const isSelected = offset === dayOffset;
                const d = new Date(dateStr + "T00:00:00");
                const weekday = d.toLocaleDateString("it-IT", {
                  weekday: "short",
                });
                return (
                  <button
                    key={offset}
                    onClick={() => setDayOffset(offset)}
                    className={`flex-shrink-0 snap-start flex flex-col items-center px-3 py-2 rounded-2xl border-2 transition-all font-bold min-w-[52px] ${isSelected ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-105" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"}`}
                  >
                    <span
                      className={`text-[10px] uppercase tracking-wide ${isSelected ? "text-blue-200" : "text-gray-400"}`}
                    >
                      {weekday}
                    </span>
                    <span className="text-base leading-tight">{dayNum}</span>
                    <span
                      className={`text-[10px] ${isSelected ? "text-blue-200" : "text-gray-400"}`}
                    >
                      {month}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MOBILE */}
          {isMobile ? (
            <div className="space-y-4">
              {sortedCourts.map((court) => {
                const courtEvents = dayEvents.filter(
                  (e) => e.extendedProps?.courtId === court._id?.toString(),
                );
                const allSlots = buildSlots(slotDate, courtEvents);
                const isOutdoor = court.type === "outdoor";
                return (
                  <div
                    key={court._id}
                    className="bg-white/90 rounded-3xl shadow-lg overflow-hidden"
                  >
                    <div
                      className={`px-4 py-3 bg-gradient-to-r ${isOutdoor ? "from-orange-400 to-orange-600" : "from-blue-700 to-blue-950"} flex items-center justify-between`}
                    >
                      <span className="font-bold text-white text-base">
                        {isOutdoor ? "🌤 " : "🏠 "}
                        {court.name}
                      </span>
                    </div>
                    <div className="p-3 grid grid-cols-4 gap-1.5">
                      {allSlots.map((slot) => (
                        <div
                          key={slot.time}
                          onClick={() => handleSlotClick(slot, court, slotDate)}
                          className={`rounded-xl border px-1 py-1.5 text-center transition-all ${slot.isPast ? "opacity-30" : ""} ${SLOT_STYLES[slot.type]} ${slot.type === "tournament" ? "cursor-not-allowed" : ""}`}
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

              {/* Riepilogo giornaliero mobile */}
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
                          {evts.length} prenotazion
                          {evts.length === 1 ? "e" : "i"}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {evts.map((e) => {
                          const type = e.extendedProps?.type || "booking";
                          const style =
                            EVENT_STYLE[type] || EVENT_STYLE.booking;
                          const startT = toTime(e.start);
                          const endT = toTime(e.end);
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
                              <button
                                onClick={() => {
                                  const type =
                                    e.extendedProps?.type || "booking";
                                  const currentPlayers =
                                    e.extendedProps?.playerNames ||
                                    e.extendedProps?.players ||
                                    [];
                                  setEditPlayers(
                                    [...currentPlayers, "", "", ""].slice(0, 4),
                                  );
                                  setEditingPlayers(true);
                                  setModal({
                                    type: "booking",
                                    event: {
                                      ...e,
                                      start: new Date(e.start),
                                      end: new Date(e.end),
                                    },
                                  });
                                }}
                                className="ml-1 mt-0.5 flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-800 transition-all text-xs font-bold"
                              >
                                +
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    title:
                                      type === "booking"
                                        ? "Cancellare prenotazione?"
                                        : `Rimuovere ${style.label}?`,
                                    message: `${court.name} · ${new Date(e.start).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })} · ${startT} → ${endT}${e.extendedProps?.note ? ` — ${e.extendedProps.note}` : ""}`,
                                    icon:
                                      type === "booking"
                                        ? "🗑️"
                                        : type === "academy"
                                          ? "🎓"
                                          : type === "lesson"
                                            ? "👨‍🏫"
                                            : "🔒",
                                    color:
                                      type === "booking"
                                        ? "red"
                                        : type === "academy"
                                          ? "blue"
                                          : type === "lesson"
                                            ? "purple"
                                            : "gray",
                                    confirmLabel:
                                      type === "booking"
                                        ? "Cancella"
                                        : "Rimuovi",
                                    onConfirm: async () => {
                                      try {
                                        if (type === "booking")
                                          await api.patch(
                                            `/api/bookings/${e.id}/cancel`,
                                          );
                                        else
                                          await api.delete(
                                            `/api/blocked-slots/${e.extendedProps?.blockedSlotId}`,
                                          );
                                        fetchData();
                                      } catch (err) {
                                        alert(
                                          err.response?.data?.msg ||
                                            "Errore rimozione",
                                        );
                                      }
                                    },
                                  })
                                }
                                className="ml-1 mt-0.5 flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 hover:bg-red-200 text-red-500 hover:text-red-700 transition-all text-xs font-bold"
                              >
                                Elimina 🗑️
                              </button>
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
                  Nessuna prenotazione per questo giorno
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-700 font-medium mb-3">
                <span className="text-base">💡</span>
                <span>
                  Clicca su un evento nella timeline per cancellare una
                  prenotazione o rimuovere uno slot.
                </span>
              </div>

              <CourtTimeline
                courts={sortedCourts}
                events={dayEvents}
                onEventClick={handleEventClick}
              />

              {indoorCourts.length > 0 && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">
                      🏠 Campi Indoor
                    </span>
                    <div className="flex-1 h-px bg-blue-400"></div>
                  </div>
                  <div
                    className={`grid gap-4 ${
                      indoorCourts.length === 1
                        ? "grid-cols-1 max-w-sm mx-auto"
                        : indoorCourts.length === 2
                          ? "grid-cols-2 max-w-3xl mx-auto"
                          : indoorCourts.length === 3
                            ? "grid-cols-3"
                            : indoorCourts.length === 4
                              ? "grid-cols-4"
                              : "grid-cols-2 xl:grid-cols-4"
                    }`}
                  >
                    {indoorCourts.map((court) => (
                      <CourtCard
                        key={court._id}
                        court={court}
                        isOutdoor={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {outdoorCourts.length > 0 && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">
                      🌤 Campi Esterni
                    </span>
                    <div className="flex-1 h-px bg-orange-400"></div>
                  </div>
                  <div
                    className={`grid gap-4 ${
                      outdoorCourts.length === 1
                        ? "grid-cols-1 max-w-sm mx-auto"
                        : outdoorCourts.length === 2
                          ? "grid-cols-2 max-w-3xl mx-auto"
                          : "grid-cols-3"
                    }`}
                  >
                    {outdoorCourts.map((court) => (
                      <CourtCard
                        key={court._id}
                        court={court}
                        isOutdoor={true}
                      />
                    ))}
                  </div>
                </div>
              )}

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
      </div>

      <SponsorFooter />

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-md w-full overflow-y-auto max-h-[90vh]">
            {/* BOOKING / BLOCKED con giocatori */}
            {modal.type === "booking" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">
                    🎾 Prenotazione
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm w-20">
                      👤 Giocatore
                    </span>
                    <span className="font-bold text-gray-800">
                      {modal.event.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm w-20">
                      ⏰ Orario
                    </span>
                    <span className="font-semibold text-gray-700">
                      {toTime(modal.event.start)} {" → "}{" "}
                      {toTime(modal.event.end)}
                    </span>
                  </div>
                  {(modal.event.extendedProps?.playerNames?.length > 0 ||
                    modal.event.extendedProps?.guestPlayers?.length > 0 ||
                    modal.event.extendedProps?.players?.length > 0) && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-gray-500 text-xs mb-1">
                        👥 Giocatori
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(modal.event.extendedProps?.playerNames || []).map(
                          (name, i) => (
                            <span
                              key={i}
                              className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold"
                            >
                              👤 {name}
                            </span>
                          ),
                        )}
                        {(modal.event.extendedProps?.guestPlayers || []).map(
                          (name, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold"
                            >
                              👤 {name}
                            </span>
                          ),
                        )}
                        {(modal.event.extendedProps?.players || []).map(
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
                </div>

                {!editingPlayers ? (
                  <button
                    onClick={() => {
                      const currentPlayers =
                        modal.event.extendedProps?.playerNames ||
                        modal.event.extendedProps?.players ||
                        [];
                      const currentGuests =
                        modal.event.extendedProps?.guestPlayers || [];
                      setEditPlayers(
                        [...currentPlayers, "", "", ""].slice(0, 4),
                      );
                      setEditGuests([...currentGuests, "", ""].slice(0, 2));
                      setEditingPlayers(true);
                    }}
                    className="w-full mb-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-2xl font-semibold text-sm hover:bg-blue-100 transition-all"
                  >
                    ✏️ Modifica giocatori
                  </button>
                ) : (
                  <div className="mb-4 space-y-2 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      👥 Giocatori (max 4)
                    </p>
                    {editPlayers.map((p, i) => (
                      <input
                        key={i}
                        type="text"
                        value={p}
                        onChange={(e) => {
                          const u = [...editPlayers];
                          u[i] = e.target.value;
                          setEditPlayers(u);
                        }}
                        placeholder={`Giocatore ${i + 1}`}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                      />
                    ))}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          const currentPlayers =
                            modal.event.extendedProps?.playerNames ||
                            modal.event.extendedProps?.players ||
                            [];
                          setEditPlayers(
                            [...currentPlayers, "", "", ""].slice(0, 4),
                          );
                          setEditingPlayers(true);
                        }}
                        className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={saveEditedPlayers}
                        className="flex-1 py-2 bg-blue-500 text-white rounded-2xl font-bold text-sm hover:bg-blue-600"
                      >
                        💾 Salva
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
                  >
                    Chiudi
                  </button>
                  <button
                    onClick={() => {
                      const isBlocked =
                        modal.event.extendedProps?.type === "blocked";
                      setConfirmModal({
                        title: isBlocked
                          ? "Rimuovere slot?"
                          : "Cancellare prenotazione?",
                        message: `${modal.event.title} · ${new Date(modal.event.start).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })} · ${toTime(modal.event.start)} → ${toTime(modal.event.end)}`,
                        icon: "🗑️",
                        color: "red",
                        confirmLabel: isBlocked ? "Rimuovi" : "Cancella",
                        onConfirm: async () => {
                          try {
                            if (isBlocked)
                              await api.delete(
                                `/api/blocked-slots/${modal.event.extendedProps?.blockedSlotId}`,
                              );
                            else
                              await api.patch(
                                `/api/bookings/${modal.event.id}/cancel`,
                              );
                            closeModal();
                            fetchData();
                          } catch (err) {
                            alert(err.response?.data?.msg || "Errore");
                          }
                        },
                      });
                    }}
                    className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600"
                  >
                    🗑️{" "}
                    {modal.event.extendedProps?.type === "blocked"
                      ? "Rimuovi"
                      : "Cancella"}
                  </button>
                </div>
              </>
            )}

            {/* SLOT: blocked / academy / lesson */}
            {modal.type !== "booking" && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">
                    {STATUS_CONFIG[modal.status]?.icon}{" "}
                    {STATUS_CONFIG[modal.status]?.label}
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-500 mb-5 text-sm md:text-base">
                  Campo: <strong>{modal.court?.name}</strong>
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

                {modal.status === "blocked" && (
                  <>
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
                            className={`w-full p-2.5 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 ${i === 0 && !blockPlayers[0].trim() ? "border-red-300 focus:ring-red-300" : "border-gray-200 focus:ring-emerald-300"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mb-3">
                      <span className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Data
                      </span>
                      <DatePickerPill value={modalDate} />
                    </div>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                          Dalle
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-xl">
                          <span className="text-sm">🕐</span>
                          <span className="text-xs font-bold text-gray-800">
                            {blockStart}
                          </span>
                        </div>
                      </div>
                      <span className="text-gray-400 text-lg mt-4">→</span>
                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                          Alle
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-xl">
                          <span className="text-sm">🕑</span>
                          <span className="text-xs font-bold text-gray-800">
                            {blockEnd}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={closeModal}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={saveBlockedSlot}
                        className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600"
                      >
                        🔒 Prenota
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
                    <div className="mb-3">
                      <span className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Data
                      </span>
                      <DatePickerPill value={modalDate} />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Orario inizio
                      </label>
                      <select
                        value={slotStart}
                        onChange={(e) => setSlotStart(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-300 text-sm bg-white appearance-none"
                      >
                        {TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-500 mt-2 px-1">
                        Fine prevista:{" "}
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
                    </div>
                    <div className="mb-5">
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
                        className={`w-full p-3 md:p-4 border-2 rounded-2xl focus:ring-2 text-base ${!note.trim() ? "border-red-300 focus:ring-red-300" : "border-gray-200 focus:ring-blue-300"}`}
                      />
                      {!note.trim() && (
                        <p className="text-xs text-red-400 mt-1 px-1">
                          La nota è obbligatoria
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={closeModal}
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
      <ConfirmModal data={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
}
