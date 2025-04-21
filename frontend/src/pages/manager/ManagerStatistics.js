// In src/pages/manager/ManagerStatistics.js
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import AppLayout from '../../components/AppLayout';
import TeamHoursChart from '../../components/statistics/TeamHoursChart';
import RoleDistributionChart from '../../components/statistics/RoleDistributionChart';
import { statsAPI, userAPI } from '../../services/api';

const ManagerStatistics = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const usersRes = await userAPI.getUsers();
        setUsers(usersRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  return (
    <AppLayout title="Team Statistics">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Team Statistics
        </Typography>
        
        <FormControl sx={{ width: 200, mb: 3 }}>
          <InputLabel id="user-select-label">Select Employee</InputLabel>
          <Select
            labelId="user-select-label"
            id="user-select"
            value={selectedUser}
            label="Select Employee"
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <MenuItem value="all">All Employees</MenuItem>
            {users.map(user => (
              <MenuItem key={user.id} value={user.id}>
                {user.name}
              </MenuItem>
            ))}
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
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <TeamHoursChart userId={selectedUser} />
          </Grid>
          
          <Grid item xs={12} lg={4}>
            <RoleDistributionChart userId={selectedUser} />
          </Grid>
          
          {/* Add more statistics components here */}
        </Grid>
      )}
    </AppLayout>
  );
};

export default ManagerStatistics;