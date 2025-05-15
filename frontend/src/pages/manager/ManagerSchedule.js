import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button,
  Grid,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  styled
} from '@mui/material';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { scheduleAPI, userAPI, roleAPI, timeOffAPI } from '../../services/api';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// Role colors - matching the example
const roleColors = {
  'Barista': '#4285F4',  // Blue
  'All-around': '#34A853', // Green
  'Till': '#FBBC05', // Yellow
  default: '#9E9E9E' // Grey (default)
};

// Custom styled components for the calendar
const CalendarHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1, 0)
}));

const DayHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  textAlign: 'center',
  borderBottom: '1px solid #e0e0e0',
  backgroundColor: theme.palette.background.paper,
  height: '60px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center'
}));

const TimeColumn = styled(Box)(({ theme }) => ({
  width: '80px',
  borderRight: '1px solid #e0e0e0',
  '& > div': {
    height: '60px',
    padding: theme.spacing(1),
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}));

const DayColumn = styled(Box)(({ theme }) => ({
  flex: 1,
  borderRight: '1px solid #e0e0e0',
  '&:last-child': {
    borderRight: 'none'
  }
}));

const TimeSlot = styled(Box)(({ theme }) => ({
  height: '60px',
  borderBottom: '1px solid #f0f0f0',
  position: 'relative'
}));

const ShiftBlock = styled(Box)(({ theme, color }) => ({
  backgroundColor: color || roleColors.default,
  color: 'white',
  borderRadius: '4px',
  padding: theme.spacing(0.5),
  position: 'absolute',
  width: 'calc(100% - 8px)',
  left: '4px',
  overflow: 'hidden',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)',
  '&:hover': {
    boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
  }
}));

const FilterSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  flexWrap: 'wrap',
  alignItems: 'center'
}));

const ViewToggleButton = styled(Button)(({ theme, active }) => ({
  backgroundColor: active ? theme.palette.primary.main : 'transparent',
  color: active ? 'white' : theme.palette.primary.main,
  fontWeight: active ? 'bold' : 'normal',
  '&:hover': {
    backgroundColor: active ? theme.palette.primary.dark : theme.palette.action.hover,
  }
}));

const ModernScheduleManager = () => {
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState(startOfWeek(new Date()));
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected filters
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  
  // Dialog states
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
  
  // Calculate the week based on current date
  useEffect(() => {
    setStartDate(startOfWeek(currentDate));
  }, [currentDate]);
  
  // Fetch shifts, users, roles, and time off data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Dates for the current view
        const endDate = addDays(startDate, 6);
        
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
            role: role,
            roleName: role ? role.name : 'Unknown Role',
            userName: user ? user.name : 'Unknown'
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
  }, [startDate, selectedUser, selectedRole]);
  
  // Navigate to previous week
  const handlePrevWeek = () => {
    setCurrentDate(prevDate => addDays(prevDate, -7));
  };
  
  // Navigate to next week
  const handleNextWeek = () => {
    setCurrentDate(prevDate => addDays(prevDate, 7));
  };
  
  // Navigate to today
  const handleToday = () => {
    setCurrentDate(new Date());
  };
  
  // Handle view mode change
  const handleViewChange = (mode) => {
    setViewMode(mode);
  };
  
  // Handle user filter change
  const handleUserFilterChange = (event) => {
    setSelectedUser(event.target.value);
  };
  
  // Handle role filter change
  const handleRoleFilterChange = (event) => {
    setSelectedRole(event.target.value);
  };
  
  // Calculate time slot position and height
  const calculateShiftPosition = (start, end) => {
    // Time starts at 3am in our example
    const dayStart = 3; // 3:00 AM
    
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    
    // Calculate position from top (each hour is 60px height)
    const top = (startHour - dayStart) * 60;
    // Calculate height (duration in hours * 60px)
    const height = (endHour - startHour) * 60;
    
    return { top, height };
  };
  
  // Check if a shift belongs to a specific day
  const isShiftOnDay = (shift, day) => {
    return isSameDay(shift.start, day);
  };
  
  // Get a role's color
  const getRoleColor = (roleName) => {
    return roleColors[roleName] || roleColors.default;
  };
  
  // Handle opening new shift dialog
  const handleAddShift = () => {
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
  
  // Generate time slots for the day view
  const generateTimeSlots = () => {
    const slots = [];
    // Starting from 3:00 AM to 3:00 PM as in the example
    for (let hour = 3; hour <= 15; hour++) {
      slots.push(
        <Box key={hour} sx={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
          <TimeColumn>
            <div>{hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}</div>
          </TimeColumn>
          
          {Array.from({ length: 7 }).map((_, index) => {
            const day = addDays(startDate, index);
            return <TimeSlot key={index} />;
          })}
        </Box>
      );
    }
    return slots;
  };
  
  // Render the weekly calendar view
  const renderWeekView = () => {
    const days = Array.from({ length: 7 }).map((_, index) => addDays(startDate, index));
    
    return (
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
        {/* Calendar header with days */}
        <Box sx={{ display: 'flex' }}>
          <Box sx={{ width: '80px', borderRight: '1px solid #e0e0e0' }}></Box>
          {days.map((day, index) => (
            <DayHeader key={index}>
              <Typography variant="body2" color="textSecondary">
                {format(day, 'dd EEE')}
              </Typography>
            </DayHeader>
          ))}
        </Box>
        
        {/* Time slots with shifts */}
        <Box sx={{ height: '600px', overflowY: 'auto' }}>
          {/* Time slots */}
          {generateTimeSlots()}
          
          {/* Shifts */}
          {shifts.map(shift => {
            const dayIndex = days.findIndex(day => isShiftOnDay(shift, day));
            if (dayIndex === -1) return null;
            
            const { top, height } = calculateShiftPosition(shift.start, shift.end);
            
            return (
              <ShiftBlock
                key={shift.id}
                color={getRoleColor(shift.roleName)}
                sx={{
                  top: `${top}px`,
                  height: `${height}px`,
                  left: `${dayIndex * (100 / 7) + 80 / 6}%`,
                  width: `calc(${100 / 7}% - 8px)`,
                }}
                onClick={() => handleEditShift(shift)}
              >
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  {format(shift.start, 'h:mm a')} - {format(shift.end, 'h:mm a')}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {shift.userName}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {shift.roleName}
                </Typography>
              </ShiftBlock>
            );
          })}
        </Box>
      </Box>
    );
  };
  
  return (
    <Box sx={{ bgcolor: '#f9f9f9', minHeight: '100vh' }}>
      {/* Top navigation bar */}
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Schedule Management
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            Admin User
          </Typography>
          <Button color="inherit">LOGOUT</Button>
        </Toolbar>
      </AppBar>
      
      {/* Main content */}
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <Box sx={{ width: '200px', bgcolor: '#fff', borderRight: '1px solid #e0e0e0', p: 2 }}>
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Schedule Manager
            </Typography>
          </Box>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1 }}
            startIcon={<Box sx={{ width: 24 }}><img src="/dashboard-icon.svg" alt="" width="18" /></Box>}
          >
            Dashboard
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1, bgcolor: 'rgba(25, 118, 210, 0.08)' }}
            startIcon={<Box sx={{ width: 24 }}><img src="/schedule-icon.svg" alt="" width="18" /></Box>}
          >
            Schedule
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1 }}
            startIcon={<Box sx={{ width: 24 }}><img src="/generate-icon.svg" alt="" width="18" /></Box>}
          >
            Generate Schedule
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1 }}
            startIcon={<Box sx={{ width: 24 }}><img src="/users-icon.svg" alt="" width="18" /></Box>}
          >
            Users
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1 }}
            startIcon={<Box sx={{ width: 24 }}><img src="/roles-icon.svg" alt="" width="18" /></Box>}
          >
            Roles
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1 }}
            startIcon={<Box sx={{ width: 24 }}><img src="/requirements-icon.svg" alt="" width="18" /></Box>}
          >
            Shift Requirements
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1 }}
            startIcon={<Box sx={{ width: 24 }}><img src="/recurring-icon.svg" alt="" width="18" /></Box>}
          >
            Recurring Shifts
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1 }}
            startIcon={<Box sx={{ width: 24 }}><img src="/timeoff-icon.svg" alt="" width="18" /></Box>}
          >
            Time Off Requests
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            sx={{ justifyContent: 'flex-start', mb: 1, py: 1, mt: 'auto' }}
            startIcon={<Box sx={{ width: 24 }}><img src="/logout-icon.svg" alt="" width="18" /></Box>}
          >
            Logout
          </Button>
        </Box>
        
        {/* Main schedule area */}
        <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
          <Typography variant="h5" sx={{ mb: 3 }}>
            Schedule Management
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {/* Filter and control bar */}
          <FilterSection>
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                View Period
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value="current"
                  displayEmpty
                >
                  <MenuItem value="current">Current Month</MenuItem>
                  <MenuItem value="next">Next Month</MenuItem>
                  <MenuItem value="both">Current & Next</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                Filter by User
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={selectedUser}
                  onChange={handleUserFilterChange}
                  displayEmpty
                >
                  <MenuItem value="all">All Users</MenuItem>
                  {users.map(user => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                Filter by Role
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={selectedRole}
                  onChange={handleRoleFilterChange}
                  displayEmpty
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  {roles.map(role => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddShift}
              sx={{ height: '38px', ml: 'auto' }}
            >
              ADD SHIFT
            </Button>
          </FilterSection>
          
          {/* Date navigation and view toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={handlePrevWeek} size="small">
                <ArrowBackIosNewIcon fontSize="small" />
              </IconButton>
              
              <Button 
                variant="contained" 
                sx={{ mx: 1, textTransform: 'uppercase', fontSize: '0.75rem' }}
                onClick={handleToday}
              >
                TODAY
              </Button>
              
              <IconButton onClick={handleNextWeek} size="small">
                <ArrowForwardIosIcon fontSize="small" />
              </IconButton>
              
              <Typography variant="h6" sx={{ ml: 2 }}>
                May {format(startDate, 'dd')} – {format(addDays(startDate, 6), 'dd')}
              </Typography>
            </Box>
            
            <Box>
              <ViewToggleButton 
                onClick={() => handleViewChange('day')}
                active={viewMode === 'day'}
                variant="outlined"
                size="small"
                sx={{ borderRadius: '4px 0 0 4px' }}
              >
                DAY
              </ViewToggleButton>
              
              <ViewToggleButton 
                onClick={() => handleViewChange('week')}
                active={viewMode === 'week'}
                variant="outlined"
                size="small"
                sx={{ borderRadius: 0 }}
              >
                WEEK
              </ViewToggleButton>
              
              <ViewToggleButton 
                onClick={() => handleViewChange('month')}
                active={viewMode === 'month'}
                variant="outlined"
                size="small"
                sx={{ borderRadius: '0 4px 4px 0' }}
              >
                MONTH
              </ViewToggleButton>
            </Box>
          </Box>
          
          {/* Calendar view */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderWeekView()
          )}
          
          {/* Role legend */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            {Object.entries(roleColors).map(([role, color]) => (
              role !== 'default' && (
                <Box key={role} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: color
                    }}
                  />
                  <Typography variant="body2">{role}</Typography>
                </Box>
              )
            ))}
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: 'orange'
                }}
              />
              <Typography variant="body2">Time Off Conflict</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
      
      {/* Shift Dialog */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
                <FormControl fullWidth>
                  <Typography variant="caption" sx={{ mb: 0.5 }}>Employee</Typography>
                  <Select
                    value={shiftUser}
                    onChange={(e) => setShiftUser(e.target.value)}
                    size="small"
                  >
                    {users.filter(u => u.active).map(user => (
                      <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <Typography variant="caption" sx={{ mb: 0.5 }}>Role</Typography>
                  <Select
                    value={shiftRole}
                    onChange={(e) => setShiftRole(e.target.value)}
                    size="small"
                  >
                    {roles.map(role => (
                      <MenuItem key={role.id} value={role.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box 
                            sx={{ 
                              width: 12, 
                              height: 12, 
                              borderRadius: '50%',
                              backgroundColor: roleColors[role.name] || roleColors.default
                            }} 
                          />
                          {role.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>Start Time</Typography>
                <DateTimePicker
                  value={shiftStart}
                  onChange={setShiftStart}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>End Time</Typography>
                <DateTimePicker
                  value={shiftEnd}
                  onChange={setShiftEnd}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            {editingShift && (
              <Button 
                color="error"
                onClick={() => setDeleteDialogOpen(true)}
                sx={{ mr: 'auto' }}
              >
                Delete
              </Button>
            )}
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={() => {/* handleSubmitShift() */}}
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </LocalizationProvider>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this shift? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            color="error"
            variant="contained"
            onClick={() => {/* handleDeleteShift() */}}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ModernScheduleManager;