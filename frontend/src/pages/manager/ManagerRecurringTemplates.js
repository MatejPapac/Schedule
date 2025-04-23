import React, { useState, useEffect } from 'react';
import { 
    DatePicker 
  } from '@mui/x-date-pickers/DatePicker';
  import {
    List,
    ListItem,
    ListItemText
  } from '@mui/material';
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
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as GenerateIcon
} from '@mui/icons-material';
import AppLayout from '../../components/AppLayout';
import { recurringTemplateAPI, roleAPI } from '../../services/api';
import { format, parseISO, addDays, addMonths, isBefore } from 'date-fns';

// GenerateShiftsDialog component defined inline
const GenerateShiftsDialog = ({ open, onClose, templates, roles }) => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(addDays(new Date(), 6)); // Default to a week
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [generationStep, setGenerationStep] = useState(1); // 1: select options, 2: results
  const [selectAll, setSelectAll] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generationResults, setGenerationResults] = useState(null);
  
  // Initialize selectedTemplates with all template ids when the component mounts
  useEffect(() => {
    if (templates && templates.length > 0) {
      setSelectedTemplates(templates.map(template => template.id));
    }
  }, [templates]);
  
  // Handle template selection changes
  const handleTemplateSelectionChange = (templateId) => {
    if (selectedTemplates.includes(templateId)) {
      setSelectedTemplates(selectedTemplates.filter(id => id !== templateId));
    } else {
      setSelectedTemplates([...selectedTemplates, templateId]);
    }
  };
  
  // Handle select all change
  const handleSelectAllChange = (event) => {
    setSelectAll(event.target.checked);
    if (event.target.checked) {
      // Select all templates
      setSelectedTemplates(templates.map(template => template.id));
    } else {
      // Deselect all
      setSelectedTemplates([]);
    }
  };
  
  // Handle date range changes
  const handleStartDateChange = (date) => {
    setStartDate(date);
    // If end date is now before start date, update it
    if (isBefore(endDate, date)) {
      setEndDate(addDays(date, 6)); // Default to a week from start date
    }
  };
  
  // Handle preset date selection
  const handlePresetDateRange = (range) => {
    const today = new Date();
    
    switch (range) {
      case 'week':
        setStartDate(today);
        setEndDate(addDays(today, 6));
        break;
      case 'twoWeeks':
        setStartDate(today);
        setEndDate(addDays(today, 13));
        break;
      case 'month':
        setStartDate(today);
        setEndDate(addDays(addMonths(today, 1), -1));
        break;
      default:
        break;
    }
  };
  
  // Get role name by ID
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Unknown Role';
  };
  
  // Format days as a string
  const formatDays = (template) => {
    const dayNames = [];
    if (template.monday) dayNames.push('Mon');
    if (template.tuesday) dayNames.push('Tue');
    if (template.wednesday) dayNames.push('Wed');
    if (template.thursday) dayNames.push('Thu');
    if (template.friday) dayNames.push('Fri');
    if (template.saturday) dayNames.push('Sat');
    if (template.sunday) dayNames.push('Sun');
    
    if (dayNames.length === 7) return 'Every day';
    if (dayNames.length === 5 && !template.saturday && !template.sunday) return 'Weekdays';
    if (dayNames.length === 2 && template.saturday && template.sunday) return 'Weekends';
    
    return dayNames.join(', ');
  };
  
  // Handle generation
  const handleGenerateShifts = async () => {
    if (selectedTemplates.length === 0) {
      setError('Please select at least one template');
      return;
    }
    
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }
    
    if (isBefore(endDate, startDate)) {
      setError('End date must be after start date');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await recurringTemplateAPI.generateShiftRequirements({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        template_ids: selectedTemplates
      });
      
      setGenerationResults(response.data);
      setGenerationStep(2);
    } catch (err) {
      console.error('Error generating shift requirements:', err);
      setError(err.response?.data?.error || 'Failed to generate shift requirements');
    } finally {
      setLoading(false);
    }
  };
  
  // Close and reset the dialog
  const handleClose = () => {
    setGenerationStep(1);
    setError('');
    setGenerationResults(null);
    onClose();
  };
  
  // Group requirements by date
  const groupRequirementsByDate = (requirements) => {
    if (!requirements) return {};
    
    const grouped = {};
    
    requirements.forEach(req => {
      if (!grouped[req.date]) {
        grouped[req.date] = [];
      }
      grouped[req.date].push(req);
    });
    
    return grouped;
  };
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Generate Shift Requirements</DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {generationStep === 1 ? (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Date Range
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    format="MM/dd/yyyy"
                    slotProps={{
                      textField: { fullWidth: true }
                    }}
                  />
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={setEndDate}
                    format="MM/dd/yyyy"
                    slotProps={{
                      textField: { fullWidth: true }
                    }}
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => handlePresetDateRange('week')}
                    sx={{ mr: 1 }}
                  >
                    Next Week
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => handlePresetDateRange('twoWeeks')}
                    sx={{ mr: 1 }}
                  >
                    Next Two Weeks
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => handlePresetDateRange('month')}
                  >
                    Next Month
                  </Button>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Select Templates
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectAll}
                      onChange={handleSelectAllChange}
                    />
                  }
                  label="Select All"
                />
                <List>
                  {templates.map(template => (
                    <ListItem key={template.id} disablePadding>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedTemplates.includes(template.id)}
                            onChange={() => handleTemplateSelectionChange(template.id)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">
                              {getRoleName(template.role_id)} - {template.start_time.substring(0, 5)} to {template.end_time.substring(0, 5)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatDays(template)} • {template.employee_count} {template.employee_count === 1 ? 'employee' : 'employees'} required
                            </Typography>
                          </Box>
                        }
                        sx={{ width: '100%' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          ) : (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Successfully generated {generationResults.requirements.length} shift requirements!
              </Alert>
              
              <Typography variant="subtitle1" gutterBottom>
                Generated Requirements
              </Typography>
              
              {Object.entries(groupRequirementsByDate(generationResults.requirements)).map(([date, reqs]) => (
                <Paper key={date} sx={{ mb: 2, p: 2 }}>
                  <Typography variant="h6">
                    {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <List dense>
                    {reqs.map((req, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${getRoleName(req.role_id)}`}
                          secondary={`${req.start_time.substring(0, 5)} - ${req.end_time.substring(0, 5)}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose}>
            {generationStep === 1 ? 'Cancel' : 'Close'}
          </Button>
          {generationStep === 1 && (
            <Button 
              onClick={handleGenerateShifts} 
              variant="contained" 
              disabled={loading || selectedTemplates.length === 0}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

// Main ManagerRecurringTemplates component
const ManagerRecurringTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Template dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [dialogTitle, setDialogTitle] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Template form state
  const [selectedRole, setSelectedRole] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [employeeCount, setEmployeeCount] = useState(1);
  const [days, setDays] = useState({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false
  });
  
  // Generate dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  
  // Fetch templates and roles
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Fetch all templates
        const templatesRes = await recurringTemplateAPI.getRecurringTemplates();
        
        // Fetch all roles
        const rolesRes = await roleAPI.getRoles();
        
        setRoles(rolesRes.data);
        setTemplates(templatesRes.data);
        
        // If we have roles, set the first one as default for new requirements
        if (rolesRes.data.length > 0) {
          setSelectedRole(rolesRes.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Handler for opening the new template dialog
  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setDialogTitle('Add Recurring Shift Template');
    
    // Default to first role if available
    setSelectedRole(roles.length > 0 ? roles[0].id : '');
    
    // Default times (9 AM to 5 PM)
    const defaultStart = new Date();
    defaultStart.setHours(9, 0, 0, 0);
    
    const defaultEnd = new Date();
    defaultEnd.setHours(17, 0, 0, 0);
    
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setEmployeeCount(1);
    
    // Reset days
    setDays({
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    });
    
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for opening the edit template dialog
  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setDialogTitle('Edit Recurring Shift Template');
    
    setSelectedRole(template.role_id);
    
    // Parse time strings to Date objects
    const startTimeDate = new Date();
    const [startHours, startMinutes] = template.start_time.split(':');
    startTimeDate.setHours(parseInt(startHours, 10), parseInt(startMinutes, 10), 0, 0);
    
    const endTimeDate = new Date();
    const [endHours, endMinutes] = template.end_time.split(':');
    endTimeDate.setHours(parseInt(endHours, 10), parseInt(endMinutes, 10), 0, 0);
    
    setStartTime(startTimeDate);
    setEndTime(endTimeDate);
    setEmployeeCount(template.employee_count);
    
    setDays({
      monday: template.monday,
      tuesday: template.tuesday,
      wednesday: template.wednesday,
      thursday: template.thursday,
      friday: template.friday,
      saturday: template.saturday,
      sunday: template.sunday
    });
    
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for closing the template dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // Handler for submitting the template form
  const handleSubmitTemplate = async () => {
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
    
    // Check if at least one day is selected
    if (!Object.values(days).some(value => value)) {
      setFormError('At least one day of the week must be selected');
      return;
    }
    
    setFormError('');
    setSubmitting(true);
    
    try {
      // Format times as HH:MM
      const formatTime = (date) => {
        return date.toTimeString().slice(0, 5);
      };
      
      const templateData = {
        role_id: parseInt(selectedRole),
        start_time: formatTime(startTime),
        end_time: formatTime(endTime),
        employee_count: parseInt(employeeCount),
        ...days  // Spread days object (monday, tuesday, etc.)
      };
      
      if (editingTemplate) {
        // Update existing template
        await recurringTemplateAPI.updateRecurringTemplate(editingTemplate.id, templateData);
      } else {
        // Create new template
        await recurringTemplateAPI.createRecurringTemplate(templateData);
      }
      
      // Close dialog and refresh data
      handleCloseDialog();
      
      // Refresh templates
      const templatesRes = await recurringTemplateAPI.getRecurringTemplates();
      setTemplates(templatesRes.data);
    } catch (err) {
      console.error('Error saving template:', err);
      setFormError(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handler for opening delete confirmation dialog
  const handleDeleteClick = (template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };
  
  // Handler for confirming template deletion
  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    
    try {
      await recurringTemplateAPI.deleteRecurringTemplate(templateToDelete.id);
      
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      
      // Refresh templates
      const templatesRes = await recurringTemplateAPI.getRecurringTemplates();
      setTemplates(templatesRes.data);
    } catch (err) {
      console.error('Error deleting template:', err);
      setError('Failed to delete template');
    }
  };
  
  // Handler for day checkbox changes
  const handleDayChange = (event) => {
    setDays({
      ...days,
      [event.target.name]: event.target.checked
    });
  };
  
  // Handler for opening generate dialog
  const handleOpenGenerateDialog = () => {
    setGenerateDialogOpen(true);
  };
  
  // Get role name by ID
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Unknown Role';
  };
  
  // Helper to format days as a readable string
  const formatDays = (template) => {
    const dayNames = [];
    if (template.monday) dayNames.push('Mon');
    if (template.tuesday) dayNames.push('Tue');
    if (template.wednesday) dayNames.push('Wed');
    if (template.thursday) dayNames.push('Thu');
    if (template.friday) dayNames.push('Fri');
    if (template.saturday) dayNames.push('Sat');
    if (template.sunday) dayNames.push('Sun');
    
    if (dayNames.length === 7) return 'Every day';
    if (dayNames.length === 5 && !template.saturday && !template.sunday) return 'Weekdays';
    if (dayNames.length === 2 && template.saturday && template.sunday) return 'Weekends';
    
    return dayNames.join(', ');
  };
  
  return (
    <AppLayout title="Recurring Shift Templates">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Recurring Shift Templates
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Create templates for recurring shifts that you need regularly. These templates can then be used to quickly generate shift requirements for specific date ranges.
        </Alert>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewTemplate}
              disabled={roles.length === 0}
            >
              Add Template
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="success"
              startIcon={<GenerateIcon />}
              onClick={handleOpenGenerateDialog}
              disabled={templates.length === 0}
            >
              Generate Shift Requirements
            </Button>
          </Grid>
        </Grid>
        
        {roles.length === 0 && !loading && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            You need to create at least one role before adding templates.
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
                <TableCell>Time</TableCell>
                <TableCell>Days</TableCell>
                <TableCell>Employees Required</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>{getRoleName(template.role_id)}</TableCell>
                    <TableCell>
                      {template.start_time.substring(0, 5)} - {template.end_time.substring(0, 5)}
                    </TableCell>
                    <TableCell>{formatDays(template)}</TableCell>
                    <TableCell>{template.employee_count}</TableCell>
                    <TableCell>
                      <IconButton 
                        color="primary" 
                        onClick={() => handleEditTemplate(template)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteClick(template)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No templates found. Click "Add Template" to create the first one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Template Dialog */}
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
                  inputProps={{ min: 1 }}
                  sx={{ mb: 2 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TimePicker
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
                <TimePicker
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
                <Typography variant="subtitle1" gutterBottom>
                  Days of Week
                </Typography>
                <FormGroup row>
                  <FormControlLabel
                    control={<Checkbox checked={days.monday} onChange={handleDayChange} name="monday" />}
                    label="Monday"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={days.tuesday} onChange={handleDayChange} name="tuesday" />}
                    label="Tuesday"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={days.wednesday} onChange={handleDayChange} name="wednesday" />}
                    label="Wednesday"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={days.thursday} onChange={handleDayChange} name="thursday" />}
                    label="Thursday"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={days.friday} onChange={handleDayChange} name="friday" />}
                    label="Friday"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={days.saturday} onChange={handleDayChange} name="saturday" />}
                    label="Saturday"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={days.sunday} onChange={handleDayChange} name="sunday" />}
                    label="Sunday"
                  />
                </FormGroup>
                <Box sx={{ mt: 1 }}>
                  <Button 
                    size="small" 
                    onClick={() => setDays({monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false})}
                  >
                    Weekdays
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => setDays({monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: true, sunday: true})}
                    sx={{ ml: 1 }}
                  >
                    Weekends
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => setDays({monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true})}
                    sx={{ ml: 1 }}
                  >
                    Every Day
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmitTemplate} 
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
            Are you sure you want to delete this template? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Generate Dialog */}
      {generateDialogOpen && (
        <GenerateShiftsDialog
          open={generateDialogOpen}
          onClose={() => setGenerateDialogOpen(false)}
          templates={templates}
          roles={roles}
        />
      )}
    </AppLayout>
  );
};

export default ManagerRecurringTemplates;