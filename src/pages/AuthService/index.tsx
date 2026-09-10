import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router';
import App from './App';

const root = createRoot(document.getElementById('app'));

root.render(
  <Router>
    <App />
  </Router>,
);
