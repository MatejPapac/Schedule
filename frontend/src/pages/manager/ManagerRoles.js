import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  List,
  ListItem,
  ListItemText,
  SecondaryAction,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import AppLayout from '../../components/AppLayout';
import { roleAPI } from '../../services/api';

const ManagerRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Role dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [dialogTitle, setDialogTitle] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  
  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      setLoading(true);
      setError('');
      
      try {
        const response = await roleAPI.getRoles();
        console.log('Fetched roles:', response.data);
        setRoles(response.data);
      } catch (err) {
        console.error('Error fetching roles:', err);
        setError('Failed to load roles. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoles();
  }, []);
  
  // Handler for opening the new role dialog
  const handleNewRole = () => {
    setEditingRole(null);
    setDialogTitle('Add New Role');
    setRoleName('');
    setRoleDescription('');
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for opening the edit role dialog
  const handleEditRole = (role) => {
    setEditingRole(role);
    setDialogTitle('Edit Role');
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setFormError('');
    setDialogOpen(true);
  };
  
  // Handler for closing the role dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // Handler for submitting the role form
  const handleSubmitRole = async () => {
    // Validate form
    if (!roleName.trim()) {
      setFormError('Role name is required');
      return;
    }
    
    setFormError('');
    setSubmitting(true);
    
    try {
      const roleData = {
        name: roleName.trim(),
        description: roleDescription.trim()
      };
      
      if (editingRole) {
        // Update existing role
        await roleAPI.updateRole(editingRole.id, roleData);
      } else {
        // Create new role
        await roleAPI.createRole(roleData);
      }
      
      // Close dialog and refresh data
      handleCloseDialog();
      
      // Refresh roles
      const response = await roleAPI.getRoles();
      setRoles(response.data);
    } catch (err) {
      console.error('Error saving role:', err);
      setFormError(err.response?.data?.error || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handler for opening delete confirmation dialog
  const handleDeleteClick = (role) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };
  
  // Handler for confirming role deletion
  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;
    
    try {
      await roleAPI.deleteRole(roleToDelete.id);
      
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      
      // Refresh roles
      const response = await roleAPI.getRoles();
      setRoles(response.data);
    } catch (err) {
      console.error('Error deleting role:', err);
      setError('Failed to delete role. It may be in use by users or shift requirements.');
    }
  };
  
  return (
    <AppLayout title="Role Management">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Role Management
        </Typography>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewRole}
          sx={{ mb: 3 }}
        >
          Add New Role
        </Button>
        
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
        <Grid container spacing={3}>
          {roles.length > 0 ? (
            roles.map((role) => (
              <Grid item xs={12} sm={6} md={4} key={role.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" component="div">
                      {role.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {role.description || 'No description provided'}
                    </Typography>
                  </CardContent>
                  <Divider />
                  <CardActions>
                    <Button size="small" onClick={() => handleEditRole(role)}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => handleDeleteClick(role)}>
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography>No roles found. Click "Add New Role" to create the first role.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
      
      {/* Role Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          
          <TextField
            margin="normal"
            label="Role Name"
            fullWidth
            required
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
          />
          
          <TextField
            margin="normal"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={roleDescription}
            onChange={(e) => setRoleDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmitRole} 
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
            Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be undone.
          </Typography>
          <Typography color="error" sx={{ mt: 2 }}>
            Warning: Deleting a role that is in use by users or shift requirements may cause issues.
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

export default ManagerRoles;