// components/CourtTimelineBook.jsx
import { useMemo, useEffect, useRef, useState } from "react";

const START_HOUR = 8;
const END_HOUR = 23;

const TYPE_COLORS = {
  booking: { bg: "#ef4444", border: "#dc2626" },
  academy: { bg: "#3b82f6", border: "#2563eb" },
  lesson: { bg: "#a855f7", border: "#9333ea" },
  blocked: { bg: "#9ca3af", border: "#6b7280" }, // ← grigio
};

const EVENT_LABELS = {
  booking: "🔴 Occupato",
  academy: "🎓 Academy",
  lesson: "👨‍🏫 Lezione",
  blocked: "🔒 Bloccato/Torneo",
};

const generateSlots = (startHour, endHour) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
};

// ── DESKTOP ────────────────────────────────────────────────
function DesktopBook({ courts, events, slots, slotWidth }) {
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
      <div className="flex border-b-2 border-gray-200 bg-gray-100">
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
                style={{ width: `${slotWidth}px`, fontSize: "9px" }}
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
              <div className="w-28 flex-shrink-0 px-2 py-2 border-r-2 border-gray-200 flex flex-col justify-center">
                <div className="font-bold text-gray-800 text-xs leading-tight">
                  {court.name}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <div
                  className="relative h-full"
                  style={{ width: `${totalWidth}px`, minHeight: "68px" }}
                >
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

                  {nowLeft > 0 && nowLeft < totalWidth && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-20"
                      style={{ left: `${nowLeft}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500 -translate-x-[3px] mt-1" />
                    </div>
                  )}

                  {/* Eventi — solo visualizzazione */}
                  {courtEvents.map((event) => {
                    const type = event.extendedProps?.type || "booking";
                    const color = TYPE_COLORS[type] || TYPE_COLORS.booking;
                    const label = EVENT_LABELS[type] || EVENT_LABELS.booking;
                    return (
                      <div
                        key={event.id}
                        className="absolute top-2 bottom-2 rounded-lg px-1.5 py-1 overflow-hidden z-10 cursor-default"
                        style={{
                          ...getEventStyle(event),
                          backgroundColor: color.bg,
                          border: `1px solid ${color.border}`,
                        }}
                        title={`${new Date(event.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} – ${new Date(event.end).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
                      >
                        <div className="text-[10px] font-bold text-white truncate">
                          {label}
                        </div>
                        <div className="text-[9px] text-white/80 truncate">
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

// ── MOBILE ─────────────────────────────────────────────────
function MobileBook({ courts, events }) {
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
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="font-bold text-white text-base">{court.name}</div>
            </div>
            <div className="divide-y divide-gray-100">
              {courtEvents.length === 0 ? (
                <div className="px-5 py-4 text-gray-400 text-sm text-center">
                  Nessun evento — campo libero 🟢
                </div>
              ) : (
                courtEvents.map((event) => {
                  const type = event.extendedProps?.type || "booking";
                  const color = TYPE_COLORS[type] || TYPE_COLORS.booking;
                  const label = EVENT_LABELS[type] || EVENT_LABELS.booking;
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 px-4 py-3"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color.bg }}
                      />
                      <div className="flex-1 text-sm font-semibold text-gray-700">
                        {label}
                      </div>
                      <div className="text-right text-sm font-bold text-gray-700 flex-shrink-0">
                        {new Date(event.start).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <span className="text-xs text-gray-400 font-normal block">
                          →{" "}
                          {new Date(event.end).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
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

// ── PRINCIPALE ─────────────────────────────────────────────
export default function CourtTimelineBook({ courts, events, selectedDate }) {
  const slots = useMemo(() => generateSlots(START_HOUR, END_HOUR), []);
  const wrapperRef = useRef(null);
  const [slotWidth, setSlotWidth] = useState(50);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const calc = () => {
      setIsMobile(window.innerWidth < 768);
      if (!wrapperRef.current) return;
      const totalWidth = wrapperRef.current.clientWidth - 112;
      setSlotWidth(Math.max(Math.floor(totalWidth / slots.length), 18));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [slots.length]);

  return (
    <div ref={wrapperRef}>
      {isMobile ? (
        <MobileBook courts={courts} events={events} />
      ) : (
        <DesktopBook
          courts={courts}
          events={events}
          slots={slots}
          slotWidth={slotWidth}
        />
      )}
    </div>
  );
}
