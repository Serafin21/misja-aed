import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Open Sans (SIL OFL 1.1) – self-hosted, includes latin-ext (Polish characters); no request to Google Fonts
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';
import { App } from './App';
import './tokens.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
