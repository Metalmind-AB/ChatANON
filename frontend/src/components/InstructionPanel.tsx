import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Business as BusinessIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { InstructionPanelProps, InstructionTemplate } from '../types';

// Predefined instruction templates
const defaultTemplates: Record<string, InstructionTemplate> = {
  'general': {
    name: 'General Sensitive Info',
    description: 'Standard sensitive information protection',
    instructions: 'Replace all sensitive information with appropriate placeholders. Focus on names, addresses, phone numbers, emails, dates, and proprietary information.',
    category: 'general'
  },
  'gdpr': {
    name: 'GDPR Compliance',
    description: 'European data protection requirements',
    instructions: 'Apply GDPR-compliant anonymization. Replace all personal data that could identify individuals directly or indirectly. Use consistent placeholders and ensure no re-identification is possible.',
    category: 'compliance'
  },
  'hipaa': {
    name: 'HIPAA Medical',
    description: 'Healthcare data protection (US)',
    instructions: 'Follow HIPAA safe harbor method. Remove all 18 identifiers including names, dates, locations smaller than state, phone/fax numbers, email addresses, SSNs, medical record numbers, health plan numbers, account numbers, certificate/license numbers, vehicle identifiers, device identifiers, web URLs, IP addresses, biometric identifiers, full-face photos, and any other unique identifying numbers.',
    category: 'compliance'
  },
  'financial': {
    name: 'Financial Data',
    description: 'Banking and financial information protection',
    instructions: 'Anonymize all financial identifiers including account numbers, credit card numbers, routing numbers, SSNs, transaction IDs, and monetary amounts. Preserve transaction patterns but remove identifying information.',
    category: 'compliance'
  },
  'minimal': {
    name: 'Minimal Redaction',
    description: 'Light touch anonymization',
    instructions: 'Only redact obvious personal identifiers like full names, phone numbers, and email addresses. Preserve as much context as possible.',
    category: 'general'
  }
};

const InstructionPanel: React.FC<InstructionPanelProps> = ({
  instructions,
  onChange,
  templates = defaultTemplates,
  onTemplateSelect
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [savedInstructions, setSavedInstructions] = useState<string[]>([]);

  const handleTemplateSelect = useCallback((templateKey: string) => {
    const template = templates[templateKey] || defaultTemplates[templateKey];
    if (template) {
      onChange(template.instructions);
      onTemplateSelect(templateKey);
      setSelectedTemplate(templateKey);
    }
  }, [templates, onChange, onTemplateSelect]);

  const handleSaveInstructions = useCallback(() => {
    if (instructions.trim() && !savedInstructions.includes(instructions)) {
      const updated = [...savedInstructions, instructions];
      setSavedInstructions(updated);
      // In a real app, you'd save to localStorage or backend
      localStorage.setItem('chatanon_saved_instructions', JSON.stringify(updated));
    }
  }, [instructions, savedInstructions]);

  const handleClearInstructions = useCallback(() => {
    onChange('');
    setSelectedTemplate('');
  }, [onChange]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'compliance': return <SecurityIcon />;
      case 'general': return <SettingsIcon />;
      default: return <BusinessIcon />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'compliance': return 'error';
      case 'general': return 'primary';
      default: return 'secondary';
    }
  };

  return (
    <Paper elevation={1} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Anonymization Instructions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Customize how sensitive information should be handled
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Template Selection */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Quick Templates</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box display="flex" flexDirection="column" gap={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Template</InputLabel>
                <Select
                  value={selectedTemplate}
                  label="Select Template"
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Custom Instructions</em>
                  </MenuItem>
                  {Object.entries({ ...defaultTemplates, ...templates }).map(([key, template]) => (
                    <MenuItem key={key} value={key}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getCategoryIcon(template.category)}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {template.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {template.description}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Template categories */}
              <Box display="flex" flexWrap="wrap" gap={1}>
                {Object.entries({ ...defaultTemplates, ...templates })
                  .reduce((acc, [key, template]) => {
                    if (!acc.some(t => t.category === template.category)) {
                      acc.push(template);
                    }
                    return acc;
                  }, [] as InstructionTemplate[])
                  .map((template) => (
                    <Chip
                      key={template.category}
                      icon={getCategoryIcon(template.category)}
                      label={template.category.toUpperCase()}
                      size="small"
                      color={getCategoryColor(template.category) as any}
                      variant="outlined"
                      sx={{
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}
                    />
                  ))}
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Custom Instructions */}
        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle1">Custom Instructions</Typography>
            <Box>
              <Tooltip title="Save instructions">
                <IconButton size="small" onClick={handleSaveInstructions}>
                  <SaveIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear instructions">
                <IconButton size="small" onClick={handleClearInstructions}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={8}
            placeholder="Enter custom anonymization instructions here..."
            value={instructions}
            onChange={(e) => onChange(e.target.value)}
            variant="outlined"
            size="small"
            helperText="Describe specific requirements for handling sensitive data in your text"
          />
        </Box>

        {/* Saved Instructions */}
        {savedInstructions.length > 0 && (
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Saved Instructions ({savedInstructions.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {savedInstructions.map((saved, index) => (
                  <ListItem
                    key={index}
                    onClick={() => onChange(saved)}
                    sx={{ 
                      border: 1, 
                      borderColor: 'divider', 
                      borderRadius: 1, 
                      mb: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <ListItemText
                      primary={saved.substring(0, 60) + (saved.length > 60 ? '...' : '')}
                      secondary={`${saved.split(' ').length} words`}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Usage Examples */}
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <InfoIcon color="info" />
              <Typography variant="subtitle2">Examples & Tips</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              <strong>Example Instructions:</strong>
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                "Replace names with [NAME_1], [NAME_2], etc. Keep relationships consistent."
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                "Anonymize all dates but preserve day of week and relative timing."
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                "Remove specific locations but keep general region (e.g., 'West Coast')."
              </Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="body2" paragraph>
              <strong>Tips:</strong>
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Be specific about what to preserve vs. anonymize
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Consider the context and purpose of your text
              </Typography>
              <Typography component="li" variant="body2">
                Test with sample text first
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Paper>
  );
};

export default InstructionPanel;