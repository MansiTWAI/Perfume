import { api } from './api';

// Razorpay Checkout (UPI, cards, netbanking, wallets). The script is loaded
// only when someone pays. Resolves when the payment is verified by our server;
// rejects with { dismissed: true } if the customer closes the window.
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

export async function payOnline({ orderNumber, email }) {
  const [session] = await Promise.all([api('/payments/razorpay/order', { method: 'POST', body: { orderNumber, email } }), loadCheckout()]);
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amount,
      currency: session.currency,
      name: session.name,
      description: session.description,
      prefill: session.prefill,
      theme: { color: '#4B0E14' },
      handler: (resp) => {
        api('/payments/razorpay/verify', { method: 'POST', body: { orderNumber, email, ...resp } }).then(resolve, reject);
      },
      modal: { ondismiss: () => reject(Object.assign(new Error('Payment was not completed.'), { dismissed: true })) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'The payment did not go through. Please try again.')));
    rzp.open();
  });
}
