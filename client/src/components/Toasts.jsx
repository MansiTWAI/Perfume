import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';

export default function Toasts() {
  const { toasts, cartOpen } = useStore();
  // With the bag open, toasts rise to the top so they never cover its checkout button.
  return (
    <div className={`toasts ${cartOpen ? 'is-top' : ''}`} role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className={`toast toast-${t.tone}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
