import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
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
  CircularProgress
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import AppLayout from '../../components/AppLayout';
import { shiftRequirementAPI, roleAPI } from '../../services/api';

const ManagerShiftRequirements = () => {
  const [requirements, setRequirements] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Requirement dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [dialogTitle, setDialogTitle] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Requirement form state
  const [selectedRole, setSelectedRole] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [employeeCount, setEmployeeCount] = useState(1);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requirementToDelete, setRequirementToDelete] = useState(null);
  
  // Fetch requirements and roles
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Get current date range (current and next month)
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        
        // Fetch all shift requirements
        const requirementsRes = await shiftRequirementAPI.getShiftRequirements({
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString()
        });
        
        // Fetch all roles
        const rolesRes = await roleAPI.getRoles();
        
        setRoles(rolesRes.data);
        
        // If we have roles, set the first one as default for new requirements
        if (rolesRes.data.length > 0) {
          setSelectedRole(rolesRes.data[0].id);
        }
        
        // Transform requirements data with role information
        const formattedRequirements = requirementsRes.data.map(req => {
          const role = rolesRes.data.find(r => r.id === req.role_id);
          
          return {
            ...req,
            role: role ? role.name : 'Unknown Role'
          };
        });
        
        setRequirements(formattedRequirements);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Handler for opening the new requirement dialog
  const handleNewRequirement = () => {
    setEditingRequirement(null);
    setDialogTitle('Add New Shift Requirement');
    
    // Default to first role if available
    setSelectedRole(roles.length > 0 ? roles[0].id : '');
    
    // Default times (today at 9 AM to 5 PM)
    const today = new Date();
    const start = new Date(today.setHours(9, 0, 0, 0));
    const end = new Date(today.setHours(17, 0, 0, 0));
    
    setStartTime(start);
    setEndTime(end);
    setEmployeeCount(1);
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for opening the edit requirement dialog
  const handleEditRequirement = (requirement) => {
    setEditingRequirement(requirement);
    setDialogTitle('Edit Shift Requirement');
    setSelectedRole(requirement.role_id);
    setStartTime(new Date(requirement.start_time));
    setEndTime(new Date(requirement.end_time));
    setEmployeeCount(requirement.employee_count);
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for closing the requirement dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // Handler for submitting the requirement form
  const handleSubmitRequirement = async () => {
    // Validate form
    if (!selectedRole || !startTime || !endTime || !employeeCount) {
      setFormError('All fields are required');
      return;
    }
    
    if (startTime >= endTime) {
      setFormError('End time must be after start time');
      return;
    }
    
    if (employeeCount < 1) {
      setFormError('Employee count must be at least 1');
      return;
    }
    
    setFormError('');
    setSubmitting(true);
    
    try {
      const requirementData = {
        role_id: parseInt(selectedRole),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        employee_count: parseInt(employeeCount)
      };
      
      if (editingRequirement) {
        // Update existing requirement
        await shiftRequirementAPI.updateShiftRequirement(editingRequirement.id, requirementData);
      } else {
        // Create new requirement
        await shiftRequirementAPI.createShiftRequirement(requirementData);
      }
      
      // Close dialog and refresh data
      handleCloseDialog();
      
      // Get current date range (current and next month)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      
      // Refresh requirements
      const requirementsRes = await shiftRequirementAPI.getShiftRequirements({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString()
      });
      
      // Transform requirements data with role information
      const formattedRequirements = requirementsRes.data.map(req => {
        const role = roles.find(r => r.id === req.role_id);
        
        return {
          ...req,
          role: role ? role.name : 'Unknown Role'
        };
      });
      
      setRequirements(formattedRequirements);
    } catch (err) {
      console.error('Error saving requirement:', err);
      setFormError(err.response?.data?.error || 'Failed to save requirement');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handler for opening delete confirmation dialog
  const handleDeleteClick = (requirement) => {
    setRequirementToDelete(requirement);
    setDeleteDialogOpen(true);
  };
  
  // Handler for confirming requirement deletion
  const handleDeleteConfirm = async () => {
    if (!requirementToDelete) return;
    
    try {
      await shiftRequirementAPI.deleteShiftRequirement(requirementToDelete.id);
      
      setDeleteDialogOpen(false);
      setRequirementToDelete(null);
      
      // Get current date range (current and next month)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      
      // Refresh requirements
      const requirementsRes = await shiftRequirementAPI.getShiftRequirements({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString()
      });
      
      // Transform requirements data with role information
      const formattedRequirements = requirementsRes.data.map(req => {
        const role = roles.find(r => r.id === req.role_id);
        
        return {
          ...req,
          role: role ? role.name : 'Unknown Role'
        };
      });
      
      setRequirements(formattedRequirements);
    } catch (err) {
      console.error('Error deleting requirement:', err);
      setError('Failed to delete requirement');
    }
  };
  
  return (
    <AppLayout title="Shift Requirements">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Shift Requirements
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Define the number of employees needed for each role during specific periods. 
          These requirements will be used when generating the schedule.
        </Alert>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewRequirement}
          sx={{ mb: 3 }}
          disabled={roles.length === 0}
        >
          Add New Requirement
        </Button>
        
        {roles.length === 0 && !loading && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            You need to create at least one role before adding shift requirements.
          </Alert>
        )}
        
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
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Role</TableCell>
                <TableCell>Start Time</TableCell>
                <TableCell>End Time</TableCell>
                <TableCell>Employees Required</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requirements.length > 0 ? (
                requirements.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.role}</TableCell>
                    <TableCell>{format(new Date(req.start_time), 'PPp')}</TableCell>
                    <TableCell>{format(new Date(req.end_time), 'PPp')}</TableCell>
                    <TableCell>{req.employee_count}</TableCell>
                    <TableCell>
                      <IconButton 
                        color="primary" 
                        onClick={() => handleEditRequirement(req)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteClick(req)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No shift requirements found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Requirement Dialog */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogContent>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="role-select-label">Role</InputLabel>
                  <Select
                    labelId="role-select-label"
                    id="role-select"
                    value={selectedRole}
                    label="Role"
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={roles.length === 0}
                  >
                    {roles.map(role => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Employees Required"
                  type="number"
                  fullWidth
                  required
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  slotProps={{
                    input:{ min:1 }
                  }}
                  sx={{ mb: 2 }}
                />
              </Grid>
              
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
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmitRequirement} 
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
            Are you sure you want to delete this shift requirement? This action cannot be undone.
          </Typography>
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

export default ManagerShiftRequirements;