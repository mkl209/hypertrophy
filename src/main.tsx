import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initDb } from './db/db.ts';
import App from './App.tsx';
import './ui/theme.css';

initDb().then(() => createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>));
