// utils/mailer.js
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',   // true per 465, false per 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

/**
 * Invia mail di notifica prenotazione a un giocatore registrato
 * @param {Object} player     - documento Player con name ed email
 * @param {Object} booking    - documento Booking popolato
 * @param {Object} court      - documento Court con name
 * @param {Object} organizer  - Player che ha creato la prenotazione
 */
async function sendBookingNotification({ player, court, booking, organizer }) {
  const dateStr = new Date(booking.startTime).toLocaleString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long',
    hour: '2-digit', minute: '2-digit'
  })
  const endStr = new Date(booking.endTime).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit'
  })

  await transporter.sendMail({
    from:    `"Padel Club" <${process.env.SMTP_USER}>`,
    to:      player.email,
    subject: `🎾 Sei stato aggiunto a una partita — ${dateStr}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f0fdf4;border-radius:16px;">
        <h2 style="color:#059669;margin-bottom:4px;">🎾 Nuova prenotazione!</h2>
        <p style="color:#374151;">Ciao <strong>${player.name}</strong>,</p>
        <p style="color:#374151;">
          <strong>${organizer.name}</strong> ti ha aggiunto a una partita di padel.
        </p>

        <div style="background:#fff;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #d1fae5;">
          <p style="margin:6px 0;color:#374151;">🏟 <strong>Campo:</strong> ${court.name}</p>
          <p style="margin:6px 0;color:#374151;">📅 <strong>Inizio:</strong> ${dateStr}</p>
          <p style="margin:6px 0;color:#374151;">⏱ <strong>Fine:</strong> ${endStr}</p>
        </div>

        <p style="color:#6b7280;font-size:13px;">
          Se non puoi partecipare, contatta ${organizer.name} o accedi alla tua dashboard per cancellare.
        </p>
        <a href="${process.env.APP_URL}/dashboard"
           style="display:inline-block;margin-top:12px;padding:12px 28px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;">
          Vai alla Dashboard
        </a>
      </div>
    `
  })
}

module.exports = { sendBookingNotification }
