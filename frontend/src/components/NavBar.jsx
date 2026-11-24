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

  // Modal cambio password
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (!pwForm.newPassword || pwForm.newPassword.length < 6) {
      return setPwError("La nuova password deve contenere almeno 6 caratteri");
    }

    if (pwForm.newPassword === "admin123") {
      return setPwError("Scegli una password differente da quella di default (admin123)");
    }

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return setPwError("Le due password non coincidono");
    }

    setPwLoading(true);
    try {
      await axios.post(
        `${API}/api/change-password`,
        {
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPwSuccess("✅ Password modificata con successo!");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPwSuccess("");
      }, 1500);
    } catch (err) {
      setPwError(err.response?.data?.msg || "Errore durante il cambio password");
    } finally {
      setPwLoading(false);
    }
  };

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
                  🏆 Gestione Tornei
                </Link>
              )}
              {token ? (
                <>
                  <button
                    onClick={() => {
                      setPwError("");
                      setPwSuccess("");
                      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                      setShowPasswordModal(true);
                    }}
                    title="Modifica la password del tuo account"
                    className="px-3.5 py-2 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl shadow-sm hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1.5 text-xs"
                  >
                    🔑 Password
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
                  🏆 Gestione Tornei
                </Link>
              )}
              {token ? (
                <>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowPasswordModal(true);
                    }}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 text-slate-200 font-bold rounded-2xl w-full hover:bg-slate-700 transition-all"
                  >
                    🔑 Cambia Password
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

      {/* ── MODAL CAMBIO PASSWORD ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                <span>🔑</span> Cambia Password
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Password Attuale
                </label>
                <input
                  type="password"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                  placeholder="Inserisci la password in uso"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Nuova Password (min. 6 caratteri)
                </label>
                <input
                  type="password"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  placeholder="Inserisci nuova password"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Conferma Nuova Password
                </label>
                <input
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  placeholder="Ripeti nuova password"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800"
                  required
                />
              </div>

              {pwError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  ⚠️ {pwError}
                </div>
              )}

              {pwSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold">
                  {pwSuccess}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {pwLoading ? "Salvataggio..." : "Salva Nuova Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
