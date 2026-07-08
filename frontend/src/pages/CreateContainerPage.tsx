import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Breadcrumbs,
  Link,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useContainers } from '../contexts/ContainerContext';

export const CreateContainerPage: React.FC = () => {
  const navigate = useNavigate();
  const { createContainer, loading } = useContainers();

  const [formData, setFormData] = useState({
    customName: '',
    totalVolume: '',
    description: '',
  });

  const [errors, setErrors] = useState<{
    customName?: string;
    totalVolume?: string;
  }>({});

  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.customName.trim()) {
      newErrors.customName = 'Container name is required';
    } else if (formData.customName.trim().length < 2) {
      newErrors.customName = 'Container name must be at least 2 characters';
    } else if (formData.customName.trim().length > 100) {
      newErrors.customName = 'Container name must be less than 100 characters';
    }

    if (!formData.totalVolume) {
      newErrors.totalVolume = 'Total volume is required';
    } else {
      const volume = parseFloat(formData.totalVolume);
      if (isNaN(volume) || volume <= 0) {
        newErrors.totalVolume = 'Total volume must be a positive number';
      } else if (volume > 10000) {
        newErrors.totalVolume = 'Total volume cannot exceed 10,000 m³';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      setActiveStep(0);
      toast.warning('Please fix the errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      const container = await createContainer({
        customName: formData.customName.trim(),
        totalVolume: parseFloat(formData.totalVolume),
        description: formData.description.trim() || undefined,
      });

      toast.success(`Container "${container.name}" created successfully!`);
      navigate(`/containers/${container.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create container');
      setActiveStep(0);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (formData.customName || formData.totalVolume || formData.description) {
      if (window.confirm('Are you sure you want to cancel? Your changes will be lost.')) {
        navigate('/containers');
      }
    } else {
      navigate('/containers');
    }
  };

  const steps = [
    {
      label: 'Container Details',
      description: 'Enter the basic information for your container',
    },
    {
      label: 'Review & Create',
      description: 'Review the details and create your container',
    },
  ];

  const isStepComplete = (step: number): boolean => {
    if (step === 0) {
      return !!formData.customName.trim() && !!formData.totalVolume;
    }
    return true;
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/dashboard')}
          sx={{ textDecoration: 'none' }}
        >
          Dashboard
        </Link>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/containers')}
          sx={{ textDecoration: 'none' }}
        >
          Containers
        </Link>
        <Typography color="textPrimary" variant="body2">
          Create Container
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/containers')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1">
          Create New Container
        </Typography>
      </Box>

      <Paper sx={{ p: 4 }}>
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 4 }}>
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel
                optional={
                  index === 0 && (
                    <Typography variant="caption" color="textSecondary">
                      {isStepComplete(index) ? '✓ Complete' : 'Required fields'}
                    </Typography>
                  )
                }
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  {step.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (index === 0 && !isStepComplete(0)) {
                        toast.warning('Please fill in all required fields');
                        return;
                      }
                      setActiveStep(index + 1);
                    }}
                    disabled={!isStepComplete(index)}
                  >
                    Continue
                  </Button>
                  <Button onClick={() => setActiveStep(0)}>Back</Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              name="customName"
              label="Container Name"
              value={formData.customName}
              onChange={handleChange}
              required
              fullWidth
              placeholder="e.g., Alpha Container, Main Storage, etc."
              error={!!errors.customName}
              helperText={errors.customName || 'Choose a unique name for your container'}
              disabled={submitting}
            />

            <TextField
              name="totalVolume"
              label="Total Volume (m³)"
              type="number"
              value={formData.totalVolume}
              onChange={handleChange}
              required
              fullWidth
              placeholder="e.g., 1000"
              error={!!errors.totalVolume}
              helperText={errors.totalVolume || 'Enter the total capacity of the container'}
              slotProps={{
                htmlInput: { min: 0.01, step: 0.01 },
              }}
              disabled={submitting}
            />

            <TextField
              name="description"
              label="Description (Optional)"
              value={formData.description}
              onChange={handleChange}
              fullWidth
              multiline
              rows={4}
              placeholder="Describe the purpose of this container..."
              disabled={submitting}
            />

            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                ℹ️ Container Code
              </Typography>
              <Typography variant="body2">
                The container code will be auto-generated based on the current timestamp
                and the first 3 letters of your container name.
              </Typography>
              {formData.customName && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Preview:</strong>{' '}
                  <code>
                    {Date.now()}-{formData.customName.trim().substring(0, 3).toUpperCase()}
                  </code>
                </Typography>
              )}
            </Paper>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleCancel}
                disabled={submitting}
                startIcon={<CancelIcon />}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || loading}
                startIcon={<SaveIcon />}
                sx={{ minWidth: 150 }}
              >
                {submitting || loading ? 'Creating...' : 'Create Container'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};