import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Book from "./pages/Book.jsx";
// import Register from "./pages/Register.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx"; // ← AGGIUNGI
import "./index.css";
import Report from "./pages/Report";
import AdminTournaments from "./pages/AdminTournaments";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        {/* <Route path="/register" element={<Register />} />*/}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/book" element={<Book />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/report" element={<Report />} />
        <Route path="/admin/tournaments" element={<AdminTournaments />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
