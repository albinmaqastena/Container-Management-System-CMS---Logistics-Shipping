// src/pages/ForgotPasswordPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Typography, Box, Button } from '@mui/material';
import { ForgotPasswordForm } from '../components/auths/ForgotPasswordForm';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    setTimeout(() => navigate('/login'), 3000);
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" align="center" gutterBottom>
          Forgot Password
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          align="center"
          sx={{ mb: 3 }}
        >
          Enter your email and we'll send you a reset link
        </Typography>

        <ForgotPasswordForm onSuccess={handleSuccess} />

        <Button
          fullWidth
          variant="text"
          onClick={() => navigate('/login')}
          sx={{ mt: 2 }}
        >
          Back to Login
        </Button>
      </Paper>
    </Container>
  );
};

export default ForgotPasswordPage;