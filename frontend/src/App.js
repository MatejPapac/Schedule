import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

// Import context providers
import { AuthProvider, useAuth } from './context/AuthContext';

// Import pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmployeeSchedule from './pages/employee/EmployeeSchedule';
import EmployeePreferences from './pages/employee/EmployeePreferences';
import EmployeeTimeOff from './pages/employee/EmployeeTimeOff';
import ManagerSchedule from './pages/manager/ManagerSchedule';
import ManagerGenerateSchedule from './pages/manager/ManagerGenerateSchedule';
import ManagerUsers from './pages/manager/ManagerUsers';
import ManagerRoles from './pages/manager/ManagerRoles';
import ManagerShiftRequirements from './pages/manager/ManagerShiftRequirements';
import ManagerTimeOff from './pages/manager/ManagerTimeOff';
import NotFound from './pages/NotFound';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Protected route component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && user.user_type !== requiredRole) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* Employee Routes */}
            <Route path="/schedule" element={
              <ProtectedRoute>
                <EmployeeSchedule />
              </ProtectedRoute>
            } />
            
            <Route path="/preferences" element={
              <ProtectedRoute>
                <EmployeePreferences />
              </ProtectedRoute>
            } />
            
            <Route path="/time-off" element={
              <ProtectedRoute>
                <EmployeeTimeOff />
              </ProtectedRoute>
            } />
            
            {/* Manager Routes */}
            <Route path="/manager/schedule" element={
              <ProtectedRoute requiredRole="manager">
                <ManagerSchedule />
              </ProtectedRoute>
            } />
            
            <Route path="/manager/generate" element={
              <ProtectedRoute requiredRole="manager">
                <ManagerGenerateSchedule />
              </ProtectedRoute>
            } />
            
            <Route path="/manager/users" element={
              <ProtectedRoute requiredRole="manager">
                <ManagerUsers />
              </ProtectedRoute>
            } />
            
            <Route path="/manager/roles" element={
              <ProtectedRoute requiredRole="manager">
                <ManagerRoles />
              </ProtectedRoute>
            } />
            
            <Route path="/manager/requirements" element={
              <ProtectedRoute requiredRole="manager">
                <ManagerShiftRequirements />
              </ProtectedRoute>
            } />
            
            <Route path="/manager/time-off" element={
              <ProtectedRoute requiredRole="manager">
                <ManagerTimeOff />
              </ProtectedRoute>
            } />
            
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;