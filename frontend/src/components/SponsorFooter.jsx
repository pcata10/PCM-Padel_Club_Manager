import { useEffect, useState } from "react";
import axios from "axios";

export default function SponsorFooter() {
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/sponsors`)
      .then((r) => setSponsors(r.data))
      .catch(() => {});
  }, []);

  if (sponsors.length === 0) return null;

  return (
    <footer className="w-full mt-8 py-4 px-6 bg-gray-10000">
      <p className="text-center text-xs text-gray-800 mb-3 uppercase tracking-widest">
        I nostri sponsor
      </p>
      <div className="flex flex-wrap justify-center items-center gap-6">
        {sponsors.map((s) => (
          <a
            key={s._id}
            href={s.linkUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            title={s.name}
          >
            <img
              src={s.logoUrl}
              alt={s.name}
              className="h-10 object-contain hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100"
            />
          </a>
        ))}
      </div>
    </footer>
  );
}
