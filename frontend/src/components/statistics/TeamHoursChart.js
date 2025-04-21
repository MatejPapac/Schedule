import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { statsAPI, userAPI } from '../../services/api';

const TeamHoursChart = ({ userId }) => {
  const [period, setPeriod] = useState('week');
  const [userData, setUserData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // If a specific user is selected, get their data
        if (userId && userId !== 'all') {
          const response = await statsAPI.getUserHours(userId, { period });
          
          // Format data for chart
          const formattedData = response.data.daily_hours.map(item => ({
            date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            hours: item.hours
          }));
          
          setUserData([{
            id: userId,
            name: 'Selected Employee',
            data: formattedData,
            totalHours: response.data.total_hours
          }]);
        } else {
          // Get data for all users/roles if 'all' is selected
          const roleHoursResponse = await statsAPI.getRoleHours({ period });
          
          // Format role-based data
          const formattedRoles = roleHoursResponse.data.roles.map(role => ({
            name: role.name,
            hours: role.total_hours
          }));
          
          setUserData(formattedRoles);
        }
      } catch (err) {
        console.error('Error fetching team hours data:', err);
        setError('Failed to load team hours data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId, period]);
  
  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
  };
  
  const getBarColors = () => {
    const colors = ['#1976d2', '#dc004e', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];
    return userData.map((_, index) => colors[index % colors.length]);
  };
  
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Team Working Hours</Typography>
        
        <FormControl sx={{ width: 120 }}>
          <InputLabel id="period-select-label">Period</InputLabel>
          <Select
            labelId="period-select-label"
            id="period-select"
            value={period}
            label="Period"
            onChange={handlePeriodChange}
            size="small"
          >
            <MenuItem value="week">Week</MenuItem>
            <MenuItem value="month">Month</MenuItem>
            <MenuItem value="quarter">Quarter</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : userData && userData.length > 0 ? (
        <Box sx={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={userId === 'all' ? userData : userData[0].data} 
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={userId === 'all' ? "name" : "date"} />
              <YAxis />
              <Tooltip />
              <Legend />
              {userId === 'all' ? (
                <Bar dataKey="hours" name="Total Hours" fill="#1976d2" />
              ) : (
                <Bar dataKey="hours" name="Hours Worked" fill="#1976d2" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
          No hours data available for this period.
        </Typography>
      )}
    </Paper>
  );
};

export default TeamHoursChart;