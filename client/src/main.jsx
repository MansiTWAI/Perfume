import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { StoreProvider } from './context/StoreContext';
import App from './App';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/admin.css';
import './styles/gulf.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StoreProvider>
          <App />
        </StoreProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
