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
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { statsAPI } from '../../services/api';

const RoleDistributionChart = ({ userId }) => {
  const [period, setPeriod] = useState('month');
  const [distributionData, setDistributionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Get role distribution data
        const response = await statsAPI.getRoleDistribution({ period });
        
        // Process data based on whether we're looking at all employees or a specific one
        if (userId && userId !== 'all') {
          // Filter for the specific employee
          const employeeData = response.data.employees.find(emp => emp.id === parseInt(userId));
          
          if (employeeData) {
            // Format role data for this employee
            const formattedData = employeeData.roles.map(role => ({
              name: role.name,
              value: role.hours
            }));
            
            setDistributionData(formattedData);
          } else {
            setDistributionData([]);
          }
        } else {
          // Aggregate data for all employees
          const roleMap = {};
          
          // Combine hours across all employees by role
          response.data.employees.forEach(employee => {
            employee.roles.forEach(role => {
              if (!roleMap[role.id]) {
                roleMap[role.id] = { name: role.name, value: 0 };
              }
              roleMap[role.id].value += role.hours;
            });
          });
          
          // Convert map to array
          const formattedData = Object.values(roleMap);
          setDistributionData(formattedData);
        }
      } catch (err) {
        console.error('Error fetching role distribution data:', err);
        setError('Failed to load role distribution data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId, period]);
  
  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
  };
  
  // Colors for the pie chart
  const COLORS = ['#1976d2', '#dc004e', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#f44336', '#3f51b5'];
  
  // Custom tooltip for the pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{ bgcolor: 'background.paper', p: 1, border: '1px solid #ccc' }}>
          <Typography variant="body2">{`${payload[0].name}: ${payload[0].value.toFixed(1)} hrs`}</Typography>
        </Box>
      );
    }
    return null;
  };
  
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Role Distribution</Typography>
        
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
      ) : distributionData && distributionData.length > 0 ? (
        <Box sx={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
          No role distribution data available for this period.
        </Typography>
      )}
    </Paper>
  );
};

export default RoleDistributionChart;