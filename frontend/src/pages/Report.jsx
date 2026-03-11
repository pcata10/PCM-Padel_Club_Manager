import { useState, useEffect } from "react";
import axios from "axios";
import NavBar from "../components/NavBar";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export default function Report() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [month, year]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/api/admin/report?month=${month}&year=${year}`,
      );

      // ── Ordina courtStats Campo 1 → 2 → 3 → 4 ─────────────────
      const data = {
        ...res.data,
        courtStats: [...(res.data.courtStats || [])].sort((a, b) =>
          a.courtName.localeCompare(b.courtName, "it", { numeric: true }),
        ),
      };
      setReport(data);
    } catch (err) {
      alert("Errore caricamento report");
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const printReport = () => window.print();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <NavBar />
      <div className="pt-20 px-4 md:px-8 pb-12 max-w-6xl mx-auto space-y-8">
        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Report Mensile
            </h1>
            <p className="text-gray-600 mt-1">
              Statistiche dettagliate per campo
            </p>
          </div>
          <button
            onClick={printReport}
            className="px-5 py-2.5 bg-indigo-500 text-white rounded-2xl font-semibold hover:bg-indigo-600 transition-all text-sm shadow-md"
          >
            🖨️ Stampa / PDF
          </button>
        </div>

        {/* ── SELETTORE MESE ── */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-xl flex items-center justify-between gap-4">
          <button
            onClick={prevMonth}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 transition-all flex items-center justify-center"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="text-2xl font-black text-gray-800">
              {MONTHS[month - 1]} {year}
            </div>
          </div>
          <button
            onClick={nextMonth}
            disabled={
              month === now.getMonth() + 1 && year === now.getFullYear()
            }
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 transition-all flex items-center justify-center disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {loading && (
          <div className="text-center py-12 text-emerald-600 text-xl font-semibold">
            Caricamento...
          </div>
        )}

        {report && !loading && (
          <>
            {/* ── KPI CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Prenotazioni",
                  value: report.totalBookings,
                  icon: "✏️",
                  color: "from-emerald-400 to-teal-500",
                },
                {
                  label: "Incasso",
                  value: `€${report.totalRevenue}`,
                  icon: "💶",
                  color: "from-blue-400 to-indigo-500",
                },
                {
                  label: "Ore Academy",
                  value: `${report.totalAcademyHours}h`,
                  icon: "🎓",
                  color: "from-blue-500 to-blue-600",
                },
                {
                  label: "Ore Lezioni",
                  value: `${report.totalLessonHours}h`,
                  icon: "👨‍🏫",
                  color: "from-purple-400 to-purple-600",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className={`bg-gradient-to-br ${kpi.color} rounded-3xl p-5 text-white shadow-xl`}
                >
                  <div className="text-3xl mb-2">{kpi.icon}</div>
                  <div className="text-2xl md:text-3xl font-black">
                    {kpi.value}
                  </div>
                  <div className="text-sm font-semibold opacity-90 mt-1">
                    {kpi.label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── TABELLA PER CAMPO ── */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 md:p-8 shadow-xl">
              <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">
                📋 Dettaglio per Campo
              </h2>

              {/* Mobile → cards */}

              <div className="md:hidden space-y-4">
                {report.courtStats.map((court) => (
                  <div
                    key={court.courtName}
                    className="bg-gray-50 rounded-2xl p-4 border border-gray-100"
                  >
                    <div className="font-bold text-gray-800 text-lg mb-3">
                      {court.courtName}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-emerald-50 rounded-xl p-2 text-center">
                        <div className="font-black text-emerald-600 text-xl">
                          {court.bookings}
                        </div>
                        <div className="text-gray-600">Prenotazioni</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-2 text-center">
                        <div className="font-black text-blue-600 text-xl">
                          €{court.revenue}
                        </div>
                        <div className="text-gray-600">Incasso</div>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-2 text-center">
                        <div className="font-black text-indigo-600 text-xl">
                          {court.academyHours}h
                        </div>
                        <div className="text-gray-600">
                          🎓 Academy ({court.academySessions})
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-2 text-center">
                        <div className="font-black text-purple-600 text-xl">
                          {court.lessonHours}h
                        </div>
                        <div className="text-gray-600">
                          👨‍🏫 Lezioni ({court.lessonSessions})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop → tabella */}
              <div className="hidden md:block overflow-x-auto rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                    <tr>
                      <th className="py-4 px-6 rounded-tl-2xl">Campo</th>
                      <th className="py-4 px-6 text-center">Prenotazioni</th>
                      <th className="py-4 px-6 text-center">Incasso</th>
                      <th className="py-4 px-6 text-center">🎓 Academy</th>
                      <th className="py-4 px-6 text-center">👨‍🏫 Lezioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.courtStats.map((court, i) => (
                      <tr
                        key={court.courtName}
                        className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                      >
                        <td className="py-4 px-6 font-bold text-gray-800">
                          {court.courtName}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="font-black text-emerald-600 text-lg">
                            {court.bookings}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="font-black text-blue-600 text-lg">
                            €{court.revenue}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="font-bold text-indigo-600">
                            {court.academyHours}h
                          </span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({court.academySessions} sessioni)
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="font-bold text-purple-600">
                            {court.lessonHours}h
                          </span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({court.lessonSessions} sessioni)
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Totali */}
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-50 font-black border-t-2 border-gray-300">
                      <td className="py-4 px-6 text-gray-800">TOTALE</td>
                      <td className="py-4 px-6 text-center text-emerald-600">
                        {report.totalBookings}
                      </td>
                      <td className="py-4 px-6 text-center text-blue-600">
                        €{report.totalRevenue}
                      </td>
                      <td className="py-4 px-6 text-center text-indigo-600">
                        {report.totalAcademyHours}h
                      </td>
                      <td className="py-4 px-6 text-center text-purple-600">
                        {report.totalLessonHours}h
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── DETTAGLIO LEZIONI COACH ── */}
            {report.courtStats.some((c) => c.lessons?.length > 0) && (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 md:p-8 shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">
                  👨‍🏫 Dettaglio Lezioni Coach
                </h2>
                <div className="space-y-5">
                  {report.courtStats
                    .filter((c) => c.lessons?.length > 0)
                    .map((court) => (
                      <div key={court.courtName}>
                        {/* Header campo */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-bold text-purple-700 uppercase tracking-wide">
                            {court.courtName}
                          </span>
                          <div className="flex-1 h-px bg-purple-200"></div>
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-semibold">
                            {court.lessonHours}h · {court.lessonSessions}{" "}
                            session{court.lessonSessions === 1 ? "e" : "i"}
                          </span>
                        </div>
                        {/* Lista lezioni */}
                        <div className="space-y-1.5">
                          {court.lessons.map((l, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-2xl px-4 py-2.5"
                            >
                              <span className="text-base">👨‍🏫</span>
                              <span className="text-xs text-gray-400 w-32 flex-shrink-0">
                                {new Date(l.date).toLocaleDateString("it-IT", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                                {" · "}
                                {new Date(l.date).toLocaleTimeString("it-IT", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Europe/Rome",
                                })}
                              </span>
                              <span className="font-semibold text-purple-800 text-sm flex-1">
                                {l.note || (
                                  <span className="text-gray-400 italic font-normal">
                                    Nessuna nota
                                  </span>
                                )}
                              </span>
                              <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                                {l.hours}h
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── ATTIVITÀ GIORNALIERA ── */}
            {Object.keys(report.dailyStats).length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 md:p-8 shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">
                  📅 Prenotazioni per Giorno
                </h2>
                <div className="space-y-2">
                  {Object.entries(report.dailyStats)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, count]) => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-28 flex-shrink-0">
                          {new Date(day).toLocaleDateString("it-IT", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full flex items-center px-3 transition-all duration-500"
                            style={{
                              width: `${Math.min((count / report.totalBookings) * 100 * 3, 100)}%`,
                            }}
                          >
                            <span className="text-white text-xs font-bold">
                              {count}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {report?.totalBookings === 0 && !loading && (
          <div className="bg-white/80 rounded-3xl p-12 text-center shadow-xl">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-500 text-xl font-semibold">
              Nessuna prenotazione in {MONTHS[month - 1]} {year}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
