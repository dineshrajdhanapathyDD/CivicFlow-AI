import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout.js';
import Dashboard from './pages/Dashboard.js';
import ReportForm from './pages/ReportForm.js';
import ReportDetails from './pages/ReportDetails.js';
import Issues from './pages/Issues.js';
import IssueDetails from './pages/IssueDetails.js';
import Ask from './pages/Ask.js';
import './index.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'report', element: <ReportForm /> },
      { path: 'report/:id', element: <ReportDetails /> },
      { path: 'issues', element: <Issues /> },
      { path: 'issues/:id', element: <IssueDetails /> },
      { path: 'ask', element: <Ask /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
