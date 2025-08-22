import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Card,
  CardContent,
  Alert,
  Slider,
  Stack,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Psychology as PsychologyIcon,
  Security as SecurityIcon,
  Timer as TimerIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  CreditCard as CreditCardIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  Tag as TagIcon,
  Badge as BadgeIcon,
  VpnKey as SSNIcon,
  Domain as OrgIcon,
  Inventory as ProductIcon,
  Engineering as ServiceIcon,
  Folder as ProjectIcon,
  Lock as ProprietaryIcon,
  Home as AddressIcon,
  AccountBalance as AccountIcon,
  LocalHospital as MedicalIcon,
  ExpandLess as ExpandLessIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PictureAsPdfIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { ResultDisplayProps, PIIDetection } from '../types';
import { exportToCSV, exportToPDF, prepareExportData } from '../utils/exportUtils';

interface ResultDisplayExtendedProps extends ResultDisplayProps {
  inactiveOccurrences?: Set<number>;
  onToggleOccurrence?: (occurrenceIndex: number, isActive: boolean) => void;
  onToggleAllOccurrences?: (placeholder: string, isActive: boolean) => void;
  onToggleEntity?: (originalText: string, isActive: boolean) => void;
}

const ResultDisplay: React.FC<ResultDisplayExtendedProps> = ({
  originalText,
  anonymizedText,
  reasoning,
  showReasoning,
  onToggleReasoning,
  inactiveOccurrences = new Set(),
  onToggleOccurrence,
  onToggleAllOccurrences,
  onToggleEntity,
}) => {
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0);
  const [sliderActive, setSliderActive] = useState<boolean>(true);
  const [manualOverrides, setManualOverrides] = useState<boolean>(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Count detections (backend already sends one per occurrence)
  const countOccurrences = () => {
    const totalCount = reasoning.detected_pii.length;
    let inactiveCount = 0;
    
    reasoning.detected_pii.forEach((detection, idx) => {
      const occurrenceIndex = detection.i ?? idx;
      if (inactiveOccurrences.has(occurrenceIndex)) {
        inactiveCount++;
      }
    });
    
    return { total: totalCount, inactive: inactiveCount, active: totalCount - inactiveCount };
  };
  
  const occurrenceCounts = countOccurrences();

  // Handle slider changes - reset all activations then apply threshold
  const handleSliderChange = (value: number) => {
    setConfidenceThreshold(value);
    setSliderActive(true);
    setManualOverrides(false);
    
    if (onToggleOccurrence && reasoning) {
      // First, activate ALL occurrences (reset everything)
      reasoning.detected_pii.forEach((detection, idx) => {
        const occurrenceIndex = detection.i ?? idx;
        if (inactiveOccurrences.has(occurrenceIndex)) {
          onToggleOccurrence(occurrenceIndex, true);
        }
      });
      
      // Then, deactivate occurrences below threshold
      if (value > 0) {
        reasoning.detected_pii.forEach((detection, idx) => {
          const occurrenceIndex = detection.i ?? idx;
          const confidencePercent = detection.confidence * 100;
          if (confidencePercent < value) {
            onToggleOccurrence(occurrenceIndex, false);
          }
        });
      }
    }
  };

  // Export handlers
  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportMenuAnchor(null);
  };

  const handleExportCSV = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    // Debug: Log what we're exporting
    console.log('[Export] Detections being exported:', {
      count: reasoning.detected_pii?.length,
      detections: reasoning.detected_pii,
      inactiveOccurrences: Array.from(inactiveOccurrences)
    });
    
    const exportData = prepareExportData(
      originalText,
      anonymizedText,
      reasoning.detected_pii,
      inactiveOccurrences,
      reasoning.processing_time,
      reasoning.confidence_avg,
      reasoning.chunks_processed
    );
    exportToCSV(exportData);
    handleExportClose();
  };

  const handleExportPDF = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const exportData = prepareExportData(
      originalText,
      anonymizedText,
      reasoning.detected_pii,
      inactiveOccurrences,
      reasoning.processing_time,
      reasoning.confidence_avg,
      reasoning.chunks_processed
    );
    exportToPDF(exportData);
    handleExportClose();
  };

  if (!reasoning) {
    return null;
  }

  return (
    <Box>
      {/* Statistics Summary */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" gap={2} alignItems="center">
              <Chip
                icon={<SecurityIcon />}
                label={`${occurrenceCounts.active} + ${occurrenceCounts.inactive} Sensitive items`}
                color="primary"
                size="small"
              />
              <Chip
                icon={<TimerIcon />}
                label={`${reasoning.processing_time ? reasoning.processing_time.toFixed(2) : '0.00'}s`}
                color="secondary"
                size="small"
              />
              {reasoning.chunks_processed > 1 && (
                <Chip
                  label={`${reasoning.chunks_processed} chunks`}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
            <Box>
              <Chip
                label={`${reasoning.confidence_avg ? (reasoning.confidence_avg * 100).toFixed(0) : 'N/A'}% confidence`}
                color={getConfidenceColor(reasoning.confidence_avg || 0)}
                size="small"
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Sensitive Information Detections */}
      {reasoning.detected_pii.length > 0 && (
        <Box position="relative" sx={{ 
          '& .MuiAccordion-root': {
            borderRadius: '4px 4px 0 0',  // Round only top corners
            '&:before': {
              display: 'none',  // Remove the default top border
            }
          },
          '& .MuiAccordion-root.Mui-expanded': {
            borderRadius: '4px 4px 0 0',  // Keep top corners rounded when expanded
          }
        }}>
          {/* Export button positioned absolutely */}
          <Box sx={{ position: 'absolute', right: 48, top: 8, zIndex: 1 }}>
            <IconButton
              size="small"
              onClick={handleExportClick}
              sx={{ 
                border: '1px solid rgba(0, 0, 0, 0.23)',
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                bgcolor: 'background.paper',
                position: 'relative',
                zIndex: 2,  // Ensure button is above accordion
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(25, 118, 210, 0.04)',
                  zIndex: 3  // Even higher on hover
                }
              }}
            >
              <FileDownloadIcon fontSize="small" />
              <Typography variant="body2" sx={{ ml: 0.5, mr: 0.5, fontSize: '0.875rem' }}>
                Export
              </Typography>
              <ExpandMoreIcon fontSize="small" sx={{ ml: 0.5 }} />
            </IconButton>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={handleExportClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={handleExportCSV}>
                <ListItemIcon>
                  <TableChartIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Export as CSV</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleExportPDF}>
                <ListItemIcon>
                  <PictureAsPdfIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Export as PDF</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
          
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <SecurityIcon color="primary" />
                <Typography variant="h6">
                  Sensitive Information ({occurrenceCounts.active} active + {occurrenceCounts.inactive} inactive)
                </Typography>
              </Box>
            </AccordionSummary>
          <AccordionDetails>
            {/* Confidence Threshold Slider */}
            <Box sx={{ px: 2, pb: 2, pt: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Confidence Threshold Filter
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {!sliderActive 
                      ? 'Manual overrides active'
                      : confidenceThreshold > 0 
                      ? `Hiding items < ${confidenceThreshold}%`
                      : 'All items visible'}
                  </Typography>
                </Box>
                <Box sx={{ px: 1, pb: 1 }}>
                  <Slider
                    value={confidenceThreshold}
                    onChange={(_, value) => handleSliderChange(value as number)}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 25, label: '25%' },
                      { value: 50, label: '50%' },
                      { value: 75, label: '75%' },
                      { value: 100, label: '100%' }
                    ]}
                    valueLabelDisplay="on"
                    valueLabelFormat={(value) => value === 0 ? 'Off' : `${value}%`}
                    sx={{
                      color: sliderActive ? '#ef4444' : '#9ca3af',
                      '& .MuiSlider-thumb': {
                        bgcolor: sliderActive ? '#ef4444' : '#9ca3af',
                        '&:hover': {
                          bgcolor: sliderActive ? '#dc2626' : '#6b7280',
                        },
                      },
                      '& .MuiSlider-track': {
                        bgcolor: sliderActive ? '#ef4444' : '#9ca3af',
                        border: 'none',
                      },
                      '& .MuiSlider-rail': {
                        bgcolor: sliderActive ? '#fecaca' : '#e5e7eb',
                        opacity: 1,
                      },
                      '& .MuiSlider-mark': {
                        bgcolor: sliderActive ? '#ef4444' : '#9ca3af',
                        height: 8,
                        width: 2,
                      },
                      '& .MuiSlider-markLabel': {
                        fontSize: '0.7rem',
                        color: '#6b7280',
                        top: 26,
                      },
                      '& .MuiSlider-valueLabel': {
                        bgcolor: sliderActive ? '#ef4444' : '#9ca3af',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        '&::before': {
                          borderTopColor: sliderActive ? '#ef4444' : '#9ca3af',
                        },
                      },
                    }}
                  />
                </Box>
              </Stack>
            </Box>
            
            <List dense>
              {(() => {
                // Create ordered array from detections
                let detectionsArray: PIIDetection[];
                
                if (reasoning.detected_pii.length > 0 && 'i' in reasoning.detected_pii[0]) {
                  // Backend provided order - create array with proper indices
                  const maxIndex = Math.max(...reasoning.detected_pii.map(d => d.i || 0));
                  detectionsArray = new Array(maxIndex + 1);
                  reasoning.detected_pii.forEach(d => {
                    if (d.i !== undefined) {
                      detectionsArray[d.i] = d;
                    }
                  });
                  // Filter out any undefined slots
                  detectionsArray = detectionsArray.filter(d => d !== undefined);
                } else {
                  // Fallback for backward compatibility
                  detectionsArray = [...reasoning.detected_pii].sort((a, b) => {
                    const posA = anonymizedText.indexOf(a.replacement);
                    const posB = anonymizedText.indexOf(b.replacement);
                    if (posA === -1 && posB === -1) return 0;
                    if (posA === -1) return 1;
                    if (posB === -1) return -1;
                    return posA - posB;
                  });
                }

                // Build instance map for tracking occurrences of same entity
                const instanceMap = new Map<string, number[]>();
                detectionsArray.forEach((detection, index) => {
                  const key = `${detection.original}|${detection.replacement}`;
                  if (!instanceMap.has(key)) {
                    instanceMap.set(key, []);
                  }
                  instanceMap.get(key)!.push(index);
                });

                // Render each detection with instance labels
                return detectionsArray.map((detection, arrayIndex) => {
                  const key = `${detection.original}|${detection.replacement}`;
                  const instances = instanceMap.get(key) || [];
                  const instancePosition = instances.indexOf(arrayIndex) + 1;
                  const totalInstances = instances.length;
                  const instanceLabel = totalInstances > 1 ? ` (instance ${instancePosition} of ${totalInstances})` : '';
                  
                  return (
                    <PIIDetectionItem 
                      key={`detection-${arrayIndex}`}
                      detection={{
                        ...detection,
                        replacement: detection.replacement + instanceLabel
                      }} 
                      isActive={!inactiveOccurrences.has(detection.i ?? arrayIndex)}
                      onToggle={() => {
                        if (onToggleOccurrence) {
                          const occurrenceIndex = detection.i ?? arrayIndex;
                          const isCurrentlyActive = !inactiveOccurrences.has(occurrenceIndex);
                          onToggleOccurrence(occurrenceIndex, !isCurrentlyActive);
                          // Mark that manual overrides are present
                          setManualOverrides(true);
                          setSliderActive(false);
                        }
                      }}
                    />
                  );
                });
              })()}
            </List>
          </AccordionDetails>
        </Accordion>
        </Box>
      )}

      {/* Reasoning Process */}
      {reasoning.thought_process && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <PsychologyIcon color="secondary" />
              <Typography variant="h6">AI Reasoning Process</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              sx={{
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'secondary.main',
                borderLeft: '4px solid',
                borderLeftColor: 'secondary.main',
                borderRadius: 1,
                p: 2,
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  lineHeight: 1.6
                }}
              >
                {reasoning.thought_process}
              </Typography>
            </Box>
            
            {reasoning.extraction_method && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  Extraction method: {reasoning.extraction_method}
                </Typography>
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

// Sensitive Information Detection Item Component
interface PIIDetectionItemProps {
  detection: PIIDetection;
  isActive: boolean;
  onToggle: () => void;
}

const PIIDetectionItem: React.FC<PIIDetectionItemProps> = ({ detection, isActive, onToggle }) => {
  const getTypeIcon = (type: string) => {
    const upperType = type.toUpperCase();
    
    // Enhanced icon mapping for different sensitive information types
    const typeMap: Record<string, React.ReactElement> = {
      'NAME': <PersonIcon />,
      'EMAIL': <EmailIcon />,
      'PHONE': <PhoneIcon />,
      'ADDRESS': <AddressIcon />,
      'LOCATION': <LocationIcon />,
      'CREDIT_CARD': <CreditCardIcon />,
      'ORG': <OrgIcon />,
      'ORGANIZATION': <OrgIcon />,
      'COMPANY': <BusinessIcon />,
      'DATE': <CalendarIcon />,
      'SSN': <SSNIcon />,
      'ID': <BadgeIcon />,
      'PROPRIETARY': <ProprietaryIcon />,
      'PRODUCT': <ProductIcon />,
      'SERVICE': <ServiceIcon />,
      'PROJECT': <ProjectIcon />,
      'ACCOUNT': <AccountIcon />,
      'MEDICAL': <MedicalIcon />,
    };
    
    // Check for exact match first
    if (typeMap[upperType]) {
      return typeMap[upperType];
    }
    
    // Check for partial matches
    const typeKey = Object.keys(typeMap).find(key => 
      upperType.includes(key)
    );
    
    return typeKey ? typeMap[typeKey] : <TagIcon />;
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircleIcon color="success" />;
    if (confidence >= 0.7) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  return (
    <ListItem
      sx={{
        border: 1,
        borderColor: isActive ? 'divider' : 'rgba(0,0,0,0.2)',
        borderRadius: 1,
        mb: 1,
        bgcolor: isActive ? 'background.paper' : 'rgba(0,0,0,0.08)',
        opacity: isActive ? 1 : 0.5,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          bgcolor: isActive ? 'rgba(59, 130, 246, 0.04)' : 'rgba(0,0,0,0.12)',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: isActive ? 'transparent' : 'rgba(128,128,128,0.1)',
          pointerEvents: 'none',
        }
      }}
      onClick={onToggle}
    >
      <ListItemIcon>
        {getTypeIcon(detection.type)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Chip
              label={detection.type}
              size="small"
              color="primary"
              sx={{ 
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}
            />
            <Typography 
              variant="body2" 
              component="span"
              sx={{ fontFamily: 'monospace' }}
            >
              "{detection.original}" → "{detection.replacement}"
            </Typography>
          </Box>
        }
        secondary={
          <>
            <Box display="flex" alignItems="center" gap={1} mt={1} mb={1} component="span">
              {getConfidenceIcon(detection.confidence)}
              <LinearProgress
                variant="determinate"
                value={detection.confidence * 100}
                sx={{ 
                  flexGrow: 1, 
                  height: 4, 
                  borderRadius: 2, 
                  display: 'inline-block', 
                  width: '100px',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: isActive ? undefined : '#9ca3af',
                  },
                  bgcolor: isActive ? undefined : '#e5e7eb',
                }}
                color={isActive ? getConfidenceColor(detection.confidence) : 'inherit'}
              />
              <Typography variant="caption" color="text.secondary" component="span">
                {(detection.confidence * 100).toFixed(0)}%
              </Typography>
            </Box>
            {detection.explanation && (
              <Typography variant="caption" color="text.secondary" display="block">
                {detection.explanation}
              </Typography>
            )}
          </>
        }
      />
    </ListItem>
  );
};

// Helper function to get confidence-based color
function getConfidenceColor(confidence: number): 'success' | 'warning' | 'error' {
  if (confidence >= 0.9) return 'success';
  if (confidence >= 0.7) return 'warning';
  return 'error';
}

// Entity Group Component for multiple instances of same entity
interface EntityGroupProps {
  originalText: string;
  detections: PIIDetection[];
  allInactive: boolean;
  someInactive: boolean;
  inactiveReplacements: Set<string>;
  onToggleEntity: () => void;
  onToggleReplacement: (replacement: string) => void;
}

const EntityGroup: React.FC<EntityGroupProps> = ({
  originalText,
  detections,
  allInactive,
  someInactive,
  inactiveReplacements,
  onToggleEntity,
  onToggleReplacement,
}) => {
  const [expanded, setExpanded] = useState(false);
  const firstDetection = detections[0];
  const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

  const getTypeIcon = (type: string) => {
    const upperType = type.toUpperCase();
    
    const typeMap: Record<string, React.ReactElement> = {
      'NAME': <PersonIcon />,
      'EMAIL': <EmailIcon />,
      'PHONE': <PhoneIcon />,
      'ADDRESS': <AddressIcon />,
      'LOCATION': <LocationIcon />,
      'CREDIT_CARD': <CreditCardIcon />,
      'ORG': <OrgIcon />,
      'ORGANIZATION': <OrgIcon />,
      'COMPANY': <BusinessIcon />,
      'DATE': <CalendarIcon />,
      'SSN': <SSNIcon />,
      'ID': <BadgeIcon />,
      'PROPRIETARY': <ProprietaryIcon />,
      'PRODUCT': <ProductIcon />,
      'SERVICE': <ServiceIcon />,
      'PROJECT': <ProjectIcon />,
      'ACCOUNT': <AccountIcon />,
      'MEDICAL': <MedicalIcon />,
    };
    
    if (typeMap[upperType]) {
      return typeMap[upperType];
    }
    
    const typeKey = Object.keys(typeMap).find(key => 
      upperType.includes(key)
    );
    
    return typeKey ? typeMap[typeKey] : <TagIcon />;
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircleIcon color="success" />;
    if (confidence >= 0.7) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  return (
    <Box sx={{ mb: 1 }}>
      {/* Entity Header */}
      <ListItem
        sx={{
          border: 1,
          borderColor: allInactive ? 'rgba(0,0,0,0.2)' : 'divider',
          borderRadius: 1,
          bgcolor: allInactive ? 'rgba(0,0,0,0.08)' : (someInactive ? 'rgba(251, 146, 60, 0.04)' : 'background.paper'),
          opacity: allInactive ? 0.5 : 1,
          cursor: 'pointer',
          position: 'relative',
          '&:hover': {
            bgcolor: allInactive ? 'rgba(0,0,0,0.12)' : 'rgba(59, 130, 246, 0.04)',
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <ListItemIcon>
          {getTypeIcon(firstDetection.type)}
        </ListItemIcon>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                label={`${firstDetection.type} (${detections.length} instances)`}
                size="small"
                color={someInactive && !allInactive ? "warning" : "primary"}
                sx={{ 
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              />
              <Typography 
                variant="body2" 
                component="span"
                sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
              >
                "{originalText}"
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEntity();
                }}
                sx={{ ml: 'auto' }}
                title={allInactive ? "Show all instances" : "Hide all instances"}
              >
                {allInactive ? <CheckCircleIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
              </IconButton>
            </Box>
          }
          secondary={
            <Box display="flex" alignItems="center" gap={1} mt={1} component="span">
              {getConfidenceIcon(avgConfidence)}
              <LinearProgress
                variant="determinate"
                value={avgConfidence * 100}
                sx={{ 
                  flexGrow: 1, 
                  height: 4, 
                  borderRadius: 2, 
                  display: 'inline-block', 
                  width: '100px',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: allInactive ? '#9ca3af' : undefined,
                  },
                  bgcolor: allInactive ? '#e5e7eb' : undefined,
                }}
                color={!allInactive ? getConfidenceColor(avgConfidence) : 'inherit'}
              />
              <Typography variant="caption" color="text.secondary" component="span">
                {(avgConfidence * 100).toFixed(0)}% avg
              </Typography>
            </Box>
          }
        />
      </ListItem>

      {/* Individual Instances (when expanded) */}
      {expanded && (
        <Box sx={{ pl: 6, pr: 2, mt: 1 }}>
          {detections.map((detection, idx) => (
            <ListItem
              key={detection.replacement}
              sx={{
                border: 1,
                borderColor: inactiveReplacements.has(detection.replacement) ? 'rgba(0,0,0,0.1)' : 'divider',
                borderRadius: 1,
                mb: 0.5,
                bgcolor: inactiveReplacements.has(detection.replacement) ? 'rgba(0,0,0,0.04)' : 'background.paper',
                opacity: inactiveReplacements.has(detection.replacement) ? 0.5 : 1,
                cursor: 'pointer',
                py: 1,
                '&:hover': {
                  bgcolor: inactiveReplacements.has(detection.replacement) ? 'rgba(0,0,0,0.08)' : 'rgba(59, 130, 246, 0.02)',
                }
              }}
              onClick={() => onToggleReplacement(detection.replacement)}
            >
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary">
                      Instance {idx + 1}:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      component="span"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {detection.replacement}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({(detection.confidence * 100).toFixed(0)}%)
                    </Typography>
                  </Box>
                }
                secondary={detection.explanation}
              />
            </ListItem>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ResultDisplay;