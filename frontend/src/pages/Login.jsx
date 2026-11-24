import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useConfig } from "../hooks/useConfig";
import SponsorFooter from "../components/SponsorFooter";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();
  const config = useConfig();

  // Stato per cambio password obbligatorio al primo login
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [tempAuth, setTempAuth] = useState(null); // { token, player }
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await axios.post(`${API}/api/login`, form);
      const { token, mustChangePassword, player } = res.data;

      if (mustChangePassword) {
        // Se è richiesto il cambio password al primo accesso
        setIsFirstLogin(true);
        setTempAuth({ token, player });
        setLoading(false);
        return;
      }

      // Login normale
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: player.id,
          name: player.name,
          email: player.email,
          role: player.role || "player",
          mustChangePassword: false,
        })
      );
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      navigate("/admin/tournaments");
    } catch (err) {
      setError(err.response?.data?.msg || "Credenziali errate o errore server");
    }
    setLoading(false);
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const { newPassword, confirmPassword } = passwordForm;

    if (!newPassword || newPassword.length < 6) {
      return setError("La nuova password deve contenere almeno 6 caratteri");
    }

    if (newPassword === "admin123") {
      return setError("Scegli una password differente da quella iniziale (admin123)");
    }

    if (newPassword !== confirmPassword) {
      return setError("Le due password non coincidono");
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/api/change-password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${tempAuth.token}` } }
      );

      // Salva token e credenziali confermate
      localStorage.setItem("token", tempAuth.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: tempAuth.player.id,
          name: tempAuth.player.name,
          email: tempAuth.player.email,
          role: tempAuth.player.role || "admin",
          mustChangePassword: false,
        })
      );
      axios.defaults.headers.common["Authorization"] = `Bearer ${tempAuth.token}`;

      setSuccessMsg("✅ Password impostata con successo! Accesso in corso...");

      setTimeout(() => {
        navigate("/admin/tournaments");
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.msg || "Errore durante il salvataggio della nuova password");
      setLoading(false);
    }
  };

  const fillAdmin = () => {
    setForm({ email: "admin@padel.local", password: "admin123" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-400">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/50">
        {/* Nome circolo dinamico */}
        <h1 className="font-black text-gray-900 text-center mb-1 text-xl flex items-center justify-center gap-2">
          <span>🎾</span> {config.clubName || "Gestione Tornei Padel"}
        </h1>

        {!isFirstLogin ? (
          /* ── SCHERMATA LOGIN NORMALE ── */
          <>
            <h2 className="text-2xl font-black text-gray-800 text-center mb-6">
              Accesso Amministratore
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@padel.local"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 font-medium"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 px-6 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? "Verifica credenziali..." : "Accedi al Pannello"}
              </button>
            </form>

            {/* Accesso Rapido Locale */}
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-600 mb-1">
                Credenziali Predefinite (Pen drive / Locale):
              </p>
              <p className="text-xs font-mono text-slate-800 mb-2 font-bold">
                admin@padel.local / admin123
              </p>
              <button
                type="button"
                onClick={fillAdmin}
                className="text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-xl transition-all"
              >
                ⚡ Compila credenziali predefinite
              </button>
              <p className="text-[11px] text-slate-400 mt-2">
                *(Al 1° accesso il sistema ti chiederà di sostituire la password per sicurezza)*
              </p>
            </div>
          </>
        ) : (
          /* ── SCHERMATA CAMBIO PASSWORD PRIMO LOGIN ── */
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 text-amber-700 border border-amber-200 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
                🔐
              </div>
              <h2 className="text-xl font-black text-gray-900">
                Primo Accesso Rilevato
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Per proteggere il sistema e i dati del tuo circolo, inserisci una <strong>nuova password personale</strong> per sostituire quella iniziale (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">admin123</code>).
              </p>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Nuova Password (min. 6 caratteri)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                    placeholder="Scegli la tua nuova password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-slate-800 font-medium pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-semibold p-1"
                  >
                    {showPassword ? "Nascondi" : "Mostra"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Conferma Nuova Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Ripeti la nuova password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-slate-800 font-medium"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold">
                  ⚠️ {error}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 px-6 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? "Salvataggio password..." : "Salva Nuova Password ed Entra 🚀"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFirstLogin(false);
                  setPasswordForm({ newPassword: "", confirmPassword: "" });
                  setError("");
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-bold py-1 transition-colors"
              >
                ← Annulla e torna al login
              </button>
            </form>
          </>
        )}

        <SponsorFooter />
      </div>
    </div>
  );
}
