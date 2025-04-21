// In src/components/statistics/EmployeeHoursChart.js
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
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { statsAPI } from '../../services/api'; 

const EmployeeHoursChart = ({ userId }) => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('week');
  const [hoursData, setHoursData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        const response = await statsAPI.getUserHours(userId, { period });
        
        // Format data for chart
        const formattedData = response.data.daily_hours.map(item => ({
          date: format(parseISO(item.date), 'MMM dd'),
          hours: item.hours
        }));
        
        setHoursData({
          dailyData: formattedData,
          totalHours: response.data.total_hours
        });
      } catch (err) {
        console.error('Error fetching hours data:', err);
        setError('Failed to load hours data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId, period]);
  
  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
  };
  
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Work Hours</Typography>
        
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
      ) : hoursData ? (
        <>
          <Typography variant="h4" sx={{ mb: 2, textAlign: 'center' }}>
            {hoursData.totalHours} hrs
          </Typography>
          
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="hours" fill="#1976d2" name="Hours Worked" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </>
      ) : (
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
          No hours data available for this period.
        </Typography>
      )}
    </Paper>
  );
};

export default EmployeeHoursChart;