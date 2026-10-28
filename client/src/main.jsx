import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { StoreProvider } from './context/StoreContext';
import App from './App';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/products.css';
import './styles/admin.css';
import './styles/gulf.css';
import './styles/tailwind.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StoreProvider>
          {/* Visitors who ask their device for less motion get fades without movement. */}
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </StoreProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
