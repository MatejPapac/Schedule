import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { 
  WarningAmber as WarningIcon,
  Check as CheckIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { format, addDays, isBefore } from 'date-fns';
import AppLayout from '../../components/AppLayout';
import { scheduleAPI, shiftRequirementAPI } from '../../services/api';

const ManagerGenerateSchedule = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generationStats, setGenerationStats] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [requirementsChecking, setRequirementsChecking] = useState(false);
  const [requirementsCount, setRequirementsCount] = useState(0);
  
  // Handler for checking shift requirements
  const checkRequirements = async () => {
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }
    
    if (isBefore(endDate, startDate)) {
      setError('End date must be after start date');
      return;
    }
    
    setRequirementsChecking(true);
    setError('');
    
    try {
      // Get requirements for the selected period
      const response = await shiftRequirementAPI.getShiftRequirements({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString()
      });
      
      setRequirementsCount(response.data.length);
      
      if (response.data.length === 0) {
        setError('No shift requirements found for the selected period. Please define shift requirements first.');
        setRequirementsChecking(false);
        return;
      }
      
      // If requirements exist, open confirmation dialog
      setConfirmDialogOpen(true);
      setRequirementsChecking(false);
    } catch (err) {
      console.error('Error checking requirements:', err);
      setError('Failed to check requirements. Please try again later.');
      setRequirementsChecking(false);
    }
  };
  
  // Handler for generating the schedule
  const generateSchedule = async () => {
    setConfirmDialogOpen(false);
    setLoading(true);
    setError('');
    setSuccess(false);
    setGenerationStats(null);
    
    try {
      const response = await scheduleAPI.generateSchedule({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd')
      });
      
      setGenerationStats(response.data);
      setSuccess(true);
    } catch (err) {
      console.error('Error generating schedule:', err);
      setError(err.response?.data?.error || 'Failed to generate schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handler for closing confirm dialog
  const handleCloseConfirm = () => {
    setConfirmDialogOpen(false);
  };
  
  // Calculate date range description
  const getDateRangeText = () => {
    if (!startDate || !endDate) return 'No date range selected';
    
    return `${format(startDate, 'MMMM d, yyyy')} to ${format(endDate, 'MMMM d, yyyy')}`;
  };
  
  return (
    <AppLayout title="Generate Schedule">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Generate Schedule
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Generate a work schedule for a specific date range. The system will attempt to fulfill all shift requirements
          while respecting employee role capabilities and approved time off requests.
        </Alert>
      </Box>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => {
                  setStartDate(newValue);
                  // If end date is not set or is before start date, set it to start date + 6 days (one week)
                  if (!endDate || isBefore(endDate, newValue)) {
                    setEndDate(addDays(newValue, 6));
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    variant: 'outlined',
                    helperText: 'Select the first day of the schedule period'
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} md={5}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    variant: 'outlined',
                    helperText: 'Select the last day of the schedule period'
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={checkRequirements}
              disabled={!startDate || !endDate || requirementsChecking || loading}
              sx={{ height: '56px' }}
            >
              {requirementsChecking ? <CircularProgress size={24} /> : 'Generate Schedule'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {loading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            Generating schedule... This may take a moment.
          </Typography>
          <LinearProgress />
        </Box>
      )}
      
      {success && generationStats && (
        <Card sx={{ mb: 3 }}>
          <CardHeader 
            title="Schedule Generated Successfully" 
            titleTypographyProps={{ color: 'success.main' }}
            avatar={<CheckIcon color="success" />}
          />
          <Divider />
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Generation Statistics:
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="Total Shifts Assigned" 
                      secondary={generationStats.total_shifts_assigned} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Total Requirements" 
                      secondary={generationStats.total_requirements} 
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="Requirements Met" 
                      secondary={`${generationStats.requirements_met} of ${generationStats.total_requirements}`} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Schedule Completion" 
                      secondary={`${Math.round(generationStats.schedule_completion_percentage)}%`} 
                    />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                Schedule was generated for the period:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getDateRangeText()}
              </Typography>
            </Box>
            
            {generationStats.schedule_completion_percentage < 100 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <AlertTitle>Not all requirements were satisfied</AlertTitle>
                Some shifts could not be assigned. This could be due to:
                <ul>
                  <li>Not enough employees with the required capabilities</li>
                  <li>Approved time off requests that conflict with requirements</li>
                  <li>Scheduling constraints (e.g., overlapping shifts)</li>
                </ul>
                Please review the schedule and make manual adjustments as needed.
              </Alert>
            )}
            
            <Button
              variant="contained"
              color="primary"
              onClick={() => window.location.href = '/manager/schedule'}
              sx={{ mt: 2 }}
            >
              View & Edit Schedule
            </Button>
          </CardContent>
        </Card>
      )}
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Schedule Generation Notes
        </Typography>
        <Paper sx={{ p: 3 }}>
          <List>
            <ListItem>
              <ListItemText 
                primary="This is an automated process"
                secondary="The system will try to assign shifts based on defined requirements and constraints."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Existing shifts will be cleared"
                secondary="All existing shifts in the selected date range will be deleted before generating a new schedule."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Employee preferences are not considered in the MVP"
                secondary="The current version does not take employee day or role preferences into account when generating schedules."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Manual adjustments may be needed"
                secondary="You may need to manually adjust the generated schedule to address specific needs or preferences."
              />
            </ListItem>
          </List>
        </Paper>
      </Box>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCloseConfirm}
      >
        <DialogTitle>Confirm Schedule Generation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to generate a new schedule for the period: <strong>{getDateRangeText()}</strong>
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            <strong>Found {requirementsCount} shift requirements in this period.</strong>
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'error.main' }}>
            <WarningIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            This will delete all existing shifts in the selected date range and replace them with a new schedule.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirm}>Cancel</Button>
          <Button onClick={generateSchedule} variant="contained" color="primary">
            Generate Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
};

export default ManagerGenerateSchedule;