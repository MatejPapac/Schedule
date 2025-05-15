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
  MenuItem,
  useTheme
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

// Define role colors for the calendar
const roleColors = {
  1: '#4285F4', // Blue
  2: '#34A853', // Green
  3: '#FBBC05', // Yellow
  4: '#EA4335', // Red
  5: '#8E24AA', // Purple
  default: '#9E9E9E' // Grey (default)
};

const ModernEmployeeSchedule = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewPeriod, setViewPeriod] = useState('current');
  const theme = useTheme();
  
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
            roleId: shift.role_id,
            resource: role ? role.name : 'Unknown'
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
  
  // Custom event component to show shift details with role colors
  const EventComponent = ({ event }) => {
    const backgroundColor = roleColors[event.roleId] || roleColors.default;
    
    return (
      <div 
        style={{ 
          backgroundColor,
          color: '#fff',
          borderRadius: '4px',
          padding: '4px 8px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)'
        }}
      >
        <strong>{event.title}</strong>
        <span style={{ fontSize: '0.85rem' }}>
          {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
        </span>
      </div>
    );
  };
  
  // Handle view period change
  const handleViewPeriodChange = (event) => {
    setViewPeriod(event.target.value);
  };
  
  // Custom calendar styles
  const calendarStyles = {
    height: 600,
    '& .rbc-today': {
      backgroundColor: theme.palette.primary.light + '20', // Light version of primary color
    },
    '& .rbc-header': {
      padding: '10px 3px',
      fontWeight: 'bold',
      borderBottom: '1px solid #ddd'
    },
    '& .rbc-month-view': {
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #e0e0e0'
    },
    '& .rbc-day-bg': {
      transition: 'all 0.2s ease'
    },
    '& .rbc-day-bg:hover': {
      backgroundColor: theme.palette.grey[100]
    },
    '& .rbc-off-range-bg': {
      backgroundColor: theme.palette.grey[50]
    },
    '& .rbc-date-cell': {
      padding: '5px 10px',
      textAlign: 'center',
      fontWeight: 500
    },
    '& .rbc-event': {
      borderRadius: '4px',
      border: 'none',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
    }
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
        <Paper sx={{ p: 2, ...calendarStyles }}>
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
      
      {/* Legend for role colors */}
      <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {roles.map(role => (
          <Box 
            key={role.id} 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box 
              sx={{ 
                width: 16, 
                height: 16, 
                borderRadius: '50%',
                backgroundColor: roleColors[role.id] || roleColors.default
              }} 
            />
            <Typography variant="body2">{role.name}</Typography>
          </Box>
        ))}
      </Box>
    </AppLayout>
  );
};

export default ModernEmployeeSchedule;