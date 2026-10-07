import { api } from './api';

// Razorpay Checkout (UPI, cards, netbanking, wallets). The script is loaded
// only when someone pays. The amount is set by our server from the saved
// order; this page only opens the window and reports back.
//
// payOnline resolves with 'paid' once our server has verified the payment.
// Otherwise it rejects with an error whose `kind` says what to show:
//   dismissed  – the window was closed before paying (nothing taken)
//   failed     – the bank declined / the payment did not go through
//   confirming – paid at Razorpay, our server is still confirming it: do not
//                offer to pay again; check with checkPayment()
//   review     – money arrived but could not be applied (order changed); refunded
//   error      – could not start (network, provider down…)
let loading = null;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => {
      loading = null;
      reject(new Error('The payment window could not be opened. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const problem = (kind, message) => Object.assign(new Error(message), { kind, dismissed: kind === 'dismissed' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Where the order's payment stands (asks Razorpay on the server if needed).
export const checkPayment = ({ orderNumber, email }) => api('/payments/razorpay/status', { method: 'POST', body: { orderNumber, email } });

// Polls for a few seconds after the browser lost the verify response.
async function confirm(ids, tries = 6) {
  for (let i = 0; i < tries; i++) {
    await wait(i ? 2500 : 1200);
    try {
      if ((await checkPayment(ids)).paid) return true;
    } catch {
      /* offline for a moment: keep trying */
    }
  }
  return false;
}

// One payment window at a time, even if Pay is pressed twice.
let inFlight = null;
export function payOnline(ids) {
  inFlight ||= run(ids).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run({ orderNumber, email }) {
  const ids = { orderNumber, email };
  let session;
  try {
    [session] = await Promise.all([api('/payments/razorpay/order', { method: 'POST', body: ids }), loadCheckout()]);
  } catch (e) {
    if (e.code === 'ALREADY_PAID') return 'paid';
    throw problem('error', e.message);
  }
  return new Promise((resolve, reject) => {
    let handled = false;
    let lastFailure = '';
    const rzp = new window.Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amount,
      currency: session.currency,
      name: session.name,
      description: session.description,
      prefill: session.prefill,
      notes: { orderNumber: session.orderNumber },
      theme: { color: '#4B0E14' },
      handler: async (resp) => {
        handled = true;
        try {
          const v = await api('/payments/razorpay/verify', { method: 'POST', body: { ...ids, ...resp } });
          if (v.paid) return resolve('paid');
          // 202: Razorpay took the payment, our server is confirming it.
          return (await confirm(ids)) ? resolve('paid') : reject(problem('confirming', v.message));
        } catch (e) {
          if (e.code === 'PAYMENT_NEEDS_REVIEW') return reject(problem('review', e.message));
          if (e.status === 400 || e.status === 402) return reject(problem('failed', e.message));
          // Network or server trouble after paying: never ask to pay again
          // until we know.
          return (await confirm(ids)) ? resolve('paid') : reject(problem('confirming', 'We are confirming your payment. Please do not pay again.'));
        }
      },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          if (handled) return;
          reject(lastFailure ? problem('failed', lastFailure) : problem('dismissed', 'Payment was not completed.'));
        },
      },
    });
    // Razorpay lets the customer try another method inside the window, so a
    // failure is only reported if they then close it.
    rzp.on('payment.failed', (r) => {
      lastFailure = r?.error?.description || 'The payment did not go through. Please try again.';
    });
    rzp.open();
  });
}
