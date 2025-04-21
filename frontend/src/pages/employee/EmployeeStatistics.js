// In src/pages/employee/EmployeeStatistics.js
import React from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper,
  Card,
  CardContent
} from '@mui/material';
import AppLayout from '../../components/AppLayout';
import EmployeeHoursChart from '../../components/statistics/EmployeeHoursChart';
import { useAuth } from '../../context/AuthContext';

const EmployeeStatistics = () => {
  const { user } = useAuth();
  
  return (
    <AppLayout title="My Statistics">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Statistics
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          View your work hours and performance metrics
        </Typography>
      </Box>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <EmployeeHoursChart userId={user.id} />
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Summary
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Target Weekly Hours
                </Typography>
                <Typography variant="h5" gutterBottom>
                  {user.target_hours} hrs
                </Typography>
              </Box>
              
              {/* Add more summary statistics here */}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </AppLayout>
  );
};

export default EmployeeStatistics;