// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { JournalProvider } from './hooks/useJournal';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <BrowserRouter basename="/GPT">
            <AuthProvider>
                <ToastProvider>
                    <JournalProvider>
                        <App />
                    </JournalProvider>
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);

// Pas de service worker : CRA 5 n'en génère plus sans workbox-webpack-plugin.
// L'enregistrement précédent échouait silencieusement (nginx renvoyait index.html).
reportWebVitals();