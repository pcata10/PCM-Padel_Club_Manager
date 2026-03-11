import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useConfig } from "./hooks/useConfig";
import SponsorFooter from "./components/SponsorFooter";

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

function App() {
  const navigate = useNavigate();
  const config = useConfig(); // ← aggiunto
  const location = useLocation(); // ← aggiungi

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const role = getRole();
      navigate(role === "admin" ? "/admin" : "/dashboard");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-400">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
        <div className="text-center">
          <div className="w-24 h-24 bg-transparent rounded-2xl mx-auto flex items-center justify-center text-4xl">
            🎾
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            {config.clubName}
          </h1>
          <p className="text-gray-600 mt-2"></p>
        </div>
        <Link
          to="/login"
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-6 rounded-2xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all block text-center"
        >
          Inizia ora →
        </Link>

        <SponsorFooter />
      </div>
    </div>
  );
}

export default App;
