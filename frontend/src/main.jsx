import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import AdminTournaments from "./pages/AdminTournaments";
import "./index.css";

// ── Booking-related pages are commented out in this edition ──────
// These pages exist but are not routed — they can be re-enabled by
// un-commenting the imports and Route entries below.
//
// import Dashboard     from "./pages/Dashboard.jsx";
// import Book          from "./pages/Book.jsx";
// import Register      from "./pages/Register.jsx";
// import AdminDashboard from "./pages/AdminDashboard.jsx";
// import Report        from "./pages/Report";
// ────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<App />} />
        <Route path="/login"             element={<Login />} />
        <Route path="/admin/tournaments" element={<AdminTournaments />} />

        {/* Redirect all old routes to the tournament page */}
        <Route path="/admin"      element={<Navigate to="/admin/tournaments" replace />} />
        <Route path="/dashboard"  element={<Navigate to="/admin/tournaments" replace />} />
        <Route path="/book"       element={<Navigate to="/admin/tournaments" replace />} />
        <Route path="/report"     element={<Navigate to="/admin/tournaments" replace />} />
        <Route path="/register"   element={<Navigate to="/login" replace />} />
        <Route path="*"           element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
