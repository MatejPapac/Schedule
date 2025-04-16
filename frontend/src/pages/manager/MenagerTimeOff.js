import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Tab,
  Tabs
} from '@mui/material';
import {
  Check as ApproveIcon,
  Close as DenyIcon,
  CalendarMonth as CalendarIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import AppLayout from '../../components/AppLayout';
import { timeOffAPI, userAPI, scheduleAPI } from '../../services/api';

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`timeoff-tabpanel-${index}`}
      aria-labelledby={`timeoff-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ManagerTimeOff = () => {
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Response dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [responseStatus, setResponseStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Get data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Fetch all time off requests
        const timeOffRes = await timeOffAPI.getTimeOffRequests();
        
        // Fetch all users
        const usersRes = await userAPI.getUsers();
        setUsers(usersRes.data);
        
        // Combine data
        const formattedRequests = timeOffRes.data.map(request => {
          const user = usersRes.data.find(u => u.id === request.user_id);
          
          return {
            ...request,
            userName: user ? user.name : 'Unknown User'
          };
        });
        
        setTimeOffRequests(formattedRequests);
      } catch (err) {
        console.error('Error fetching time off requests:', err);
        setError('Failed to load time off requests. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Filter requests based on tab value
  const filteredRequests = timeOffRequests.filter(request => {
    if (tabValue === 0) return request.status === 'pending';
    if (tabValue === 1) return request.status === 'approved';
    if (tabValue === 2) return request.status === 'denied';
    return true;
  });
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handler for opening response dialog
  const handleRespondClick = (request, initialStatus) => {
    setSelectedRequest(request);
    setResponseStatus(initialStatus || 'approved');
    setDialogOpen(true);
  };
  
  // Handler for closing dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // Handler for submitting response
  const handleSubmitResponse = async () => {
    if (!selectedRequest || !responseStatus) return;
    
    setSubmitting(true);
    
    try {
      await timeOffAPI.respondToTimeOffRequest(selectedRequest.id, {
        id: selectedRequest.id,
        status: responseStatus
      });
      
      // Close dialog and refresh data
      handleCloseDialog();
      
      // Refresh time off requests
      const timeOffRes = await timeOffAPI.getTimeOffRequests();
      
      // Combine data with users
      const formattedRequests = timeOffRes.data.map(request => {
        const user = users.find(u => u.id === request.user_id);
        
        return {
          ...request,
          userName: user ? user.name : 'Unknown User'
        };
      });
      
      setTimeOffRequests(formattedRequests);
    } catch (err) {
      console.error('Error responding to time off request:', err);
      setError('Failed to respond to time off request.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Function to get status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'denied':
        return 'error';
      default:
        return 'warning';
    }
  };
  
  // Format duration nicely
  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = Math.abs(end - start);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}${diffHours > 0 ? `, ${diffHours} hour${diffHours > 1 ? 's' : ''}` : ''}`;
    }
    
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  };
  
  // Check if a request conflicts with existing schedules
  const checkScheduleConflicts = async (request) => {
    try {
      // Get shifts for this user during the requested time off
      const shifts = await scheduleAPI.getUserSchedule(request.user_id, {
        start_time: request.start_time,
        end_time: request.end_time
      });
      
      return shifts.data.length > 0;
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      return false;
    }
  };
  
  // Handler for viewing employee schedule during requested time off
  const handleViewSchedule = async (request) => {
    // This would ideally navigate to the schedule view with appropriate filters
    // For now, just alert if there are schedule conflicts
    try {
      setLoading(true);
      const hasConflicts = await checkScheduleConflicts(request);
      
      if (hasConflicts) {
        alert(`Warning: ${request.userName} is scheduled to work during this time off period.`);
      } else {
        alert(`${request.userName} has no scheduled shifts during this time off period.`);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking schedule:', error);
      setLoading(false);
    }
  };
  
  return (
    <AppLayout title="Time Off Requests">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Time Off Requests
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="time off request tabs">
            <Tab label={`Pending (${timeOffRequests.filter(r => r.status === 'pending').length})`} />
            <Tab label={`Approved (${timeOffRequests.filter(r => r.status === 'approved').length})`} />
            <Tab label={`Denied (${timeOffRequests.filter(r => r.status === 'denied').length})`} />
          </Tabs>
        </Box>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TabPanel value={tabValue} index={tabValue}>
          {filteredRequests.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Requested On</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.userName}</TableCell>
                      <TableCell>{format(new Date(request.start_time), 'PPp')}</TableCell>
                      <TableCell>{format(new Date(request.end_time), 'PPp')}</TableCell>
                      <TableCell>{formatDuration(request.start_time, request.end_time)}</TableCell>
                      <TableCell>{request.reason || '—'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={request.status.charAt(0).toUpperCase() + request.status.slice(1)} 
                          color={getStatusColor(request.status)} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{format(new Date(request.requested_at), 'PP')}</TableCell>
                      <TableCell>
                        {request.status === 'pending' && (
                          <>
                            <IconButton 
                              color="success" 
                              onClick={() => handleRespondClick(request, 'approved')}
                              title="Approve"
                            >
                              <ApproveIcon />
                            </IconButton>
                            <IconButton 
                              color="error" 
                              onClick={() => handleRespondClick(request, 'denied')}
                              title="Deny"
                            >
                              <DenyIcon />
                            </IconButton>
                          </>
                        )}
                        <IconButton 
                          color="primary" 
                          onClick={() => handleViewSchedule(request)}
                          title="View Schedule Conflicts"
                        >
                          <CalendarIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography>
                No {tabValue === 0 ? 'pending' : tabValue === 1 ? 'approved' : 'denied'} time off requests found.
              </Typography>
            </Paper>
          )}
        </TabPanel>
      )}
      
      {/* Response Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>
          {responseStatus === 'approved' ? 'Approve' : 'Deny'} Time Off Request
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box>
              <Typography variant="body1" gutterBottom>
                <strong>Employee:</strong> {selectedRequest.userName}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Period:</strong> {format(new Date(selectedRequest.start_time), 'PPp')} to {format(new Date(selectedRequest.end_time), 'PPp')}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Duration:</strong> {formatDuration(selectedRequest.start_time, selectedRequest.end_time)}
              </Typography>
              {selectedRequest.reason && (
                <Typography variant="body1" gutterBottom>
                  <strong>Reason:</strong> {selectedRequest.reason}
                </Typography>
              )}
              
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel id="response-status-label">Response</InputLabel>
                <Select
                  labelId="response-status-label"
                  id="response-status"
                  value={responseStatus}
                  label="Response"
                  onChange={(e) => setResponseStatus(e.target.value)}
                >
                  <MenuItem value="approved">Approve</MenuItem>
                  <MenuItem value="denied">Deny</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmitResponse} 
            variant="contained" 
            color={responseStatus === 'approved' ? 'success' : 'error'}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : responseStatus === 'approved' ? 'Approve' : 'Deny'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
};

export default ManagerTimeOff;