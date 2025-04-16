import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Grid, 
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format } from 'date-fns';
import { Delete as DeleteIcon } from '@mui/icons-material';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { timeOffAPI } from '../../services/api';

const EmployeeTimeOff = () => {
  const { user } = useAuth();
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New request form state
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  
  // Fetch time off requests
  const fetchTimeOffRequests = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await timeOffAPI.getTimeOffRequests();
      setTimeOffRequests(response.data);
    } catch (err) {
      console.error('Error fetching time off requests:', err);
      setError('Failed to load time off requests. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchTimeOffRequests();
    }
  }, [user]);
  
  // Handler for opening the new request dialog
  const handleClickOpen = () => {
    setOpen(true);
    setStartTime(null);
    setEndTime(null);
    setReason('');
    setFormError('');
  };
  
  // Handler for closing the new request dialog
  const handleClose = () => {
    setOpen(false);
  };
  
  // Handler for submitting a new time off request
  const handleSubmit = async () => {
    // Validate form
    if (!startTime || !endTime) {
      setFormError('Start and end times are required');
      return;
    }
    
    if (startTime >= endTime) {
      setFormError('End time must be after start time');
      return;
    }
    
    setFormError('');
    setSubmitting(true);
    
    try {
      await timeOffAPI.createTimeOffRequest({
        user_id: user.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        reason
      });
      
      // Close dialog and refresh data
      handleClose();
      await fetchTimeOffRequests();
    } catch (err) {
      console.error('Error creating time off request:', err);
      setFormError(err.response?.data?.error || 'Failed to create time off request');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handler for opening delete confirmation dialog
  const handleDeleteClick = (request) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };
  
  // Handler for confirming deletion
  const handleDeleteConfirm = async () => {
    if (!requestToDelete) return;
    
    try {
      await timeOffAPI.deleteTimeOffRequest(requestToDelete.id);
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
      await fetchTimeOffRequests();
    } catch (err) {
      console.error('Error deleting time off request:', err);
      setError('Failed to delete time off request');
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
  
  return (
    <AppLayout title="Time Off Requests">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Time Off Requests
        </Typography>
        <Button variant="contained" onClick={handleClickOpen}>
          Request Time Off
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Start Time</TableCell>
                <TableCell>End Time</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requested At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {timeOffRequests.length > 0 ? (
                timeOffRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{format(new Date(request.start_time), 'PPp')}</TableCell>
                    <TableCell>{format(new Date(request.end_time), 'PPp')}</TableCell>
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
                        <IconButton 
                          edge="end" 
                          aria-label="delete" 
                          onClick={() => handleDeleteClick(request)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No time off requests found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* New Request Dialog */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Request Time Off</DialogTitle>
          <DialogContent>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Time"
                  value={startTime}
                  onChange={setStartTime}
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
                  value={endTime}
                  onChange={setEndTime}
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      fullWidth: true,
                      margin: 'normal'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  autoFocus
                  margin="normal"
                  id="reason"
                  label="Reason (Optional)"
                  type="text"
                  fullWidth
                  multiline
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={24} /> : 'Submit'}
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
          <DialogContentText>
            Are you sure you want to delete this time off request? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
};

export default EmployeeTimeOff;