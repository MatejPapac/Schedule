import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography,
  Paper,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Button,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { preferencesAPI, roleAPI } from '../../services/api';

const DayOfWeekNames = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const PreferenceLabels = [
  'Strongly Prefer', 'Prefer', 'Neutral', 'Avoid if Possible', 'Strongly Avoid'
];

const EmployeePreferences = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Day preferences
  const [dayPreferences, setDayPreferences] = useState([]);
  const [selectedDay, setSelectedDay] = useState(0); // Monday = 0
  const [dayPreferenceLevel, setDayPreferenceLevel] = useState(3); // Neutral = 3
  
  // Role preferences
  const [rolePreferences, setRolePreferences] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [rolePreferenceLevel, setRolePreferenceLevel] = useState(3); // Neutral = 3
  
  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Fetch roles
        const rolesRes = await roleAPI.getRoles();
        setRoles(rolesRes.data);
        
        if (rolesRes.data.length > 0) {
          setSelectedRole(rolesRes.data[0].id);
        }
        
        // Fetch day preferences
        const dayPrefsRes = await preferencesAPI.getDayPreferences(user.id);
        setDayPreferences(dayPrefsRes.data);
        
        // Fetch role preferences
        const rolePrefsRes = await preferencesAPI.getRolePreferences(user.id);
        setRolePreferences(rolePrefsRes.data);
      } catch (err) {
        console.error('Error fetching preferences:', err);
        setError('Failed to load preferences. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchData();
    }
  }, [user]);
  
  // Handler for adding a day preference
  const handleAddDayPreference = async () => {
    try {
      // Check if this day already has a preference
      const existing = dayPreferences.find(pref => pref.day_of_week === selectedDay);
      
      if (existing) {
        // Update existing preference
        await preferencesAPI.setDayPreference({
          id: existing.id,
          user_id: user.id,
          day_of_week: selectedDay,
          preference_level: dayPreferenceLevel
        });
      } else {
        // Create new preference
        await preferencesAPI.setDayPreference({
          user_id: user.id,
          day_of_week: selectedDay,
          preference_level: dayPreferenceLevel
        });
      }
      
      // Refresh day preferences
      const dayPrefsRes = await preferencesAPI.getDayPreferences(user.id);
      setDayPreferences(dayPrefsRes.data);
    } catch (err) {
      console.error('Error setting day preference:', err);
      setError('Failed to save day preference');
    }
  };
  
  // Handler for deleting a day preference
  const handleDeleteDayPreference = async (id) => {
    try {
      await preferencesAPI.deleteDayPreference(id);
      
      // Refresh day preferences
      const dayPrefsRes = await preferencesAPI.getDayPreferences(user.id);
      setDayPreferences(dayPrefsRes.data);
    } catch (err) {
      console.error('Error deleting day preference:', err);
      setError('Failed to delete day preference');
    }
  };
  
  // Handler for adding a role preference
  const handleAddRolePreference = async () => {
    if (!selectedRole) return;
    
    try {
      // Check if this role already has a preference
      const existing = rolePreferences.find(pref => pref.role_id === parseInt(selectedRole));
      
      if (existing) {
        // Update existing preference
        await preferencesAPI.setRolePreference({
          id: existing.id,
          user_id: user.id,
          role_id: parseInt(selectedRole),
          preference_level: rolePreferenceLevel
        });
      } else {
        // Create new preference
        await preferencesAPI.setRolePreference({
          user_id: user.id,
          role_id: parseInt(selectedRole),
          preference_level: rolePreferenceLevel
        });
      }
      
      // Refresh role preferences
      const rolePrefsRes = await preferencesAPI.getRolePreferences(user.id);
      setRolePreferences(rolePrefsRes.data);
    } catch (err) {
      console.error('Error setting role preference:', err);
      setError('Failed to save role preference');
    }
  };
  
  // Handler for deleting a role preference
  const handleDeleteRolePreference = async (id) => {
    try {
      await preferencesAPI.deleteRolePreference(id);
      
      // Refresh role preferences
      const rolePrefsRes = await preferencesAPI.getRolePreferences(user.id);
      setRolePreferences(rolePrefsRes.data);
    } catch (err) {
      console.error('Error deleting role preference:', err);
      setError('Failed to delete role preference');
    }
  };
  
  // Get role name by id
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Unknown Role';
  };
  
  if (loading) {
    return (
      <AppLayout title="My Preferences">
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout title="My Preferences">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Preferences
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Set your work preferences to help managers create schedules that work better for you.
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Note: While managers can see your preferences, the automatic scheduling system in this version does not yet take preferences into account. Managers may still consider them when making manual adjustments.
        </Alert>
      </Box>
      
      <Grid container spacing={3}>
        {/* Day Preferences */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Day Preferences" />
            <CardContent>
              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="day-select-label">Day of Week</InputLabel>
                  <Select
                    labelId="day-select-label"
                    id="day-select"
                    value={selectedDay}
                    label="Day of Week"
                    onChange={(e) => setSelectedDay(e.target.value)}
                  >
                    {DayOfWeekNames.map((day, index) => (
                      <MenuItem key={index} value={index}>
                        {day}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Typography id="day-preference-slider" gutterBottom>
                  Preference Level: {PreferenceLabels[dayPreferenceLevel - 1]}
                </Typography>
                <Slider
                  value={dayPreferenceLevel}
                  onChange={(e, newValue) => setDayPreferenceLevel(newValue)}
                  step={1}
                  marks
                  min={1}
                  max={5}
                  aria-labelledby="day-preference-slider"
                />
                
                <Button 
                  variant="contained" 
                  onClick={handleAddDayPreference}
                  sx={{ mt: 2 }}
                >
                  Save Day Preference
                </Button>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Current Day Preferences
              </Typography>
              
              <List>
                {dayPreferences.length > 0 ? (
                  dayPreferences.map((pref) => (
                    <ListItem 
                      key={pref.id}
                      secondaryAction={
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          onClick={() => handleDeleteDayPreference(pref.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={DayOfWeekNames[pref.day_of_week]}
                        secondary={`Preference: ${PreferenceLabels[pref.preference_level - 1]}`}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No day preferences set" />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Role Preferences */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Role Preferences" />
            <CardContent>
              <Box sx={{ mb: 3 }}>
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
                    {roles.map((role) => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Typography id="role-preference-slider" gutterBottom>
                  Preference Level: {PreferenceLabels[rolePreferenceLevel - 1]}
                </Typography>
                <Slider
                  value={rolePreferenceLevel}
                  onChange={(e, newValue) => setRolePreferenceLevel(newValue)}
                  step={1}
                  marks
                  min={1}
                  max={5}
                  aria-labelledby="role-preference-slider"
                />
                
                <Button 
                  variant="contained" 
                  onClick={handleAddRolePreference}
                  sx={{ mt: 2 }}
                  disabled={!selectedRole}
                >
                  Save Role Preference
                </Button>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Current Role Preferences
              </Typography>
              
              <List>
                {rolePreferences.length > 0 ? (
                  rolePreferences.map((pref) => (
                    <ListItem 
                      key={pref.id}
                      secondaryAction={
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          onClick={() => handleDeleteRolePreference(pref.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={getRoleName(pref.role_id)}
                        secondary={`Preference: ${PreferenceLabels[pref.preference_level - 1]}`}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No role preferences set" />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </AppLayout>
  );
};

export default EmployeePreferences;