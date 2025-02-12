import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './styles.css';
import './icons.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />); 