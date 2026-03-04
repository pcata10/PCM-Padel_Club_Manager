import { useMemo, useEffect, useRef, useState } from "react";

const TYPE_COLORS = {
  booking: { bg: "bg-red-500", text: "text-white", border: "border-red-600" },
  academy: { bg: "bg-blue-500", text: "text-white", border: "border-blue-600" },
  lesson: {
    bg: "bg-purple-500",
    text: "text-white",
    border: "border-purple-600",
  },
  blocked: {
    bg: "bg-yellow-400",
    text: "text-gray-800",
    border: "border-yellow-500",
  },
  tournament: {
    bg: "bg-gray-500",
    text: "text-white",
    border: "border-gray-600",
  }, // ← nuovo
};

const TYPE_LABELS = {
  booking: "🔴 Prenotazione",
  academy: "🎓 Academy",
  lesson: "👨‍🏫 Lezione",
  blocked: "🔒 Bloccato",
  tournament: "🏆 Torneo", // ← nuovo
};

const START_HOUR = 8;
const END_HOUR = 22;

const generateSlots = (startHour, endHour) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
};

// ── VISTA DESKTOP ──────────────────────────────────────────
function TimelineDesktop({ courts, events, onEventClick, slots, slotWidth }) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowLeft = ((nowMin - START_HOUR * 60) / 30) * slotWidth;
  const totalWidth = slots.length * slotWidth;

  const getEventStyle = (event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const left = ((startMin - START_HOUR * 60) / 30) * slotWidth;
    const width = ((endMin - startMin) / 30) * slotWidth - 2;
    return { left: `${left}px`, width: `${width}px` };
  };

  return (
    <div className="rounded-3xl overflow-hidden shadow-xl bg-white/90 backdrop-blur-xl">
      {/* Header orari */}
      <div className="flex border-b-2 border-gray-200 bg-gray-100 sticky top-0 z-10">
        <div className="w-28 flex-shrink-0 py-2 px-2 text-[10px] font-bold text-gray-400 border-r-2 border-gray-200 uppercase tracking-wider">
          Campo
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex" style={{ width: `${totalWidth}px` }}>
            {slots.map((slot) => (
              <div
                key={slot}
                className={`flex-shrink-0 text-center py-2 border-r ${
                  slot.endsWith(":00")
                    ? "font-bold text-gray-600 border-gray-300 bg-gray-100"
                    : "text-gray-300 border-gray-200 bg-gray-50"
                }`}
                style={{ width: `${slotWidth}px`, fontSize: "8px" }}
              >
                {slot.endsWith(":00") ? slot : "·"}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Righe campi */}
      <div className="divide-y-[6px] divide-gray-100">
        {courts.map((court, idx) => {
          const courtEvents = events.filter(
            (e) => e.extendedProps?.courtId === court._id,
          );
          return (
            <div
              key={court._id}
              className={`flex items-stretch ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}`}
              style={{ minHeight: "68px" }}
            >
              {/* Label */}
              <div className="w-28 flex-shrink-0 px-2 py-2 border-r-2 border-gray-200 flex flex-col justify-center">
                <div className="font-bold text-gray-800 text-xs leading-tight">
                  {court.name}
                </div>
              </div>

              {/* Timeline */}
              <div
                className="flex-1 overflow-hidden"
                onClick={(e) => {
                  if (!onSlotClick) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const slotIndex = Math.floor(x / slotWidth);
                  const totalMins = START_HOUR * 60 + slotIndex * 30;
                  // Arrotonda al blocco da 30min
                  const roundedMins = Math.floor(totalMins / 30) * 30;
                  const h = Math.floor(roundedMins / 60);
                  const m = roundedMins % 60;
                  onSlotClick?.(
                    court,
                    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                  );
                }}
              >
                {" "}
                <div
                  className="relative h-full"
                  style={{ width: `${totalWidth}px`, minHeight: "68px" }}
                >
                  {/* Griglia */}
                  {slots.map((slot, i) => (
                    <div
                      key={slot}
                      className={`absolute top-0 bottom-0 border-r ${
                        slot.endsWith(":00")
                          ? "border-gray-200"
                          : "border-gray-100"
                      }`}
                      style={{
                        left: `${i * slotWidth}px`,
                        width: `${slotWidth}px`,
                      }}
                    />
                  ))}
                  {/* Ora corrente */}
                  {nowLeft > 0 && nowLeft < totalWidth && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-20"
                      style={{ left: `${nowLeft}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500 -translate-x-[3px] mt-1" />
                    </div>
                  )}
                  {/* Eventi */}
                  {courtEvents.map((event) => {
                    const type = event.extendedProps?.type || "booking";
                    const colors = TYPE_COLORS[type] || TYPE_COLORS.booking;
                    return (
                      <div
                        key={event.id}
                        onClick={() => onEventClick?.({ event })}
                        className={`absolute top-2 bottom-2 rounded-lg px-1.5 py-1 cursor-pointer
                          border ${colors.bg} ${colors.text} ${colors.border}
                          hover:brightness-110 hover:shadow-lg transition-all overflow-hidden z-10`}
                        style={getEventStyle(event)}
                        title={`${event.title} | ${new Date(event.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} - ${new Date(event.end).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
                      >
                        <div className="text-[10px] font-bold truncate leading-tight">
                          {event.title}
                        </div>
                        <div className="text-[9px] opacity-80 truncate">
                          {new Date(event.start).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" – "}
                          {new Date(event.end).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VISTA MOBILE ───────────────────────────────────────────
function TimelineMobile({ courts, events, onEventClick, selectedDate }) {
  return (
    <div className="space-y-4">
      {courts.map((court) => {
        const courtEvents = events
          .filter((e) => e.extendedProps?.courtId === court._id)
          .sort((a, b) => new Date(a.start) - new Date(b.start));

        return (
          <div
            key={court._id}
            className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden"
          >
            {/* Header campo */}
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="font-bold text-white text-base">
                {" "}
                {court.name}
              </div>
            </div>

            {/* Lista eventi */}
            <div className="divide-y divide-gray-100">
              {courtEvents.length === 0 ? (
                <div className="px-5 py-4 text-gray-400 text-sm text-center">
                  Nessun evento per questa giornata
                </div>
              ) : (
                courtEvents.map((event) => {
                  const type = event.extendedProps?.type || "booking";
                  const colors = TYPE_COLORS[type] || TYPE_COLORS.booking;
                  return (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.({ event })}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {/* Pallino colore */}
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.bg}`}
                      />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">
                          {event.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {TYPE_LABELS[type]}
                        </div>
                      </div>
                      {/* Orario */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-gray-700 text-sm">
                          {new Date(event.start).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-xs text-gray-400">
                          →{" "}
                          {new Date(event.end).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── COMPONENTE PRINCIPALE ──────────────────────────────────
export default function CourtTimeline({ courts, events, onEventClick }) {
  const slots = useMemo(() => generateSlots(START_HOUR, END_HOUR), []);
  const wrapperRef = useRef(null);
  const [slotWidth, setSlotWidth] = useState(50);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ── Ordina sempre i campi 1→2→3→4 ─────────────────────────────
  const sortedCourts = useMemo(
    () =>
      [...courts].sort((a, b) =>
        a.name.localeCompare(b.name, "it", { numeric: true }),
      ),
    [courts],
  );

  useEffect(() => {
    const calc = () => {
      setIsMobile(window.innerWidth < 768);
      if (!wrapperRef.current) return;
      const totalWidth = wrapperRef.current.clientWidth - 112;
      setSlotWidth(Math.max(Math.floor(totalWidth / slots.length), 20));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [slots.length]);

  return (
    <div ref={wrapperRef}>
      {isMobile ? (
        <TimelineMobile
          courts={sortedCourts} // ← sortedCourts invece di courts
          events={events}
          onEventClick={onEventClick}
        />
      ) : (
        <TimelineDesktop
          courts={sortedCourts} // ← sortedCourts invece di courts
          events={events}
          onEventClick={onEventClick}
          slots={slots}
          slotWidth={slotWidth}
        />
      )}
    </div>
  );
}
