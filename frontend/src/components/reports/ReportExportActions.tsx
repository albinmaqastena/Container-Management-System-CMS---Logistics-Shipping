// src/components/reports/ReportExportActions.tsx

import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';

import {
  PictureAsPdfOutlined as PdfIcon,
  TableChartOutlined as ExcelIcon,
  Inventory2Outlined as ContainersIcon,
  CheckCircleOutlined as SelectedIcon,
} from '@mui/icons-material';

interface ReportExportLoadingState {
  allContainersPdf?: boolean;
  allContainersExcel?: boolean;
  selectedContainersPdf?: boolean;
  selectedContainersExcel?: boolean;
}

interface ReportExportActionsProps {
  selectedCount: number;

  onExportAllPdf: () => void;
  onExportAllExcel: () => void;

  onExportSelectedPdf: () => void;
  onExportSelectedExcel: () => void;

  loading?: ReportExportLoadingState;

  disabled?: boolean;
}

export const ReportExportActions = ({
  selectedCount,
  onExportAllPdf,
  onExportAllExcel,
  onExportSelectedPdf,
  onExportSelectedExcel,
  loading = {},
  disabled = false,
}: ReportExportActionsProps) => {
  const {
    allContainersPdf = false,
    allContainersExcel = false,
    selectedContainersPdf = false,
    selectedContainersExcel = false,
  } = loading;

  const isAnyLoading =
    allContainersPdf ||
    allContainersExcel ||
    selectedContainersPdf ||
    selectedContainersExcel;

  const selectedDisabled =
    disabled ||
    isAnyLoading ||
    selectedCount === 0;

  const allDisabled =
    disabled || isAnyLoading;

  const buttonSx = {
    minHeight: 44,

    borderRadius: 2,

    fontSize: '0.8rem',

    fontWeight: 700,

    textTransform: 'none',

    boxShadow: 'none',
  } as const;

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',

        overflow: 'hidden',

        border:
          '1px solid #d7d7db',

        borderRadius: 2.5,

        backgroundColor:
          '#ffffff',

        boxShadow:
          '0 5px 18px rgba(0,0,0,0.04)',
      }}
    >
      {/* All Containers */}
      <Box
        sx={{
          p: {
            xs: 1.75,
            sm: 2.25,
          },

          borderBottom:
            '1px solid #e1e1e4',
        }}
      >
        <Box
          sx={{
            display: 'flex',

            alignItems: 'center',

            gap: 1.25,

            mb: 1.75,
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,

              flexShrink: 0,

              display: 'flex',

              alignItems: 'center',

              justifyContent:
                'center',

              borderRadius: 1.75,

              backgroundColor:
                '#f1f1f3',

              border:
                '1px solid #dedee2',

              color: '#55555a',
            }}
          >
            <ContainersIcon
              sx={{
                fontSize: 20,
              }}
            />
          </Box>

          <Box>
            <Typography
              sx={{
                color: '#202024',

                fontSize: '0.88rem',

                fontWeight: 800,
              }}
            >
              All Containers
            </Typography>

            <Typography
              sx={{
                mt: 0.2,

                color: '#77777c',

                fontSize: '0.7rem',

                fontWeight: 500,

                lineHeight: 1.45,
              }}
            >
              Generate one report containing
              every available container.
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',

            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
            },

            gap: 1,
          }}
        >
          <Button
            variant="outlined"
            startIcon={
              allContainersPdf ? (
                <CircularProgress
                  size={17}
                  color="inherit"
                />
              ) : (
                <PdfIcon />
              )
            }
            onClick={
              onExportAllPdf
            }
            disabled={allDisabled}
            sx={{
              ...buttonSx,

              borderColor:
                '#d4b9bc',

              color: '#a8323b',

              backgroundColor:
                '#ffffff',

              '&:hover': {
                borderColor:
                  '#c78f95',

                backgroundColor:
                  '#fff5f5',
              },
            }}
          >
            {allContainersPdf
              ? 'Generating...'
              : 'Export All PDF'}
          </Button>

          <Button
            variant="outlined"
            startIcon={
              allContainersExcel ? (
                <CircularProgress
                  size={17}
                  color="inherit"
                />
              ) : (
                <ExcelIcon />
              )
            }
            onClick={
              onExportAllExcel
            }
            disabled={allDisabled}
            sx={{
              ...buttonSx,

              borderColor:
                '#bfd6c7',

              color: '#327047',

              backgroundColor:
                '#ffffff',

              '&:hover': {
                borderColor:
                  '#91bca0',

                backgroundColor:
                  '#f2f8f4',
              },
            }}
          >
            {allContainersExcel
              ? 'Generating...'
              : 'Export All Excel'}
          </Button>
        </Box>
      </Box>

      {/* Selected Containers */}
      <Box
        sx={{
          p: {
            xs: 1.75,
            sm: 2.25,
          },

          backgroundColor:
            selectedCount > 0
              ? '#fafafa'
              : '#f7f7f8',
        }}
      >
        <Box
          sx={{
            display: 'flex',

            alignItems: 'center',

            justifyContent:
              'space-between',

            gap: 1.5,

            mb: 1.75,
          }}
        >
          <Box
            sx={{
              display: 'flex',

              alignItems: 'center',

              gap: 1.25,
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,

                flexShrink: 0,

                display: 'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',

                borderRadius: 1.75,

                backgroundColor:
                  selectedCount > 0
                    ? '#eeeeF0'
                    : '#f1f1f3',

                border:
                  '1px solid #dedee2',

                color:
                  selectedCount > 0
                    ? '#202024'
                    : '#85858a',
              }}
            >
              <SelectedIcon
                sx={{
                  fontSize: 20,
                }}
              />
            </Box>

            <Box>
              <Typography
                sx={{
                  color: '#202024',

                  fontSize:
                    '0.88rem',

                  fontWeight:
                    800,
                }}
              >
                Selected Containers
              </Typography>

              <Typography
                sx={{
                  mt: 0.2,

                  color: '#77777c',

                  fontSize:
                    '0.7rem',

                  fontWeight:
                    500,

                  lineHeight:
                    1.45,
                }}
              >
                Export only the
                containers you selected.
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              minWidth: 34,

              height: 28,

              px: 1,

              display: 'flex',

              alignItems: 'center',

              justifyContent:
                'center',

              borderRadius: 999,

              backgroundColor:
                selectedCount > 0
                  ? '#202024'
                  : '#e4e4e7',

              color:
                selectedCount > 0
                  ? '#ffffff'
                  : '#77777c',

              fontSize: '0.7rem',

              fontWeight: 800,
            }}
          >
            {selectedCount}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',

            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
            },

            gap: 1,
          }}
        >
          <Button
            variant="outlined"
            startIcon={
              selectedContainersPdf ? (
                <CircularProgress
                  size={17}
                  color="inherit"
                />
              ) : (
                <PdfIcon />
              )
            }
            onClick={
              onExportSelectedPdf
            }
            disabled={
              selectedDisabled
            }
            sx={{
              ...buttonSx,

              borderColor:
                '#d4b9bc',

              color: '#a8323b',

              backgroundColor:
                '#ffffff',

              '&:hover': {
                borderColor:
                  '#c78f95',

                backgroundColor:
                  '#fff5f5',
              },

              '&.Mui-disabled':
                {
                  borderColor:
                    '#ddddE1',

                  color:
                    '#9a9a9f',

                  backgroundColor:
                    '#f5f5f6',
                },
            }}
          >
            {selectedContainersPdf
              ? 'Generating...'
              : 'Export Selected PDF'}
          </Button>

          <Button
            variant="outlined"
            startIcon={
              selectedContainersExcel ? (
                <CircularProgress
                  size={17}
                  color="inherit"
                />
              ) : (
                <ExcelIcon />
              )
            }
            onClick={
              onExportSelectedExcel
            }
            disabled={
              selectedDisabled
            }
            sx={{
              ...buttonSx,

              borderColor:
                '#bfd6c7',

              color: '#327047',

              backgroundColor:
                '#ffffff',

              '&:hover': {
                borderColor:
                  '#91bca0',

                backgroundColor:
                  '#f2f8f4',
              },

              '&.Mui-disabled':
                {
                  borderColor:
                    '#ddddE1',

                  color:
                    '#9a9a9f',

                  backgroundColor:
                    '#f5f5f6',
                },
            }}
          >
            {selectedContainersExcel
              ? 'Generating...'
              : 'Export Selected Excel'}
          </Button>
        </Box>

        {selectedCount === 0 && (
          <Typography
            sx={{
              mt: 1.25,

              color: '#85858a',

              fontSize: '0.68rem',

              fontWeight: 500,

              textAlign: 'center',
            }}
          >
            Select at least one container
            to enable selected exports.
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default ReportExportActions;