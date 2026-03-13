import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConfig } from "../hooks/useConfig";

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
  const role = getRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const config = useConfig();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="bg-gradient-to-r from-blue-700 to-blue-950 shadow-lg sticky top-0 z-40 w-full">
      <div className="w-full px-4 md:max-w-6xl md:mx-auto md:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link
            to={role === "admin" ? "/admin" : "/dashboard"}
            className="text-xl md:text-2xl font-bold text-white drop-shadow"
          >
            🎾 {config.clubName}
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-4">
            {role !== "admin" && (
              <Link
                to="/book"
                className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-semibold shadow-md hover:bg-emerald-600 hover:-translate-y-0.5 transition-all"
              >
                Prenota
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/admin"
                className="px-6 py-2 bg-purple-500 text-white rounded-xl font-semibold shadow-md hover:bg-purple-600 hover:-translate-y-0.5 transition-all"
              >
                Admin
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/report"
                className="px-6 py-2 bg-indigo-400 text-white rounded-xl font-semibold shadow-md hover:bg-indigo-600 hover:-translate-y-0.5 transition-all"
              >
                Report
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/admin/tournaments"
                className="px-6 py-2 bg-sky-500 text-white rounded-xl font-semibold shadow-md hover:bg-sky-600 hover:-translate-y-0.5 transition-all"
              >
                🏆 Tornei
              </Link>
            )}
            <button
              to="/login"
              onClick={logout}
              className="px-6 py-2 bg-red-500 text-white rounded-xl font-semibold shadow-md hover:bg-red-600 hover:-translate-y-0.5 transition-all"
            >
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 transition-all gap-1.5"
          >
            <span
              className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-white/20 pt-3">
            {role !== "admin" && (
              <Link
                to="/book"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-emerald-500 text-white rounded-2xl font-semibold w-full hover:bg-emerald-600 transition-all"
              >
                ✏️ Prenota Campo
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-purple-500 text-white rounded-2xl font-semibold w-full hover:bg-purple-600 transition-all"
              >
                ⚙️ Admin Dashboard
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/report"
                className="flex items-center gap-3 px-4 py-3 bg-indigo-400 text-white rounded-xl font-semibold shadow-md hover:bg-indigo-600  transition-all"
              >
                📝 Report
              </Link>
            )}
            {role === "admin" && (
              <Link
                to="/admin/tournaments"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-sky-500 text-white rounded-2xl font-semibold w-full hover:bg-sky-600 transition-all"
              >
                🏆 Tornei
              </Link>
            )}
            <button
              to="/login"
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 bg-red-500 text-white rounded-2xl font-semibold w-full hover:bg-red-600 transition-all"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
