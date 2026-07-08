// src/pages/ResetPasswordPage.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Paper, Typography, Alert } from '@mui/material';
import { ResetPasswordForm } from '../components/auths/ResetPasswordForm';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');

  const handleSuccess = () => {
    setTimeout(() => navigate('/login'), 2000);
  };

  if (!token) {
    return (
      <Container maxWidth="xs" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4 }}>
          <Alert severity="error">Invalid reset token</Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" align="center" gutterBottom>
          Reset Password
        </Typography>

        <ResetPasswordForm token={token} onSuccess={handleSuccess} />
      </Paper>
    </Container>
  );
};

export default ResetPasswordPage;