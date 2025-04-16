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
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Checkbox,
  ListItemText,
  InputAdornment,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import AppLayout from '../../components/AppLayout';
import { userAPI, roleAPI } from '../../services/api';

const ManagerUsers = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // User dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [dialogTitle, setDialogTitle] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // User form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('employee');
  const [targetHours, setTargetHours] = useState(40);
  const [active, setActive] = useState(true);
  const [capableRoles, setCapableRoles] = useState([]);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Fetch users and roles
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Fetch all users
        const usersRes = await userAPI.getUsers();
        setUsers(usersRes.data);
        
        // Fetch all roles
        const rolesRes = await roleAPI.getRoles();
        setRoles(rolesRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Handler for opening the new user dialog
  const handleNewUser = () => {
    setEditingUser(null);
    setDialogTitle('Add New User');
    setUsername('');
    setPassword('');
    setName('');
    setEmail('');
    setUserType('employee');
    setTargetHours(40);
    setActive(true);
    setCapableRoles([]);
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for opening the edit user dialog
  const handleEditUser = (user) => {
    setEditingUser(user);
    setDialogTitle('Edit User');
    setUsername(user.username);
    setPassword(''); // Don't populate password field
    setName(user.name);
    setEmail(user.email);
    setUserType(user.user_type);
    setTargetHours(user.target_hours);
    setActive(user.active);
    setCapableRoles(user.capable_roles || []);
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for closing the user dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // Handler for submitting the user form
  const handleSubmitUser = async () => {
    // Validate form
    if (!username || (!editingUser && !password) || !name || !email) {
      setFormError('Please fill in all required fields');
      return;
    }
    
    setFormError('');
    setSubmitting(true);
    
    try {
      const userData = {
        username,
        name,
        email,
        user_type: userType,
        target_hours: parseFloat(targetHours),
        active,
        capable_roles: capableRoles
      };
      
      // Add password only if provided (required for new users)
      if (password) {
        userData.password = password;
      }
      
      if (editingUser) {
        // Update existing user
        await userAPI.updateUser(editingUser.id, userData);
      } else {
        // Create new user
        await userAPI.createUser(userData);
      }
      
      // Close dialog and refresh data
      handleCloseDialog();
      
      // Refresh users
      const usersRes = await userAPI.getUsers();
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Error saving user:', err);
      setFormError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handler for opening delete confirmation dialog
  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };
  
  // Handler for confirming user deletion
  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    try {
      await userAPI.deleteUser(userToDelete.id);
      
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      
      // Refresh users
      const usersRes = await userAPI.getUsers();
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user');
    }
  };
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Get role name by id
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Unknown Role';
  };
  
  // Format capable roles as a string
  const formatCapableRoles = (roleIds) => {
    if (!roleIds || roleIds.length === 0) return 'None';
    
    return roleIds.map(id => getRoleName(id)).join(', ');
  };
  
  return (
    <AppLayout title="User Management">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          User Management
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                )
            }
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewUser}
              fullWidth
              sx={{ height: '56px' }}
            >
              Add New User
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
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Target Hours</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Capable Roles</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.user_type === 'manager' ? 'Manager' : 'Employee'} 
                        color={user.user_type === 'manager' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{user.target_hours}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.active ? 'Active' : 'Inactive'} 
                        color={user.active ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatCapableRoles(user.capable_roles)}</TableCell>
                    <TableCell>
                      <IconButton 
                        color="primary" 
                        onClick={() => handleEditUser(user)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteClick(user)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* User Dialog */}
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
              <TextField
                label="Username"
                fullWidth
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={editingUser !== null} // Can't change username for existing users
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label={editingUser ? "Password (leave blank to keep unchanged)" : "Password"}
                type="password"
                fullWidth
                required={!editingUser}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Full Name"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="user-type-label">User Type</InputLabel>
                <Select
                  labelId="user-type-label"
                  id="user-type"
                  value={userType}
                  label="User Type"
                  onChange={(e) => setUserType(e.target.value)}
                >
                  <MenuItem value="employee">Employee</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Target Weekly Hours"
                type="number"
                fullWidth
                required
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                slotProps={{
                    input: { min: 0, max: 168 }
                  }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="capable-roles-label">Capable Roles</InputLabel>
                <Select
                  labelId="capable-roles-label"
                  id="capable-roles"
                  multiple
                  value={capableRoles}
                  onChange={(e) => setCapableRoles(e.target.value)}
                  input={<OutlinedInput label="Capable Roles" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={getRoleName(value)} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      <Checkbox checked={capableRoles.indexOf(role.id) > -1} />
                      <ListItemText primary={role.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmitUser} 
            variant="contained" 
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the user "{userToDelete?.name}"? This action cannot be undone.
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

export default ManagerUsers;