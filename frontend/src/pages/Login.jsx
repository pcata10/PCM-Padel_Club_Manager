import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useConfig } from "../hooks/useConfig";
import SponsorFooter from "../components/SponsorFooter";

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

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const config = useConfig(); // ← aggiunto

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/api/login`, form);
      localStorage.setItem("token", res.data.token);
      // ← AGGIUNGI QUESTA RIGA
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: res.data.player.id,
          name: res.data.player.name,
          email: res.data.player.email,
          role: res.data.player.role || "player",
        }),
      );
      axios.defaults.headers.common["Authorization"] =
        `Bearer ${res.data.token}`;
      const role = getRole();
      navigate(role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Errore login");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-400">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
        {/* Nome circolo dinamico */}
        <h1 className="font-bold text-gray-900 text-center mb-2 text-xl">
          🎾 {config.clubName}
        </h1>
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Login
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-800 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50"
          >
            {loading ? "Caricamento..." : "Accedi"}
          </button>
        </form>

        {/* REGISTRAZIONE DISABILITATA — solo admin può accedere
        <p className="text-center mt-6 text-sm text-gray-600">
          Non hai account?{" "}
          <Link
            to="/register"
            className="font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Registrati
          </Link>
        </p>
        */}

        <SponsorFooter />
      </div>
    </div>
  );
}
