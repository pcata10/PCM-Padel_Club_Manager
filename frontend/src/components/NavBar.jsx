import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useConfig } from "../hooks/useConfig";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const getRole = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
};

export default function NavBar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const role = getRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const config = useConfig();

  // Modal impostazioni club & password
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [form, setForm] = useState({
    clubName: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleOpenSettings = () => {
    setError("");
    setSuccess("");
    setForm({
      clubName: config.clubName || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const hasNewPassword = Boolean(form.newPassword && form.newPassword.trim());
    const hasClubNameChange = Boolean(
      form.clubName && form.clubName.trim() && form.clubName.trim() !== config.clubName
    );

    if (hasNewPassword) {
      if (form.newPassword.trim().length < 6) {
        return setError("La nuova password deve contenere almeno 6 caratteri");
      }
      if (form.newPassword.trim() === "admin123") {
        return setError("Scegli una password differente da quella di default (admin123)");
      }
      if (form.newPassword !== form.confirmPassword) {
        return setError("Le due password non coincidono");
      }
    }

    if (!hasNewPassword && !hasClubNameChange) {
      return setError("Nessuna modifica rilevata");
    }

    setLoading(true);
    try {
      if (hasNewPassword) {
        await axios.post(
          `${API}/api/change-password`,
          {
            currentPassword: form.currentPassword,
            newPassword: form.newPassword.trim(),
            clubName: form.clubName ? form.clubName.trim() : undefined,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else if (hasClubNameChange) {
        await axios.put(
          `${API}/api/admin/club-name`,
          { clubName: form.clubName.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setSuccess("✅ Impostazioni salvate con successo!");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.msg || "Errore durante il salvataggio");
      setLoading(false);
    }
  };

  const displayClubName = config.clubName && config.clubName !== "Gestione Tornei" ? config.clubName : "";

  return (
    <>
      <nav className="bg-slate-900 border-b border-slate-800 shadow-xl sticky top-0 z-40 w-full">
        <div className="w-full px-4 md:max-w-6xl md:mx-auto md:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link
              to="/admin/tournaments"
              className="text-xl md:text-2xl font-black text-white tracking-wide drop-shadow flex items-center gap-2 hover:text-blue-200 transition-colors"
            >
              🎾 {config.clubName || "Gestione Tornei"}
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/live"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-slate-800 border border-slate-700 text-yellow-400 font-extrabold rounded-xl shadow-sm hover:bg-slate-700 hover:border-yellow-400/50 hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
              >
                📺 Vista Live
              </Link>
              {role === "admin" && (
                <Link
                  to="/admin/tournaments"
                  className="px-5 py-2 bg-blue-600 text-white font-extrabold rounded-xl shadow-md hover:bg-blue-500 hover:shadow-blue-500/25 hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
                >
                  🏆 Gestione Tornei{displayClubName ? ` • ${displayClubName}` : ""}
                </Link>
              )}
              {token ? (
                <>
                  <button
                    onClick={handleOpenSettings}
                    title="Impostazioni Circolo e Password"
                    className="px-3.5 py-2 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl shadow-sm hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1.5 text-xs"
                  >
                    ⚙️ Impostazioni
                  </button>
                  <button
                    onClick={logout}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-xl shadow-sm hover:bg-slate-700 hover:text-white hover:border-red-400/50 hover:-translate-y-0.5 transition-all text-xs"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-xl shadow-sm hover:bg-slate-700 hover:text-white hover:-translate-y-0.5 transition-all"
                >
                  🔑 Accedi
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all gap-1.5"
            >
              <span
                className={`block w-5 h-0.5 bg-blue-400 transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
              />
              <span
                className={`block w-5 h-0.5 bg-blue-400 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block w-5 h-0.5 bg-blue-400 transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
              />
            </button>
          </div>

          {/* Mobile dropdown */}
          {menuOpen && (
            <div className="md:hidden pb-4 space-y-2 border-t border-slate-800 pt-3">
              <Link
                to="/live"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-400 font-extrabold rounded-2xl w-full hover:bg-slate-700 transition-all"
              >
                📺 Vista Live
              </Link>
              {role === "admin" && (
                <Link
                  to="/admin/tournaments"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white font-extrabold rounded-2xl w-full hover:bg-blue-500 transition-all"
                >
                  🏆 Gestione Tornei{displayClubName ? ` • ${displayClubName}` : ""}
                </Link>
              )}
              {token ? (
                <>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleOpenSettings();
                    }}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-2xl w-full hover:bg-slate-700 transition-all"
                  >
                    ⚙️ Impostazioni Club & Password
                  </button>
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-2xl w-full hover:bg-slate-700 transition-all"
                  >
                    🚪 Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-2xl w-full hover:bg-slate-700 transition-all"
                >
                  🔑 Accedi
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ── MODAL IMPOSTAZIONI CLUB & PASSWORD ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                <span>⚙️</span> Impostazioni Circolo & Password
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Nome Circolo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nome del Circolo / Club</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">.env</span>
                </label>
                <input
                  type="text"
                  value={form.clubName}
                  onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                  placeholder="es. Padel Club Roma"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 font-bold"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Modifica Password (opzionale)
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Password Attuale
                    </label>
                    <input
                      type="password"
                      value={form.currentPassword}
                      onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                      placeholder="Necessaria per cambiare password"
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Nuova Password
                    </label>
                    <input
                      type="password"
                      value={form.newPassword}
                      onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                      placeholder="Lascia vuoto per non cambiarla"
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Conferma Nuova Password
                    </label>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      placeholder="Ripeti la nuova password"
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold">
                  {success}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? "Salvataggio..." : "Salva Impostazioni"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
