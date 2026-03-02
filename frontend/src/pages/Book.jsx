import React, { useState, useEffect } from "react";
import axios from "axios";
import NavBar from "../components/NavBar";

const API = import.meta.env.VITE_API_URL;

const SLOT_STYLES = {
  free: "bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-200 active:scale-95",
  booking: "bg-red-100 text-red-700 border-red-200 cursor-not-allowed",
  blocked: "bg-yellow-100 text-yellow-700 border-yellow-200 cursor-not-allowed",
  academy: "bg-blue-100 text-blue-700 border-blue-200 cursor-not-allowed",
  lesson: "bg-purple-100 text-purple-700 border-purple-200 cursor-not-allowed",
  selected:
    "bg-emerald-500 text-white border-emerald-600 cursor-pointer ring-2 ring-emerald-400 scale-105",
};
const SLOT_ICONS = {
  free: "🟢",
  booking: "🔴",
  blocked: "🔒",
  academy: "🎓",
  lesson: "👨‍🏫",
  selected: "✅",
};

export default function Book() {
  const [courts, setCourts] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ players: ["", "", ""] });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      const [cRes, avRes] = await Promise.all([
        axios.get(`${API}/api/courts`),
        axios.get(`${API}/api/availability`),
      ]);
      setCourts(cRes.data);
      const allEvents = [
        ...avRes.data.bookings.map((b) => ({
          ...b,
          start: b.startTime,
          end: b.endTime,
          extendedProps: { courtId: b.court?._id || b.court, type: "booking" },
        })),
        ...avRes.data.blocked.map((b) => ({
          ...b,
          start: b.startTime,
          end: b.endTime,
          extendedProps: {
            courtId: b.court?._id || b.court,
            type: b.type || "blocked",
          },
        })),
      ];
      setEvents(allEvents);
    } catch (err) {
      console.error("❌ Errore fetch:", err);
      setError("Errore nel caricamento dati");
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
      const overlapping = events.find(
        (e) =>
          e.extendedProps?.courtId === courtId &&
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

  const handleSlotClick = (court, slot) => {
    if (slot.type !== "free" || slot.isPast) return;
    if (
      selectedSlot?.courtId === court._id &&
      selectedSlot?.time === slot.time
    ) {
      setSelectedSlot(null);
    } else {
      setSelectedSlot({
        courtId: court._id,
        courtName: court.name,
        time: slot.time,
      });
      setSuccess(false);
      setSuccessBookingId(null);
      setError("");
      setTimeout(
        () =>
          document
            .getElementById("booking-form")
            ?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return setError("Seleziona uno slot prima di procedere");
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const start = new Date(`${selectedDate}T${selectedSlot.time}:00`);
      const res = await axios.post(
        `${API}/api/bookings`,
        {
          court: selectedSlot.courtId,
          startTime: start.toISOString(),
          duration: "1h30min",
          players: form.players.filter((p) => p.trim() !== ""),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess(true);
      setSuccessBookingId(res.data.booking._id);
      setSelectedSlot(null);
      setForm({ players: ["", "", ""] });
      fetchData();
      setTimeout(
        () =>
          document
            .getElementById("success-block")
            ?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch (err) {
      setError(
        err.response?.data?.msg || "Errore durante la prenotazione. Riprova.",
      );
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      <NavBar />
      <div className="max-w-lg mx-auto px-4 pt-10 pb-10 space-y-6">
        {/* ── TITOLO ── */}
        <div className="text-center pt-2">
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            🎾 Prenota Campo
          </h1>
          <p className="text-gray-500 text-sm mt-1">Slot fissi 1h30min</p>
        </div>

        {/* ── SELETTORE DATA ── */}
        <div
          className="
          text-center flex justify-center mb-4 gap-2"
        >
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedSlot(null);
            }}
            min={minDate}
            max={maxDate}
            className="w-full max-w-full p-3 border-2 border-gray-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-300 focus:border-blue-500 box-border"
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

        <label className="block text-sm font-bold text-gray-700 mb-2 text-center ">
          ⬆️ <br></br>Seleziona un giorno <br></br>
          <br></br>
          <hr></hr>
          <br></br> Seleziona uno slot libero<br></br> ⬇️
        </label>
        {/* ── GRIGLIA DISPONIBILITÀ ── */}
        {[...courts]
          .filter((c) => c.status === "available")
          .sort((a, b) => a.name.localeCompare(b.name, "it", { numeric: true }))
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
                <div className="px-4 py-3 bg-gradient-to-r from-blue-700 to-blue-950 flex items-center justify-between">
                  <span className="font-bold text-white text-base">
                    {court.name}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full font-semibold bg-white/20 text-white">
                    {freeCount} slot liberi
                  </span>
                </div>
                <div className="p-3 grid grid-cols-4 gap-1.5">
                  {slots.map((slot) => {
                    const isSelected =
                      selectedSlot?.courtId === court._id &&
                      selectedSlot?.time === slot.time;
                    const styleKey = isSelected ? "selected" : slot.type;
                    return (
                      <div
                        key={slot.time}
                        onClick={() => handleSlotClick(court, slot)}
                        className={`rounded-xl border px-1 py-1.5 text-center transition-all duration-150
                          ${slot.isPast ? "opacity-25 cursor-not-allowed" : ""}
                          ${SLOT_STYLES[styleKey]}`}
                      >
                        <div className="text-xs font-bold leading-tight">
                          {slot.time}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {SLOT_ICONS[styleKey]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {/* ── LEGENDA ── */}
        <div className="flex flex-wrap gap-2 justify-center px-1">
          {[
            { type: "free", label: "Disponibile" },
            { type: "booking", label: "Prenotato" },
            { type: "blocked", label: "Bloccato" },
            { type: "academy", label: "Academy" },
            { type: "lesson", label: "Lezione" },
          ].map(({ type, label }) => (
            <span
              key={type}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${SLOT_STYLES[type]}`}
            >
              {SLOT_ICONS[type]} {label}
            </span>
          ))}
        </div>

        {/* ── FORM PRENOTAZIONE ── */}
        {selectedSlot && (
          <div
            id="booking-form"
            className="bg-white/90 rounded-3xl shadow-xl p-5 border-2 border-emerald-300"
          >
            {/* Riepilogo slot */}
            <div className="flex items-center gap-3 mb-5 p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <div className="text-3xl">✅</div>
              <div>
                <div className="font-black text-emerald-700 text-base">
                  {selectedSlot.courtName}
                </div>
                <div className="text-sm text-emerald-600 font-semibold">
                  {new Date(selectedDate).toLocaleDateString("it-IT", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  {" — "}
                  {selectedSlot.time} →{" "}
                  {(() => {
                    const [h, m] = selectedSlot.time.split(":").map(Number);
                    const end = new Date(0, 0, 0, h, m + 90);
                    return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
                  })()}
                </div>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="ml-auto text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Giocatori 2-4 opzionali */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  👥 Altri giocatori{" "}
                  <span className="text-gray-400 font-normal">(opzionale)</span>
                </label>
                <div className="space-y-2">
                  {form.players.map((player, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-black text-gray-400 w-5 text-center">
                        {i + 2}
                      </span>
                      <input
                        type="text"
                        value={player}
                        onChange={(e) => {
                          const updated = [...form.players];
                          updated[i] = e.target.value;
                          setForm({ ...form, players: updated });
                        }}
                        placeholder={`Giocatore ${i + 2} — Nome e Cognome`}
                        className="flex-1 p-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-300 focus:border-emerald-400 box-border"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-semibold text-center">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-black text-base rounded-2xl shadow-lg hover:from-emerald-600 hover:to-green-600 active:scale-95 transition-all disabled:opacity-60"
              >
                {loading
                  ? "⏳ Prenotazione in corso..."
                  : "🎾 Conferma Prenotazione"}
              </button>
            </form>
          </div>
        )}

        {/* ── SUCCESSO ── */}
        {success && (
          <div
            id="success-block"
            className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 shadow-lg space-y-4"
          >
            <div className="text-center">
              <div className="text-5xl mb-3">🎉</div>
              <div className="font-black text-emerald-700 text-xl mb-1">
                Prenotazione confermata!
              </div>
              <div className="text-emerald-600 text-sm">
                Ti aspettiamo in campo. Buon gioco!
              </div>
            </div>
            {successBookingId && (
              <AddPlayersLater bookingId={successBookingId} API={API} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── COMPONENTE: aggiungi giocatori dopo la prenotazione ── */
function AddPlayersLater({ bookingId, API }) {
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
    } catch {
      setError("Errore nel salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  if (saved)
    return (
      <div className="text-center text-emerald-700 font-bold text-sm py-2">
        ✅ Partecipanti aggiunti con successo!
      </div>
    );

  return (
    <div className="border-t border-emerald-200 pt-4 space-y-3">
      <p className="text-sm font-bold text-gray-700">
        👥 Vuoi aggiungere gli altri giocatori?
      </p>
      <div className="space-y-2">
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
              className="flex-1 p-3 border-2 border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-300 focus:border-emerald-400 box-border"
            />
          </div>
        ))}
      </div>

      {players.length < 3 && (
        <button
          onClick={addField}
          className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700"
        >
          <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-black">
            +
          </span>
          Aggiungi partecipante
        </button>
      )}

      {error && (
        <div className="text-red-500 text-xs font-semibold text-center">
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-emerald-500 text-white font-black rounded-2xl shadow hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-60 text-sm"
      >
        {saving ? "⏳ Salvataggio..." : "💾 Salva partecipanti"}
      </button>
    </div>
  );
}
