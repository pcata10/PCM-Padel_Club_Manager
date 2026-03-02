import { useState, useEffect } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});

const DEFAULT_CONFIG = {
  clubName: "Padel Club",
  clubShortName: "PC",
  currency: "€",
  slotPrice: 40,
  slotDuration: 90,
  openHour: 8,
  closeHour: 22,
};

export function useConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    api
      .get("/api/config")
      .then((res) => setConfig({ ...DEFAULT_CONFIG, ...res.data }))
      .catch(() => {});
  }, []);

  return config;
}
