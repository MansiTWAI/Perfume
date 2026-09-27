import { useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../context/StoreContext';

export default function Newsletter({ source = 'site' }) {
  const { t } = useStore();
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    setState('busy');
    try {
      await api('/subscribers', { method: 'POST', body: { email, source } });
      setState('done');
      setMsg(t('You are on the list. Welcome to the house.'));
      setEmail('');
    } catch (err) {
      setState('idle');
      setMsg(err.message);
    }
  }

  return (
    <form className="newsletter" onSubmit={submit}>
      <label htmlFor={`nl-${source}`} className="sr-only">{t('Email address')}</label>
      <input id={`nl-${source}`} type="email" required placeholder={t('Your email address')} value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={state === 'busy'}>{t(state === 'busy' ? 'Joining…' : 'Join')}</button>
      {msg && <p className="newsletter-msg" role="status">{msg}</p>}
    </form>
  );
}
