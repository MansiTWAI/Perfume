// Local / VPS entry point. On Vercel, api/index.js imports the same app.
import app from './app.js';
import { connectDB } from './config/db.js';
import { startShippingJobs } from './services/shipping.js';
import { startWhatsAppJobs } from './services/whatsapp.js';
import { startPaymentJobs } from './services/payments.js';
import { mailConfigured } from './services/mail.js';

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
  process.exit(1);
}

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`AL BARAKAH LIFESTYLE on http://localhost:${PORT}`));
    // Delhivery: retries, missed shipments and tracking polls (only when configured).
    startShippingJobs();
    // WhatsApp notifications: sends queued messages and retries (only when configured).
    startWhatsAppJobs();
    // Online orders never paid: checked with Razorpay, then released.
    startPaymentJobs();
    if (process.env.NODE_ENV === 'production' && !mailConfigured()) {
      console.error('Email (SMTP_HOST, MAIL_FROM) is not set: staff cannot receive their sign-in code. See server/.env.example.');
    }
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
