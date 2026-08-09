// src/pages/SessionsPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { ConfirmDialog } from '../components/common/Modals/ConfirmDialog';
import type { Session } from '../types';

const formatRelativeDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return formatDistanceToNow(date, { addSuffix: true });
};

export const SessionsPage = () => {
  const { getSessions, revokeSession } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadSessions = useCallback(
    async (isRefresh = false): Promise<void> => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await getSessions();
        setSessions(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load sessions';
        setError(message);
      } finally {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [getSessions],
  );

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevokeRequest = (sessionId: string): void => {
    setSessionToRevoke(sessionId);
  };

  const handleConfirmRevoke = async (): Promise<void> => {
    if (!sessionToRevoke || revoking) return;

    setRevoking(true);
    setError(null);

    try {
      await revokeSession(sessionToRevoke);
      setSessionToRevoke(null);
      await loadSessions(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to revoke session';
      setError(message);
    } finally {
      setRevoking(false);
    }
  };

  const handleCancelRevoke = (): void => {
    setSessionToRevoke(null);
  };

  const isBusy = loading || refreshing || revoking;

  // Shfaq spinner vetëm për initial load
  if (loading && sessions.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="h4">Active Sessions</Typography>
        <Button
          variant="outlined"
          startIcon={
            refreshing ? <CircularProgress size={18} /> : <RefreshIcon />
          }
          onClick={() => void loadSessions(true)}
          disabled={isBusy}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table aria-label="Active sessions">
            <TableHead>
              <TableRow>
                <TableCell component="th" scope="col">
                  Session ID
                </TableCell>
                <TableCell component="th" scope="col">
                  Created
                </TableCell>
                <TableCell component="th" scope="col">
                  Expires
                </TableCell>
                <TableCell component="th" scope="col">
                  Status
                </TableCell>
                <TableCell component="th" scope="col" align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No active sessions
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {session.id}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatRelativeDate(session.createdAt)}</TableCell>
                    <TableCell>{formatRelativeDate(session.expiresAt)}</TableCell>
                    <TableCell>
                      <Chip
                        label={session.isActive ? 'Active' : 'Revoked'}
                        color={session.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {session.isActive && (
                        <Tooltip title="Revoke session">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRevokeRequest(session.id)}
                            aria-label={`Revoke session ${session.id}`}
                            disabled={isBusy}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ConfirmDialog
        open={!!sessionToRevoke}
        title="Revoke Session"
        message="Are you sure you want to revoke this session? The user will be logged out from this device."
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        onConfirm={handleConfirmRevoke}
        onCancel={handleCancelRevoke}
        loading={revoking}
        confirmColor="error"
      />
    </Box>
  );
};

export default SessionsPage;