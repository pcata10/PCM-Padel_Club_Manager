import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import axios from "axios";
import CourtTimelineDashboard from "../components/CourtTimelineDashboard.jsx";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const SLOT_STYLES = {
  free: "bg-emerald-100 text-emerald-700 border-emerald-200",
  booking: "bg-red-100 text-red-700 border-red-200",
  blocked: "bg-yellow-100 text-yellow-700 border-yellow-200",
  academy: "bg-blue-100 text-blue-700 border-blue-200",
  lesson: "bg-purple-100 text-purple-700 border-purple-200",
};
const SLOT_ICONS = {
  free: "🟢",
  booking: "🔴",
  blocked: "🔒",
  academy: "🎓",
  lesson: "👨‍🏫",
};

export default function Dashboard() {
  const [courts, setCourts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = async () => {
    try {
      const [courtsRes, bookingsRes, calRes] = await Promise.all([
        api.get("/api/courts"),
        api.get("/api/bookings"),
        api.get("/api/calendar"),
      ]);
      setCourts(courtsRes.data);
      setBookings(bookingsRes.data);
      setCalendarEvents(calRes.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm("Sei sicuro di voler cancellare?")) return;
    try {
      await api.patch(`/api/bookings/${bookingId}/cancel`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.msg || "Errore cancellazione");
    }
  };

  const generateSlots = (courtId) => {
    const slots = [];
    for (let h = 8; h <= 21.5; h += 1.5) {
      const hh = Math.floor(h);
      const mm = h % 1 === 0.5 ? 30 : 0;
      const slotStart = new Date(
        `${selectedDate}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
      );
      const slotEnd = new Date(slotStart.getTime() + 90 * 60000);
      const isPast = slotStart < new Date();
      const overlapping = calendarEvents.find(
        (e) =>
          e.extendedProps?.courtId === courtId.toString() &&
          new Date(e.start) < slotEnd &&
          new Date(e.end) > slotStart,
      );
      let type = "free";
      if (overlapping) type = overlapping.extendedProps?.type || "booking";
      slots.push({
        time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        type,
        isPast,
      });
    }
    return slots;
  };

  const activeBookings = bookings.filter(
    (b) => new Date(b.startTime) > new Date(),
  );
  const eventsForDate = calendarEvents.filter(
    (e) => new Date(e.start).toISOString().slice(0, 10) === selectedDate,
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-xl text-emerald-600">Caricando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <NavBar />
      <div className="pt-20 px-4 md:px-8 max-w-6xl mx-auto space-y-8 pb-12">
        {/* ── HEADER ── */}
        <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
          Dashboard Padel
        </h1>

        {/* ── LE TUE PRENOTAZIONI ── */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 md:p-8 shadow-2xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">
            📋 Le tue prenotazioni
          </h2>

          {isMobile ? (
            <div className="space-y-3">
              {activeBookings.slice(0, 10).map((booking) => (
                <div
                  key={booking._id}
                  className="bg-gray-50 rounded-2xl p-4 border border-gray-100"
                >
                  <div className="font-bold text-gray-800 text-base mb-1">
                    {booking.court?.name}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    📅{" "}
                    {new Date(booking.startTime).toLocaleString("it-IT", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  {/* Partecipanti già presenti */}
                  {(booking.players?.length > 0 ||
                    booking.guestPlayers?.length > 0) && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {booking.players?.map((p, i) => (
                        <span
                          key={i}
                          className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold"
                        >
                          👤 {p?.name || p}
                        </span>
                      ))}
                      {booking.guestPlayers?.map((p, i) => (
                        <span
                          key={i}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold"
                        >
                          👤 {p}
                        </span>
                      ))}
                    </div>
                  )}

                  <AddPlayersInline bookingId={booking._id} />
                  <button
                    onClick={() => cancelBooking(booking._id)}
                    className="w-full mt-2 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 font-semibold text-sm transition-all"
                  >
                    🗑 Cancella prenotazione
                  </button>
                </div>
              ))}
              {activeBookings.length === 0 && (
                <div className="py-10 text-center text-gray-500">
                  Nessuna prenotazione —{" "}
                  <Link
                    to="/book"
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    Prenota ora!
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl">
              <table className="w-full text-left">
                <thead className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                  <tr>
                    <th className="py-4 px-6 rounded-tl-2xl">Campo</th>
                    <th className="py-4 px-6">Data/Ora</th>
                    <th className="py-4 px-6 rounded-tr-2xl">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBookings.slice(0, 10).map((booking) => (
                    <tr
                      key={booking._id}
                      className="border-b border-gray-200 hover:bg-emerald-50 transition-colors"
                    >
                      <td className="py-4 px-6 font-bold">
                        {booking.court?.name}
                      </td>
                      <td className="py-4 px-6">
                        {new Date(booking.startTime).toLocaleString("it-IT")}
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => cancelBooking(booking._id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 font-semibold text-sm transition-all hover:scale-105"
                        >
                          Cancella
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeBookings.length === 0 && (
                    <tr>
                      <td
                        colSpan="3"
                        className="py-12 text-center text-gray-500 text-xl"
                      >
                        Nessuna prenotazione —{" "}
                        <Link
                          to="/book"
                          className="text-emerald-600 font-bold hover:underline"
                        >
                          Prenota ora!
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── BOTTONE PRENOTA ── */}
        <div className="text-center">
          <Link
            to="/book"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 text-white px-8 md:px-16 py-5 md:py-8 rounded-3xl text-xl md:text-3xl font-black shadow-2xl hover:scale-[1.05] transition-all duration-300 group w-full sm:w-auto justify-center"
          >
            <span>PRENOTA CAMPO</span>
            <svg
              className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-all"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>

        {/* ── DISPONIBILITÀ CAMPI ── */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800 text-center">
            📅 Disponibilità Campi
          </h2>

          <div className="flex justify-center mb-5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border-2 border-gray-200 rounded-2xl text-base focus:ring-4 focus:ring-emerald-300 focus:border-emerald-500 bg-white shadow box-border max-w-full"
              style={{ WebkitAppearance: "none", appearance: "none" }}
            />
          </div>

          {isMobile ? (
            <div className="space-y-4">
              {[...courts]
                .filter((c) => c.status === "available")
                .sort((a, b) =>
                  a.name.localeCompare(b.name, "it", { numeric: true }),
                )
                .map((court) => {
                  const slots = generateSlots(court._id);
                  const freeCount = slots.filter(
                    (s) => !s.isPast && s.type === "free",
                  ).length;
                  return (
                    <div
                      key={court._id}
                      className="bg-white/90 rounded-3xl shadow-lg overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-between">
                        <span className="font-bold text-white text-base">
                          {court.name}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full font-semibold bg-white/20 text-white">
                          {freeCount} slot liberi
                        </span>
                      </div>

                      <div className="p-3 grid grid-cols-4 gap-1.5">
                        {slots.map((slot) => (
                          <div
                            key={slot.time}
                            onClick={() => {
                              if (slot.type === "free" && !slot.isPast) {
                                navigate(
                                  `/book?date=${selectedDate}&court=${court._id}&time=${slot.time}`,
                                );
                              }
                            }}
                            className={`rounded-xl border px-1 py-1.5 text-center transition-all duration-150
                              ${slot.isPast ? "opacity-25" : ""}
                              ${slot.type === "free" && !slot.isPast ? "cursor-pointer active:scale-95 hover:brightness-95" : ""}
                              ${SLOT_STYLES[slot.type]}`}
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
                        {[
                          { type: "free", label: "Libero" },
                          { type: "booking", label: "Prenotato" },
                          { type: "blocked", label: "Bloccato" },
                          { type: "academy", label: "Academy" },
                          { type: "lesson", label: "Lezione" },
                        ].map(({ type, label }) => (
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
          ) : (
            <>
              <div className="flex justify-center gap-4 mb-6 text-sm font-semibold flex-wrap">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-red-500 inline-block" />{" "}
                  Occupato
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-blue-500 inline-block" />{" "}
                  Academy
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-purple-500 inline-block" />{" "}
                  Lezione
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-yellow-400 inline-block" />{" "}
                  Bloccato
                </span>
              </div>
              <CourtTimelineDashboard courts={courts} events={eventsForDate} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── COMPONENTE: aggiungi giocatori inline ──────────────────────────
function AddPlayersInline({ bookingId }) {
  const API = import.meta.env.VITE_API_URL;
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState([""]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const addField = () => {
    if (players.length >= 3) return;
    setPlayers([...players, ""]);
  };

  const handleSave = async () => {
    const filled = players.filter((p) => p.trim() !== "");
    if (filled.length === 0) return setError("Inserisci almeno un nome");
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API}/api/bookings/${bookingId}/players`,
        { players: filled },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSaved(true);
      setOpen(false);
    } catch {
      setError("Errore nel salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  if (saved)
    return (
      <div className="text-xs text-emerald-600 font-bold py-1">
        ✅ Partecipanti aggiunti!
      </div>
    );

  return (
    <div className="mb-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-semibold text-sm hover:bg-emerald-100 transition-all"
        >
          👥 Aggiungi partecipanti
        </button>
      ) : (
        <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-gray-700">
              👥 Aggiungi giocatori
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕
            </button>
          </div>
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-400 w-5 text-center">
                {i + 2}
              </span>
              <input
                type="text"
                value={p}
                onChange={(e) => {
                  const updated = [...players];
                  updated[i] = e.target.value;
                  setPlayers(updated);
                }}
                placeholder={`Giocatore ${i + 2} — Nome e Cognome`}
                className="flex-1 p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 box-border"
              />
            </div>
          ))}
          {players.length < 3 && (
            <button
              onClick={addField}
              className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center font-black">
                +
              </span>
              Aggiungi altro
            </button>
          )}
          {error && (
            <div className="text-red-500 text-xs font-semibold">⚠️ {error}</div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-emerald-500 text-white font-black rounded-xl text-sm hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-60"
          >
            {saving ? "⏳ Salvataggio..." : "💾 Salva"}
          </button>
        </div>
      )}
    </div>
  );
}
