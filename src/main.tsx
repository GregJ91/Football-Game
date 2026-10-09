import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { HelpLayer } from './ui/components/HelpLayer';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <HelpLayer />
  </StrictMode>,
);
