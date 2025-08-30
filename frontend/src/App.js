import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import DashboardPage from './components/DashboardPage';
import StudentDetailPage from './components/StudentDetailPage'; // Import the new page
import './App.css';

function App() {
  // A simple way to check for a token. In a real app, you might verify it.
  const token = localStorage.getItem('access_token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route 
          path="/dashboard" 
          element={token ? <DashboardPage /> : <Navigate to="/login" />} 
        />
        {/* ADD THE NEW ROUTE FOR STUDENT DETAILS */}
        <Route 
          path="/student/:studentId"
          element={token ? <StudentDetailPage /> : <Navigate to="/login" />}
        />
        {/* Default route redirects based on login status */}
        <Route 
          path="/" 
          element={<Navigate to={token ? "/dashboard" : "/login"} />} 
        />
      </Routes>
    </Router>
  );
}

export default App;