import axios from 'axios';

// API URL from environment or default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// User API calls
export const userAPI = {
  // Get all users (manager only)
  getUsers: () => axios.get(`${API_URL}/users`),
  
  // Get user by ID
  getUser: (userId) => axios.get(`${API_URL}/users/${userId}`),
  
  // Create new user (manager only)
  createUser: (userData) => axios.post(`${API_URL}/users`, userData),
  
  // Update user
  updateUser: (userId, userData) => axios.put(`${API_URL}/users/${userId}`, userData),
  
  // Delete user (manager only)
  deleteUser: (userId) => axios.delete(`${API_URL}/users/${userId}`)
};

// Role API calls
export const roleAPI = {
  // Get all roles
  getRoles: () => axios.get(`${API_URL}/roles`),
  
  // Get role by ID
  getRole: (roleId) => axios.get(`${API_URL}/roles/${roleId}`),
  
  // Create new role (manager only)
  createRole: (roleData) => axios.post(`${API_URL}/roles`, roleData),
  
  // Update role (manager only)
  updateRole: (roleId, roleData) => axios.put(`${API_URL}/roles/${roleId}`, roleData),
  
  // Delete role (manager only)
  deleteRole: (roleId) => axios.delete(`${API_URL}/roles/${roleId}`)
};

// Shift requirement API calls
export const shiftRequirementAPI = {
  // Get all shift requirements (manager only)
  getShiftRequirements: (params) => axios.get(`${API_URL}/shifts`, { params }),
  
  // Get shift requirement by ID (manager only)
  getShiftRequirement: (requirementId) => axios.get(`${API_URL}/shifts/${requirementId}`),
  
  // Create new shift requirement (manager only)
  createShiftRequirement: (requirementData) => axios.post(`${API_URL}/shifts`, requirementData),
  
  // Update shift requirement (manager only)
  updateShiftRequirement: (requirementId, requirementData) => 
    axios.put(`${API_URL}/shifts/${requirementId}`, requirementData),
  
  // Delete shift requirement (manager only)
  deleteShiftRequirement: (requirementId) => axios.delete(`${API_URL}/shifts/${requirementId}`)
};

// Time off request API calls
export const timeOffAPI = {
  // Get all time off requests (filtered for employees, all for managers)
  getTimeOffRequests: (params) => axios.get(`${API_URL}/timeoff`, { params }),
  
  // Get time off request by ID
  getTimeOffRequest: (requestId) => axios.get(`${API_URL}/timeoff/${requestId}`),
  
  // Create new time off request
  createTimeOffRequest: (requestData) => axios.post(`${API_URL}/timeoff`, requestData),
  
  // Respond to time off request (manager only)
  respondToTimeOffRequest: (requestId, response) => 
    axios.put(`${API_URL}/timeoff/${requestId}/respond`, response),
  
  // Delete time off request
  deleteTimeOffRequest: (requestId) => axios.delete(`${API_URL}/timeoff/${requestId}`)
};

// User preferences API calls
export const preferencesAPI = {
  // Get day preferences for a user
  getDayPreferences: (userId) => axios.get(`${API_URL}/preferences/day/${userId}`),
  
  // Set day preference
  setDayPreference: (preferenceData) => axios.post(`${API_URL}/preferences/day`, preferenceData),
  
  // Delete day preference
  deleteDayPreference: (preferenceId) => axios.delete(`${API_URL}/preferences/day/${preferenceId}`),
  
  // Get role preferences for a user
  getRolePreferences: (userId) => axios.get(`${API_URL}/preferences/role/${userId}`),
  
  // Set role preference
  setRolePreference: (preferenceData) => axios.post(`${API_URL}/preferences/role`, preferenceData),
  
  // Delete role preference
  deleteRolePreference: (preferenceId) => axios.delete(`${API_URL}/preferences/role/${preferenceId}`)
};

// Schedule API calls
export const scheduleAPI = {
  // Get schedule for a specific user
  getUserSchedule: (userId, params) => axios.get(`${API_URL}/schedules/user/${userId}`, { params }),
  
  // Get full schedule (manager only)
  getFullSchedule: (params) => axios.get(`${API_URL}/schedules`, { params }),
  
  // Create a new shift assignment (manager only)
  createShift: (shiftData) => axios.post(`${API_URL}/schedules`, shiftData),
  
  // Update shift assignment (manager only)
  updateShift: (shiftId, shiftData) => axios.put(`${API_URL}/schedules/${shiftId}`, shiftData),
  
  // Delete shift assignment (manager only)
  deleteShift: (shiftId) => axios.delete(`${API_URL}/schedules/${shiftId}`),
  
  // Generate a schedule (manager only)
  generateSchedule: (params) => axios.post(`${API_URL}/schedules/generate`, params)
};

export const statsAPI = {
  // User-specific endpoints
  getUserHours: (userId, params) => axios.get(`${API_URL}/statistics/user/${userId}/hours`, { params }),
  
  // Role-based endpoints
  getRoleHours: (params) => axios.get(`${API_URL}/statistics/roles/hours`, { params }),
  getRoleDistribution: (params) => axios.get(`${API_URL}/statistics/roles/distribution`, { params }),
  getRoleDetails: (roleId, params) => axios.get(`${API_URL}/statistics/roles/${roleId}/details`, { params }),
  
  // Efficiency metrics
  getEfficiencyMetrics: (params) => axios.get(`${API_URL}/statistics/efficiency`, { params })
};