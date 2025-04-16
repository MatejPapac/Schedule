import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActions,
  Button,
  Box,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import { 
  CalendarToday as CalendarIcon,
  BeachAccess as TimeOffIcon,
  Group as UsersIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { scheduleAPI, timeOffAPI, userAPI } from '../services/api';
import { format } from 'date-fns';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.user_type === 'manager';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({
    upcomingShifts: [],
    pendingTimeOff: 0,
    totalUsers: 0,
    totalAssignedShifts: 0
  });
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Get upcoming shifts for the current user
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        const shiftsRes = isManager
          ? await scheduleAPI.getFullSchedule({
              start_time: today.toISOString(),
              end_time: nextWeek.toISOString()
            })
          : await scheduleAPI.getUserSchedule(user.id, {
              start_time: today.toISOString(),
              end_time: nextWeek.toISOString()
            });
        
        // For managers, get additional stats
        let pendingTimeOff = 0;
        let totalUsers = 0;
        
        if (isManager) {
          const timeOffRes = await timeOffAPI.getTimeOffRequests({ status: 'pending' });
          pendingTimeOff = timeOffRes.data.length;
          
          const usersRes = await userAPI.getUsers();
          totalUsers = usersRes.data.length;
        } else {
          const timeOffRes = await timeOffAPI.getTimeOffRequests();
          pendingTimeOff = timeOffRes.data.filter(req => req.status === 'pending').length;
        }
        
        setDashboardData({
          upcomingShifts: shiftsRes.data.slice(0, 5), // Show at most 5 upcoming shifts
          pendingTimeOff,
          totalUsers,
          totalAssignedShifts: shiftsRes.data.length
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchDashboardData();
    }
  }, [user, isManager]);
  
  const getCardContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      );
    }
    
    return (
      <Grid container spacing={3}>
        {/* Upcoming Shifts Card */}
        <Grid item xs={12} md={isManager ? 6 : 12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <CalendarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Upcoming Shifts
              </Typography>
              
              {dashboardData.upcomingShifts.length > 0 ? (
                dashboardData.upcomingShifts.map((shift, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 1 }}>
                    <Typography variant="body1">
                      {format(new Date(shift.start_time), 'EEEE, MMM d')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {`${format(new Date(shift.start_time), 'h:mm a')} - ${format(new Date(shift.end_time), 'h:mm a')}`}
                    </Typography>
                  </Paper>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No upcoming shifts scheduled.
                </Typography>
              )}
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate(isManager ? '/manager/schedule' : '/schedule')}
              >
                View Full Schedule
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* Time Off Requests Card */}
        <Grid item xs={12} md={isManager ? 6 : 12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TimeOffIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Time Off Requests
              </Typography>
              
              <Typography variant="body1">
                {dashboardData.pendingTimeOff} pending request{dashboardData.pendingTimeOff !== 1 ? 's' : ''}
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate(isManager ? '/manager/time-off' : '/time-off')}
              >
                Manage Time Off
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* Manager-specific Cards */}
        {isManager && (
          <>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <UsersIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Users
                  </Typography>
                  
                  <Typography variant="body1">
                    {dashboardData.totalUsers} total user{dashboardData.totalUsers !== 1 ? 's' : ''}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => navigate('/manager/users')}>
                    Manage Users
                  </Button>
                </CardActions>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Schedule Generation
                  </Typography>
                  
                  <Typography variant="body1">
                    {dashboardData.totalAssignedShifts} shift{dashboardData.totalAssignedShifts !== 1 ? 's' : ''} assigned
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => navigate('/manager/generate')}>
                    Generate Schedule
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </>
        )}
      </Grid>
    );
  };
  
  return (
    <AppLayout title="Dashboard">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {user?.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's your schedule overview
        </Typography>
      </Box>
      
      {getCardContent()}
    </AppLayout>
  );
};

export default Dashboard;