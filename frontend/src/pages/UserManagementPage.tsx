// src/pages/UserManagementPage.tsx

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

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
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';

import type { ChipProps } from '@mui/material';

import {
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';

import { toast } from 'react-toastify';
import axios from 'axios';

import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { ROLES } from '../utilis/constants';
import { ConfirmDialog } from '../components/common/Modals/ConfirmDialog';
import { RegisterForm } from '../components/auths/RegisterForm';

import type { User } from '../types';

// Helpers jashtë komponentit
const getErrorMessage = (
  error: unknown,
): string => {
  if (axios.isAxiosError(error)) {
    const message =
      error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (
      typeof message === 'string'
    ) {
      return message;
    }

    return error.message;
  }

  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred';
};

const getRoleColor = (
  role: string,
): ChipProps['color'] => {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'error';

    case ROLES.ADMIN:
      return 'warning';

    default:
      return 'primary';
  }
};

const formatRoleLabel = (
  role: string,
): string => {
  return role
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (char) => char.toUpperCase(),
    );
};

export const UserManagementPage = () => {
  const {
    user: currentUser,
    isLoading: authLoading,
  } = useAuth();

  const [
    users,
    setUsers,
  ] = useState<User[]>([]);

  const [
    deletedUsers,
    setDeletedUsers,
  ] = useState<User[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    showDeleted,
    setShowDeleted,
  ] = useState(false);

  const [
    isRegisterDialogOpen,
    setIsRegisterDialogOpen,
  ] = useState(false);

  const [
    registerLoading,
    setRegisterLoading,
  ] = useState(false);

  // Confirm dialog states
  const [
    deleteTargetId,
    setDeleteTargetId,
  ] = useState<string | null>(
    null,
  );

  const [
    permanentDeleteTargetId,
    setPermanentDeleteTargetId,
  ] = useState<
    string | null
  >(null);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const isSuperAdmin =
    currentUser?.role ===
    ROLES.SUPER_ADMIN;

  const isAdmin =
    currentUser?.role ===
      ROLES.ADMIN ||
    isSuperAdmin;

  const loadUsers =
    useCallback(
      async (): Promise<void> => {
        try {
          setLoading(true);
          setError(null);

          const response =
            await authService.getUsers();

          setUsers(
            response.data,
          );
        } catch (
          err: unknown
        ) {
          setError(
            getErrorMessage(err),
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  const loadDeletedUsers =
    useCallback(
      async (): Promise<void> => {
        try {
          const response =
            await authService.getDeletedUsers();

          setDeletedUsers(
            response.data,
          );
        } catch (
          err: unknown
        ) {
          setError(
            getErrorMessage(err),
          );
        }
      },
      [],
    );

  // Ngarko të dhënat vetëm pasi auth të ketë përfunduar dhe të jetë admin
  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;

    void loadUsers();

    if (isSuperAdmin) {
      void loadDeletedUsers();
    }
  }, [
    authLoading,
    isAdmin,
    isSuperAdmin,
    loadUsers,
    loadDeletedUsers,
  ]);

  const handleRegisterSuccess =
    useCallback(
      async (): Promise<void> => {
        setIsRegisterDialogOpen(
          false,
        );

        await loadUsers();

        if (isSuperAdmin) {
          await loadDeletedUsers();
        }
      },
      [
        loadUsers,
        isSuperAdmin,
        loadDeletedUsers,
      ],
    );

  const handleRegisterLoadingChange =
    useCallback(
      (
        isLoading: boolean,
      ): void => {
        setRegisterLoading(
          isLoading,
        );
      },
      [],
    );

  const handleSoftDeleteRequest = (
    userId: string,
  ): void => {
    setDeleteTargetId(userId);
  };

  const handleConfirmSoftDelete =
    async (): Promise<void> => {
      if (
        !deleteTargetId ||
        actionLoading
      ) {
        return;
      }

      setActionLoading(true);

      try {
        await authService.softDeleteUser(
          deleteTargetId,
        );

        toast.success(
          'User moved to trash',
        );

        setDeleteTargetId(null);

        await loadUsers();

        if (isSuperAdmin) {
          await loadDeletedUsers();
        }
      } catch (err: unknown) {
        toast.error(
          getErrorMessage(err) ||
            'Failed to delete user',
        );
      } finally {
        setActionLoading(false);
      }
    };

  const handleCancelSoftDelete =
    (): void => {
      setDeleteTargetId(null);
    };

  const handlePermanentDeleteRequest =
    (
      userId: string,
    ): void => {
      setPermanentDeleteTargetId(
        userId,
      );
    };

  const handleConfirmPermanentDelete =
    async (): Promise<void> => {
      if (
        !permanentDeleteTargetId ||
        actionLoading
      ) {
        return;
      }

      setActionLoading(true);

      try {
        await authService.permanentDeleteUser(
          permanentDeleteTargetId,
        );

        toast.success(
          'User permanently deleted',
        );

        setPermanentDeleteTargetId(
          null,
        );

        if (isSuperAdmin) {
          await loadDeletedUsers();
        }
      } catch (err: unknown) {
        toast.error(
          getErrorMessage(err) ||
            'Failed to permanently delete user',
        );
      } finally {
        setActionLoading(false);
      }
    };

  const handleCancelPermanentDelete =
    (): void => {
      setPermanentDeleteTargetId(
        null,
      );
    };

  const handleRestore = async (
    userId: string,
  ): Promise<void> => {
    if (actionLoading) return;

    setActionLoading(true);

    try {
      await authService.restoreUser(
        userId,
      );

      toast.success(
        'User restored successfully!',
      );

      await loadUsers();

      if (isSuperAdmin) {
        await loadDeletedUsers();
      }
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) ||
          'Failed to restore user',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Loading gjatë autentikimit
  if (authLoading) {
    return (
      <Box
        sx={{
          minHeight: 320,

          display: 'flex',

          alignItems:
            'center',

          justifyContent:
            'center',
        }}
      >
        <CircularProgress
          size={34}
          thickness={4}
          sx={{
            color: '#202024',
          }}
        />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box
        sx={{
          minHeight: 320,

          display: 'flex',

          alignItems:
            'center',

          justifyContent:
            'center',

          px: 2,
        }}
      >
        <Alert
          severity="error"
          sx={{
            maxWidth: 520,

            width: '100%',

            borderRadius: 2,

            backgroundColor:
              '#fff4f5',

            color:
              '#9b2831',

            border:
              '1px solid #efc9cc',

            fontWeight: 600,

            '& .MuiAlert-icon':
              {
                color:
                  '#c9363f',
              },
          }}
        >
          You don&apos;t have
          permission to view this
          page.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 320,

          display: 'flex',

          alignItems:
            'center',

          justifyContent:
            'center',
        }}
      >
        <CircularProgress
          size={34}
          thickness={4}
          sx={{
            color: '#202024',
          }}
        />
      </Box>
    );
  }

  const displayedUsers =
    showDeleted
      ? deletedUsers
      : users;

  return (
    <Box
      sx={{
        width: '100%',

        minWidth: 0,

        px: {
          xs: 0,
          sm: 0.5,
          md: 1,
        },

        pb: {
          xs: 3,
          sm: 4,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            sm: 'row',
          },

          justifyContent:
            'space-between',

          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },

          gap: 2,

          mb: {
            xs: 2.5,
            sm: 3,
          },
        }}
      >
        <Box
          sx={{
            minWidth: 0,
          }}
        >
          <Typography
            component="h1"
            sx={{
              color:
                '#17171a',

              fontSize: {
                xs: '1.65rem',
                sm: '1.95rem',
                md: '2.15rem',
              },

              fontWeight:
                800,

              lineHeight:
                1.15,

              letterSpacing:
                '-0.035em',
            }}
          >
            {showDeleted
              ? 'Deleted Users'
              : 'User Management'}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              mt: 0.6,

              color:
                '#6b6b70',

              fontSize: {
                xs: '0.8rem',
                sm: '0.86rem',
              },

              fontWeight:
                500,

              lineHeight:
                1.5,
            }}
          >
            {showDeleted
              ? 'Review and manage deleted user accounts.'
              : 'Manage users, roles and account access.'}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',

            flexDirection: {
              xs: 'column',
              sm: 'row',
            },

            gap: 1.25,

            width: {
              xs: '100%',
              sm: 'auto',
            },
          }}
        >
          {isSuperAdmin && (
            <Button
              variant="outlined"
              onClick={() =>
                setShowDeleted(
                  (prev) =>
                    !prev,
                )
              }
              sx={{
                minHeight: 44,

                px: 2,

                borderRadius:
                  2,

                borderColor:
                  '#c9c9ce',

                color:
                  '#35353a',

                backgroundColor:
                  '#ffffff',

                fontSize:
                  '0.82rem',

                fontWeight:
                  700,

                textTransform:
                  'none',

                boxShadow:
                  'none',

                '&:hover': {
                  borderColor:
                    '#202024',

                  color:
                    '#202024',

                  backgroundColor:
                    '#f5f5f6',

                  boxShadow:
                    'none',
                },
              }}
            >
              {showDeleted
                ? 'Show Active'
                : 'Show Deleted'}
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={
              <PersonAddIcon />
            }
            onClick={() =>
              setIsRegisterDialogOpen(
                true,
              )
            }
            sx={{
              minHeight: 44,

              px: 2.2,

              borderRadius: 2,

              backgroundColor:
                '#202024',

              color:
                '#ffffff',

              fontSize:
                '0.82rem',

              fontWeight:
                700,

              textTransform:
                'none',

              boxShadow:
                'none',

              '&:hover': {
                backgroundColor:
                  '#111114',

                color:
                  '#ffffff',

                boxShadow:
                  '0 6px 16px rgba(0,0,0,0.12)',
              },
            }}
          >
            Register User
          </Button>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert
          severity="error"
          onClose={() =>
            setError(null)
          }
          sx={{
            mb: 2.5,

            borderRadius: 2,

            backgroundColor:
              '#fff4f5',

            color:
              '#9b2831',

            border:
              '1px solid #efc9cc',

            fontWeight: 600,

            '& .MuiAlert-icon':
              {
                color:
                  '#c9363f',
              },
          }}
        >
          {error}
        </Alert>
      )}

      {/* Table */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',

          overflow: 'hidden',

          borderRadius: 3,

          backgroundColor:
            '#ffffff',

          border:
            '1px solid #d7d7db',

          boxShadow:
            '0 6px 20px rgba(0,0,0,0.05)',
        }}
      >
        <TableContainer
          sx={{
            width: '100%',

            overflowX: 'auto',

            '&::-webkit-scrollbar':
              {
                height: 6,
              },

            '&::-webkit-scrollbar-thumb':
              {
                backgroundColor:
                  '#c7c7cc',

                borderRadius:
                  999,
              },
          }}
        >
          <Table
            aria-label="User management table"
            sx={{
              minWidth: 760,
            }}
          >
            <TableHead
              sx={{
                backgroundColor:
                  '#f5f5f6',
              }}
            >
              <TableRow>
                {[
                  'Username',
                  'Email',
                  'Role',
                  'Status',
                ].map(
                  (label) => (
                    <TableCell
                      key={
                        label
                      }
                      component="th"
                      scope="col"
                      sx={{
                        py: 1.6,

                        color:
                          '#55555a',

                        fontSize:
                          '0.72rem',

                        fontWeight:
                          800,

                        textTransform:
                          'uppercase',

                        letterSpacing:
                          '0.045em',

                        borderBottom:
                          '1px solid #dcdce0',
                      }}
                    >
                      {label}
                    </TableCell>
                  ),
                )}

                <TableCell
                  component="th"
                  scope="col"
                  align="right"
                  sx={{
                    py: 1.6,

                    color:
                      '#55555a',

                    fontSize:
                      '0.72rem',

                    fontWeight:
                      800,

                    textTransform:
                      'uppercase',

                    letterSpacing:
                      '0.045em',

                    borderBottom:
                      '1px solid #dcdce0',
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {displayedUsers.length ===
              0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    align="center"
                    sx={{
                      py: 7,

                      borderBottom:
                        'none',
                    }}
                  >
                    <Typography
                      sx={{
                        color:
                          '#737378',

                        fontSize:
                          '0.86rem',

                        fontWeight:
                          600,
                      }}
                    >
                      {showDeleted
                        ? 'No deleted users'
                        : 'No users found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayedUsers.map(
                  (user) => (
                    <TableRow
                      key={
                        user.id
                      }
                      hover
                      sx={{
                        transition:
                          'background-color 0.15s ease',

                        '&:hover':
                          {
                            backgroundColor:
                              '#f8f8f9 !important',
                          },

                        '&:last-child td':
                          {
                            borderBottom:
                              'none',
                          },
                      }}
                    >
                      <TableCell
                        sx={{
                          py: 1.6,

                          color:
                            '#202024',

                          fontSize:
                            '0.84rem',

                          fontWeight:
                            700,

                          borderColor:
                            '#ececef',
                        }}
                      >
                        {
                          user.username
                        }
                      </TableCell>

                      <TableCell
                        sx={{
                          py: 1.6,

                          color:
                            '#66666b',

                          fontSize:
                            '0.82rem',

                          fontWeight:
                            500,

                          borderColor:
                            '#ececef',

                          overflowWrap:
                            'anywhere',
                        }}
                      >
                        {
                          user.email
                        }
                      </TableCell>

                      <TableCell
                        sx={{
                          py: 1.6,

                          borderColor:
                            '#ececef',
                        }}
                      >
                        <Chip
                          label={formatRoleLabel(
                            user.role,
                          )}
                          color={getRoleColor(
                            user.role,
                          )}
                          size="small"
                          sx={{
                            height:
                              27,

                            borderRadius:
                              999,

                            fontSize:
                              '0.68rem',

                            fontWeight:
                              700,

                            '& .MuiChip-label':
                              {
                                px: 1.2,
                              },
                          }}
                        />
                      </TableCell>

                      <TableCell
                        sx={{
                          py: 1.6,

                          borderColor:
                            '#ececef',
                        }}
                      >
                        <Chip
                          label={
                            user.isActive
                              ? 'Active'
                              : 'Inactive'
                          }
                          color={
                            user.isActive
                              ? 'success'
                              : 'default'
                          }
                          size="small"
                          sx={{
                            height:
                              27,

                            borderRadius:
                              999,

                            fontSize:
                              '0.68rem',

                            fontWeight:
                              700,
                          }}
                        />
                      </TableCell>

                      <TableCell
                        align="right"
                        sx={{
                          py: 1.2,

                          borderColor:
                            '#ececef',
                        }}
                      >
                        {showDeleted ? (
                          <Box
                            sx={{
                              display:
                                'flex',

                              justifyContent:
                                'flex-end',

                              gap: 0.75,
                            }}
                          >
                            <Tooltip title="Restore user">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() =>
                                  void handleRestore(
                                    user.id,
                                  )
                                }
                                aria-label={`Restore ${user.username}`}
                                disabled={
                                  actionLoading
                                }
                                sx={{
                                  width:
                                    36,

                                  height:
                                    36,

                                  borderRadius:
                                    1.75,

                                  color:
                                    '#3f5368',

                                  backgroundColor:
                                    '#ffffff',

                                  border:
                                    '1px solid #d7d7db',

                                  '&:hover':
                                    {
                                      color:
                                        '#202024',

                                      backgroundColor:
                                        '#f2f2f4',

                                      borderColor:
                                        '#bdbdc2',
                                    },

                                  '&.Mui-disabled':
                                    {
                                      color:
                                        '#99999e',

                                      backgroundColor:
                                        '#f2f2f4',

                                      opacity:
                                        1,
                                    },
                                }}
                              >
                                <RestoreIcon
                                  sx={{
                                    fontSize:
                                      19,
                                  }}
                                />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Permanently delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  handlePermanentDeleteRequest(
                                    user.id,
                                  )
                                }
                                aria-label={`Permanently delete ${user.username}`}
                                disabled={
                                  actionLoading
                                }
                                sx={{
                                  width:
                                    36,

                                  height:
                                    36,

                                  borderRadius:
                                    1.75,

                                  color:
                                    '#c9363f',

                                  backgroundColor:
                                    '#ffffff',

                                  border:
                                    '1px solid #ebc8cb',

                                  '&:hover':
                                    {
                                      color:
                                        '#b92832',

                                      backgroundColor:
                                        '#fff4f5',

                                      borderColor:
                                        '#df9fa5',
                                    },

                                  '&.Mui-disabled':
                                    {
                                      color:
                                        '#b9b9bd',

                                      backgroundColor:
                                        '#f2f2f4',

                                      borderColor:
                                        '#dedee1',

                                      opacity:
                                        1,
                                    },
                                }}
                              >
                                <DeleteForeverIcon
                                  sx={{
                                    fontSize:
                                      19,
                                  }}
                                />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          user.id !==
                            currentUser?.id && (
                            <Tooltip title="Delete user">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  handleSoftDeleteRequest(
                                    user.id,
                                  )
                                }
                                aria-label={`Delete ${user.username}`}
                                disabled={
                                  actionLoading
                                }
                                sx={{
                                  width:
                                    36,

                                  height:
                                    36,

                                  borderRadius:
                                    1.75,

                                  color:
                                    '#c9363f',

                                  backgroundColor:
                                    '#ffffff',

                                  border:
                                    '1px solid #ebc8cb',

                                  '&:hover':
                                    {
                                      color:
                                        '#b92832',

                                      backgroundColor:
                                        '#fff4f5',

                                      borderColor:
                                        '#df9fa5',
                                    },

                                  '&.Mui-disabled':
                                    {
                                      color:
                                        '#b9b9bd',

                                      backgroundColor:
                                        '#f2f2f4',

                                      borderColor:
                                        '#dedee1',

                                      opacity:
                                        1,
                                    },
                                }}
                              >
                                <DeleteIcon
                                  sx={{
                                    fontSize:
                                      19,
                                  }}
                                />
                              </IconButton>
                            </Tooltip>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Register Dialog - përdor RegisterForm */}
      <Dialog
        open={
          isRegisterDialogOpen
        }
        onClose={(
          _,
          reason,
        ) => {
          if (
            registerLoading &&
            (reason ===
              'backdropClick' ||
              reason ===
                'escapeKeyDown')
          ) {
            return;
          }

          setIsRegisterDialogOpen(
            false,
          );
        }}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor:
                'rgba(17,17,20,0.50)',
            },
          },

          paper: {
            sx: {
              mx: {
                xs: 1.25,
                sm: 2,
              },

              borderRadius:
                2.5,

              backgroundColor:
                '#ffffff',

              border:
                '1px solid #d3d3d8',

              boxShadow:
                '0 18px 42px rgba(0,0,0,0.18)',

              overflow:
                'hidden',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            py: 2,

            color:
              '#18181b',

            fontSize: {
              xs: '1.15rem',
              sm: '1.3rem',
            },

            fontWeight:
              800,

            letterSpacing:
              '-0.025em',

            backgroundColor:
              '#f5f5f6',

            borderBottom:
              '1px solid #dedee2',
          }}
        >
          Register New User
        </DialogTitle>

        <DialogContent
          sx={{
            px: {
              xs: 2.25,
              sm: 3,
            },

            pt: {
              xs: 2.5,
              sm: 3,
            },

            pb: 2.5,

            backgroundColor:
              '#ffffff',

            '& .MuiOutlinedInput-root':
              {
                borderRadius:
                  2,

                backgroundColor:
                  '#ffffff',

                '& fieldset':
                  {
                    borderColor:
                      '#c9c9ce',
                  },

                '&:hover fieldset':
                  {
                    borderColor:
                      '#9f9fa5',
                  },

                '&.Mui-focused fieldset':
                  {
                    borderColor:
                      '#202024',

                    borderWidth:
                      1.5,
                  },
              },

            '& .MuiInputLabel-root.Mui-focused':
              {
                color:
                  '#202024',
              },

            '& .MuiButton-contained':
              {
                backgroundColor:
                  '#202024',

                color:
                  '#ffffff',

                borderRadius:
                  2,

                fontWeight:
                  700,

                textTransform:
                  'none',

                boxShadow:
                  'none',

                '&:hover':
                  {
                    backgroundColor:
                      '#111114',

                    color:
                      '#ffffff',
                  },
              },
          }}
        >
          <RegisterForm
            onSuccess={
              handleRegisterSuccess
            }
            onLoadingChange={
              handleRegisterLoadingChange
            }
          />

          <Box
            sx={{
              mt: 2,

              textAlign:
                'center',
            }}
          >
            <Button
              variant="text"
              onClick={() =>
                setIsRegisterDialogOpen(
                  false,
                )
              }
              disabled={
                registerLoading
              }
              sx={{
                color:
                  '#55555a',

                fontWeight:
                  700,

                textTransform:
                  'none',

                '&:hover':
                  {
                    color:
                      '#202024',

                    backgroundColor:
                      '#f3f3f5',
                  },

                '&.Mui-disabled':
                  {
                    color:
                      '#a0a0a5',
                  },
              }}
            >
              Cancel
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Confirm Soft Delete Dialog */}
      <ConfirmDialog
        open={
          !!deleteTargetId
        }
        title="Delete User"
        message="Are you sure you want to delete this user? They will be moved to trash."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={
          handleConfirmSoftDelete
        }
        onCancel={
          handleCancelSoftDelete
        }
        loading={
          actionLoading
        }
        confirmColor="error"
      />

      {/* Confirm Permanent Delete Dialog */}
      <ConfirmDialog
        open={
          !!permanentDeleteTargetId
        }
        title="Permanently Delete User"
        message="This action cannot be undone. Are you sure you want to permanently delete this user?"
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        onConfirm={
          handleConfirmPermanentDelete
        }
        onCancel={
          handleCancelPermanentDelete
        }
        loading={
          actionLoading
        }
        confirmColor="error"
      />
    </Box>
  );
};

export default UserManagementPage;