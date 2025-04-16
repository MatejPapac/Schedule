import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay, addMonths } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import AppLayout from '../../components/AppLayout';
import { scheduleAPI, userAPI, roleAPI, timeOffAPI } from '../../services/api';


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

const ManagerSchedule = () => {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewPeriod, setViewPeriod] = useState('current');
  
  // Selected filters
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  
  // New shift dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftUser, setShiftUser] = useState('');
  const [shiftRole, setShiftRole] = useState('');
  const [shiftStart, setShiftStart] = useState(null);
  const [shiftEnd, setShiftEnd] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
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
  
  // Fetch shifts, users, roles, and time off data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        const { startDate, endDate } = getDateRange();
        
        // Fetch all users
        const usersRes = await userAPI.getUsers();
        setUsers(usersRes.data);
        
        // Fetch all roles
        const rolesRes = await roleAPI.getRoles();
        setRoles(rolesRes.data);
        
        // Fetch all approved time off requests
        const timeOffRes = await timeOffAPI.getTimeOffRequests({ status: 'approved' });
        setTimeOffRequests(timeOffRes.data);
        
        // Fetch shifts with filters
        let params = {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString()
        };
        
        if (selectedUser !== 'all') {
          params.user_id = selectedUser;
        }
        
        if (selectedRole !== 'all') {
          params.role_id = selectedRole;
        }
        
        const shiftsRes = await scheduleAPI.getFullSchedule(params);
        
        // Transform shifts data for the calendar
        const formattedShifts = shiftsRes.data.map(shift => {
          const user = usersRes.data.find(u => u.id === shift.user_id);
          const role = rolesRes.data.find(r => r.id === shift.role_id);
          
          return {
            id: shift.id,
            title: `${user ? user.name : 'Unknown'} - ${role ? role.name : 'Unknown Role'}`,
            start: new Date(shift.start_time),
            end: new Date(shift.end_time),
            userId: shift.user_id,
            roleId: shift.role_id,
            user: user,
            role: role
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
    
    fetchData();
  }, [viewPeriod, selectedUser, selectedRole]);
  
  // Custom event component to show shift details
  const EventComponent = ({ event }) => {
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
  
  // Handle user filter change
  const handleUserFilterChange = (event) => {
    setSelectedUser(event.target.value);
  };
  
  // Handle role filter change
  const handleRoleFilterChange = (event) => {
    setSelectedRole(event.target.value);
  };
  
  // Handle opening new shift dialog
  const handleNewShift = () => {
    setEditingShift(null);
    setShiftUser(users.length > 0 ? users[0].id : '');
    setShiftRole('');
    setShiftStart(new Date());
    setShiftEnd(new Date(new Date().getTime() + 4 * 60 * 60 * 1000)); // 4 hours later
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handle opening edit shift dialog
  const handleEditShift = (shift) => {
    setEditingShift(shift);
    setShiftUser(shift.userId);
    setShiftRole(shift.roleId);
    setShiftStart(shift.start);
    setShiftEnd(shift.end);
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handle opening delete shift dialog
  const handleDeleteShiftClick = () => {
    setDeleteDialogOpen(true);
  };
  
  // Handle clicking on an event
  const handleEventSelect = (event) => {
    handleEditShift(event);
  };
  
  // Handle closing the shift dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // Handle changing the selected user for a shift
  const handleShiftUserChange = (event) => {
    setShiftUser(event.target.value);
    // If the user changes, reset any form errors
    setFormError('');
    
    // Check user capabilities and update role selection if needed
    const user = users.find(u => u.id === parseInt(event.target.value));
    if (user && user.capable_roles && user.capable_roles.length > 0) {
      if (!user.capable_roles.includes(parseInt(shiftRole))) {
        setShiftRole(user.capable_roles[0]);
      }
    } else {
      setShiftRole('');
    }
  };
  
  // Handler for submitting a shift
  const handleSubmitShift = async () => {
    // Validate form
    if (!shiftUser || !shiftRole || !shiftStart || !shiftEnd) {
      setFormError('All fields are required');
      return;
    }
    
    if (shiftStart >= shiftEnd) {
      setFormError('End time must be after start time');
      return;
    }
    
    setFormError('');
    setSubmitting(true);
    
    try {
      const shiftData = {
        user_id: parseInt(shiftUser),
        role_id: parseInt(shiftRole),
        start_time: shiftStart.toISOString(),
        end_time: shiftEnd.toISOString()
      };
      
      if (editingShift) {
        // Update existing shift
        await scheduleAPI.updateShift(editingShift.id, shiftData);
      } else {
        // Create new shift
        await scheduleAPI.createShift(shiftData);
      }
      
      // Close dialog and refresh data
      handleCloseDialog();
      
      // Refresh shifts with current filters
      const { startDate, endDate } = getDateRange();
      let params = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString()
      };
      
      if (selectedUser !== 'all') {
        params.user_id = selectedUser;
      }
      
      if (selectedRole !== 'all') {
        params.role_id = selectedRole;
      }
      
      const shiftsRes = await scheduleAPI.getFullSchedule(params);
      
      // Transform shifts data for the calendar
      const formattedShifts = shiftsRes.data.map(shift => {
        const user = users.find(u => u.id === shift.user_id);
        const role = roles.find(r => r.id === shift.role_id);
        
        return {
          id: shift.id,
          title: `${user ? user.name : 'Unknown'} - ${role ? role.name : 'Unknown Role'}`,
          start: new Date(shift.start_time),
          end: new Date(shift.end_time),
          userId: shift.user_id,
          roleId: shift.role_id,
          user: user,
          role: role
        };
      });
      
      setShifts(formattedShifts);
    } catch (err) {
      console.error('Error saving shift:', err);
      setFormError(err.response?.data?.error || 'Failed to save shift');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handler for deleting a shift
  const handleDeleteShift = async () => {
    if (!editingShift) return;
    
    try {
      await scheduleAPI.deleteShift(editingShift.id);
      
      setDeleteDialogOpen(false);
      handleCloseDialog();
      
      // Refresh shifts with current filters
      const { startDate, endDate } = getDateRange();
      let params = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString()
      };
      
      if (selectedUser !== 'all') {
        params.user_id = selectedUser;
      }
      
      if (selectedRole !== 'all') {
        params.role_id = selectedRole;
      }
      
      const shiftsRes = await scheduleAPI.getFullSchedule(params);
      
      // Transform shifts data for the calendar
      const formattedShifts = shiftsRes.data.map(shift => {
        const user = users.find(u => u.id === shift.user_id);
        const role = roles.find(r => r.id === shift.role_id);
        
        return {
          id: shift.id,
          title: `${user ? user.name : 'Unknown'} - ${role ? role.name : 'Unknown Role'}`,
          start: new Date(shift.start_time),
          end: new Date(shift.end_time),
          userId: shift.user_id,
          roleId: shift.role_id,
          user: user,
          role: role
        };
      });
      
      setShifts(formattedShifts);
    } catch (err) {
      console.error('Error deleting shift:', err);
      setError('Failed to delete shift');
    }
  };
  
  // Check if a user has time off during the selected period
  const hasTimeOffDuring = (userId, start, end) => {
    return timeOffRequests.some(request => {
      if (request.user_id !== userId) return false;
      
      const requestStart = new Date(request.start_time);
      const requestEnd = new Date(request.end_time);
      
      return (
        (requestStart <= start && requestEnd > start) ||
        (requestStart < end && requestEnd >= end) ||
        (requestStart >= start && requestEnd <= end)
      );
    });
  };
  
  // Get role options for a user
  const getRoleOptionsForUser = (userId) => {
    const user = users.find(u => u.id === parseInt(userId));
    
    if (!user || !user.capable_roles || user.capable_roles.length === 0) {
      return roles;
    }
    
    return roles.filter(role => user.capable_roles.includes(role.id));
  };
  
  return (
    <AppLayout title="Schedule Management">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Schedule Management
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
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
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="user-filter-label">Filter by User</InputLabel>
              <Select
                labelId="user-filter-label"
                id="user-filter"
                value={selectedUser}
                label="Filter by User"
                onChange={handleUserFilterChange}
              >
                <MenuItem value="all">All Users</MenuItem>
                {users.map(user => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="role-filter-label">Filter by Role</InputLabel>
              <Select
                labelId="role-filter-label"
                id="role-filter"
                value={selectedRole}
                label="Filter by Role"
                onChange={handleRoleFilterChange}
              >
                <MenuItem value="all">All Roles</MenuItem>
                {roles.map(role => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Button 
              variant="contained" 
              fullWidth 
              onClick={handleNewShift}
              sx={{ height: '56px' }}
            >
              Add Shift
            </Button>
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
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
            onSelectEvent={handleEventSelect}
          />
        </Paper>
      )}
      
      {/* Shift Dialog */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingShift ? 'Edit Shift' : 'Add New Shift'}
          </DialogTitle>
          <DialogContent>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="shift-user-label">Employee</InputLabel>
                  <Select
                    labelId="shift-user-label"
                    id="shift-user"
                    value={shiftUser}
                    label="Employee"
                    onChange={handleShiftUserChange}
                  >
                    {users.filter(u => u.active).map(user => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="shift-role-label">Role</InputLabel>
                  <Select
                    labelId="shift-role-label"
                    id="shift-role"
                    value={shiftRole}
                    label="Role"
                    onChange={(e) => setShiftRole(e.target.value)}
                  >
                    {getRoleOptionsForUser(shiftUser).map(role => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Time"
                  value={shiftStart}
                  onChange={setShiftStart}
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      fullWidth: true,
                      margin: 'normal'
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Time"
                  value={shiftEnd}
                  onChange={setShiftEnd}
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      fullWidth: true,
                      margin: 'normal'
                    }
                  }}
                />
              </Grid>
              
              {/* Time Off Warning */}
              {shiftUser && shiftStart && shiftEnd && hasTimeOffDuring(parseInt(shiftUser), shiftStart, shiftEnd) && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    This employee has approved time off during this period!
                  </Alert>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            {editingShift && (
              <Button 
                onClick={handleDeleteShiftClick} 
                color="error"
                sx={{ mr: 'auto' }}
              >
                Delete
              </Button>
            )}
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmitShift} 
              variant="contained" 
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </LocalizationProvider>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this shift? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteShift} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
};

export default ManagerSchedule;