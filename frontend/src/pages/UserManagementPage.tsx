// src/pages/UserManagementPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { User, RegisterData } from '../types';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [registerData, setRegisterData] = useState<RegisterData>({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [registerLoading, setRegisterLoading] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      // Përdor authService për të marrë përdoruesit
      const response = await authService.getUsers();
      setUsers(response);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadDeletedUsers = async () => {
    try {
      const response = await authService.getDeletedUsers();
      setDeletedUsers(response);
    } catch (err: any) {
      console.error('Failed to load deleted users:', err);
    }
  };

  useEffect(() => {
    loadUsers();
    if (isSuperAdmin) {
      loadDeletedUsers();
    }
  }, [isSuperAdmin]);

  const handleRegister = async () => {
    if (!registerData.username || !registerData.email || !registerData.password) {
      toast.warning('Please fill in all required fields');
      return;
    }

    setRegisterLoading(true);
    try {
      await authService.register(registerData);
      toast.success('User registered successfully!');
      setIsRegisterDialogOpen(false);
      setRegisterData({ username: '', email: '', password: '', role: 'user' });
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register user');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSoftDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await authService.softDeleteUser(userId);
      toast.success('User moved to trash');
      loadUsers();
      if (isSuperAdmin) loadDeletedUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const handleRestore = async (userId: string) => {
    try {
      await authService.restoreUser(userId);
      toast.success('User restored successfully!');
      loadUsers();
      if (isSuperAdmin) loadDeletedUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore user');
    }
  };

  const handlePermanentDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      await authService.permanentDeleteUser(userId);
      toast.success('User permanently deleted');
      if (isSuperAdmin) loadDeletedUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to permanently delete user');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'admin':
        return 'warning';
      default:
        return 'primary';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">
          {showDeleted ? 'Deleted Users' : 'User Management'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {isSuperAdmin && (
            <Button
              variant="outlined"
              onClick={() => setShowDeleted(!showDeleted)}
            >
              {showDeleted ? 'Show Active' : 'Show Deleted'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setIsRegisterDialogOpen(true)}
          >
            Register User
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(showDeleted ? deletedUsers : users).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      {showDeleted ? 'No deleted users' : 'No users found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (showDeleted ? deletedUsers : users).map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Active' : 'Inactive'}
                        color={user.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {showDeleted ? (
                        <>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleRestore(user.id)}
                            title="Restore"
                          >
                            <RestoreIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handlePermanentDelete(user.id)}
                            title="Permanently Delete"
                          >
                            <DeleteForeverIcon />
                          </IconButton>
                        </>
                      ) : (
                        user.id !== currentUser?.id && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleSoftDelete(user.id)}
                            title="Delete"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Register Dialog */}
      <Dialog open={isRegisterDialogOpen} onClose={() => setIsRegisterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register New User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Username"
              value={registerData.username}
              onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={registerData.password}
              onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              required
              fullWidth
              helperText="Minimum 8 characters"
            />
            <TextField
              select
              label="Role"
              value={registerData.role}
              onChange={(e) => setRegisterData({ ...registerData, role: e.target.value as any })}
              fullWidth
            >
              <MenuItem value="user">User</MenuItem>
              {isSuperAdmin && <MenuItem value="admin">Admin</MenuItem>}
              {isSuperAdmin && <MenuItem value="super_admin">Super Admin</MenuItem>}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRegisterDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRegister}
            variant="contained"
            disabled={registerLoading}
          >
            {registerLoading ? 'Registering...' : 'Register'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};