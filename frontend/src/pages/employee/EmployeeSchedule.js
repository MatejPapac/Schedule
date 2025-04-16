import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Alert, 
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay, addMonths } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { scheduleAPI, roleAPI } from '../../services/api';

// Setup localizer for the calendar
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const EmployeeSchedule = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewPeriod, setViewPeriod] = useState('current');
  
  // Calculate date ranges based on the selected view period
  const getDateRange = () => {
    const now = new Date();
    
    // Start date is always the beginning of the current month
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let endDate;
    if (viewPeriod === 'current') {
      // End of current month
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (viewPeriod === 'next') {
      // Start from next month, show one month
      const nextMonth = addMonths(startDate, 1);
      endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
    } else if (viewPeriod === 'both') {
      // Show current and next month
      const nextMonth = addMonths(startDate, 2);
      endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 0);
    }
    
    return { startDate, endDate };
  };
  
  // Fetch shifts and roles data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        const { startDate, endDate } = getDateRange();
        
        // Fetch shifts for the employee
        const shiftsRes = await scheduleAPI.getUserSchedule(user.id, {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString()
        });
        
        // Fetch all roles to get their names
        const rolesRes = await roleAPI.getRoles();
        
        // Save roles data
        setRoles(rolesRes.data);
        
        // Transform shifts data for the calendar
        const formattedShifts = shiftsRes.data.map(shift => {
          const role = rolesRes.data.find(role => role.id === shift.role_id);
          
          return {
            id: shift.id,
            title: role ? role.name : 'Unknown Role',
            start: new Date(shift.start_time),
            end: new Date(shift.end_time),
            roleId: shift.role_id
          };
        });
        
        setShifts(formattedShifts);
      } catch (err) {
        console.error('Error fetching schedule data:', err);
        setError('Failed to load schedule. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchData();
    }
  }, [user, viewPeriod]);
  
  // Custom event component to show shift details
  const EventComponent = ({ event }) => {
    const role = roles.find(r => r.id === event.roleId);
    
    return (
      <div>
        <strong>{event.title}</strong>
        <p>{format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}</p>
      </div>
    );
  };
  
  // Handle view period change
  const handleViewPeriodChange = (event) => {
    setViewPeriod(event.target.value);
  };
  
  return (
    <AppLayout title="My Schedule">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Schedule
        </Typography>
        
        <FormControl sx={{ width: 200, mb: 3 }}>
          <InputLabel id="view-period-label">View Period</InputLabel>
          <Select
            labelId="view-period-label"
            id="view-period"
            value={viewPeriod}
            label="View Period"
            onChange={handleViewPeriodChange}
          >
            <MenuItem value="current">Current Month</MenuItem>
            <MenuItem value="next">Next Month</MenuItem>
            <MenuItem value="both">Current & Next Month</MenuItem>
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
        <Paper sx={{ p: 2, height: 600 }}>
          <Calendar
            localizer={localizer}
            events={shifts}
            startAccessor="start"
            endAccessor="end"
            components={{
              event: EventComponent
            }}
            views={['month', 'week', 'day']}
            defaultView="week"
            defaultDate={new Date()}
            style={{ height: '100%' }}
          />
        </Paper>
      )}
    </AppLayout>
  );
};

export default EmployeeSchedule;