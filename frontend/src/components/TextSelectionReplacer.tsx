import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  FindReplace as ReplaceAllIcon,
} from '@mui/icons-material';
import BaseTooltip from './BaseTooltip';
import EntityTypePicker from './EntityTypePicker';

interface TextSelectionReplacerProps {
  anonymizedText: string;
  onReplace: (originalText: string, newText: string, newDetections?: any[]) => void;
  onReplaceAll: (originalText: string, newText: string, newDetections?: any[]) => void;
  children?: React.ReactNode;
  customInstructions?: string;
  detections?: any[];  // Pass current detections for mapping
}

interface SelectionInfo {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const TextSelectionReplacer: React.FC<TextSelectionReplacerProps> = ({
  anonymizedText,
  onReplace,
  onReplaceAll,
  children,
  customInstructions = '',
  detections = [],
}) => {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('name');
  const [entityTypes, setEntityTypes] = useState<Array<{type: string, label: string, placeholder: string}>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTextSelection = useCallback(() => {
    const selectedText = window.getSelection()?.toString().trim();
    
    if (!selectedText || !containerRef.current) {
      setSelection(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return;

    setSelection({
      text: selectedText,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 5, // Position below the selection
      width: rect.width,
      height: rect.height,
    });
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleTextSelection]);

  // Initialize entity types
  useEffect(() => {
    const defaultTypes = [
      { type: 'name', label: 'Person Name', placeholder: 'NAME' },
      { type: 'email', label: 'Email Address', placeholder: 'EMAIL' },
      { type: 'phone', label: 'Phone Number', placeholder: 'PHONE' },
      { type: 'address', label: 'Physical Address', placeholder: 'ADDRESS' },
      { type: 'location', label: 'Location', placeholder: 'LOCATION' },
      { type: 'ssn', label: 'Social Security Number', placeholder: 'SSN' },
      { type: 'org', label: 'Organization', placeholder: 'ORG' },
      { type: 'id', label: 'ID/Account Number', placeholder: 'ID' },
      { type: 'birth-date', label: 'Birth Date', placeholder: 'BIRTH_DATE' },
      { type: 'proprietary', label: 'Proprietary Info', placeholder: 'PROPRIETARY' },
      { type: 'product', label: 'Product Name', placeholder: 'PRODUCT' },
      { type: 'service', label: 'Service Name', placeholder: 'SERVICE' },
      { type: 'project', label: 'Project Name', placeholder: 'PROJECT' },
    ];
    setEntityTypes(defaultTypes);
    setSelectedEntityType('name');
  }, []);

  const getPlaceholderType = (entityType: string): string => {
    const typeMapping: Record<string, string> = {
      'name': 'NAME',
      'email': 'EMAIL',
      'phone': 'PHONE',
      'address': 'ADDRESS',
      'ssn': 'SSN',
      'org': 'ORG',
      'birth-date': 'BIRTH_DATE',
      'id': 'ID',
      'proprietary': 'PROPRIETARY',
      'location': 'LOCATION',
      'product': 'PRODUCT',
      'service': 'SERVICE',
      'project': 'PROJECT'
    };
    return typeMapping[entityType] || 'UNKNOWN';
  };

  const handleReplace = () => {
    if (selection && selectedEntityType) {
      const placeholderType = getPlaceholderType(selectedEntityType);
      
      // Find existing placeholders of this type
      const existingNumbers = new Set<number>();
      const placeholderRegex = new RegExp(`\\[${placeholderType}_(\\d+)\\]`, 'g');
      let match;
      while ((match = placeholderRegex.exec(anonymizedText)) !== null) {
        existingNumbers.add(parseInt(match[1]));
      }
      
      // Check if this exact text already has a placeholder of this type
      let placeholderNumber = 1;
      let existingPlaceholder = null;
      
      for (const detection of detections) {
        if (detection.original === selection.text && 
            detection.replacement.startsWith(`[${placeholderType}_`)) {
          existingPlaceholder = detection.replacement;
          break;
        }
      }
      
      if (!existingPlaceholder) {
        // Find next available number
        while (existingNumbers.has(placeholderNumber)) {
          placeholderNumber++;
        }
        existingPlaceholder = `[${placeholderType}_${placeholderNumber}]`;
      }
      
      // Create the new text with the replacement
      const newText = anonymizedText.replace(selection.text, existingPlaceholder);
      
      // Create updated detections array
      const newDetections = [...detections];
      const existingIndex = newDetections.findIndex(d => 
        d.original === selection.text && d.replacement.startsWith(`[${placeholderType}_`)
      );
      
      if (existingIndex === -1) {
        // Find the correct position to insert based on where it appears in the text
        const position = newText.indexOf(existingPlaceholder);
        
        // Count how many replacements appear before this position
        let insertIndex = 0;
        for (let i = 0; i < newDetections.length; i++) {
          const detectionPos = newText.indexOf(newDetections[i].replacement);
          if (detectionPos !== -1 && detectionPos < position) {
            insertIndex = i + 1;
          } else {
            break;
          }
        }
        
        // Insert at the correct position
        newDetections.splice(insertIndex, 0, {
          type: selectedEntityType,
          original: selection.text,
          replacement: existingPlaceholder,
          confidence: 1.0,
          explanation: `Manually tagged as ${selectedEntityType}`,
          i: insertIndex  // Add index for consistency
        });
        
        // Update indices for all items after the insertion
        for (let i = insertIndex + 1; i < newDetections.length; i++) {
          if (newDetections[i].i !== undefined) {
            newDetections[i].i = i;
          }
        }
      }
      
      onReplace(selection.text, newText, newDetections);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleReplaceAll = () => {
    if (selection && selectedEntityType) {
      const placeholderType = getPlaceholderType(selectedEntityType);
      
      // Find existing placeholders of this type
      const existingNumbers = new Set<number>();
      const placeholderRegex = new RegExp(`\\[${placeholderType}_(\\d+)\\]`, 'g');
      let match;
      while ((match = placeholderRegex.exec(anonymizedText)) !== null) {
        existingNumbers.add(parseInt(match[1]));
      }
      
      // Check if this exact text already has a placeholder of this type
      let placeholderNumber = 1;
      let existingPlaceholder = null;
      
      for (const detection of detections) {
        if (detection.original === selection.text && 
            detection.replacement.startsWith(`[${placeholderType}_`)) {
          existingPlaceholder = detection.replacement;
          break;
        }
      }
      
      if (!existingPlaceholder) {
        // Find next available number
        while (existingNumbers.has(placeholderNumber)) {
          placeholderNumber++;
        }
        existingPlaceholder = `[${placeholderType}_${placeholderNumber}]`;
      }
      
      // Replace all occurrences
      const regex = new RegExp(selection.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const newText = anonymizedText.replace(regex, existingPlaceholder);
      
      // Create updated detections array
      let newDetections = [...detections];
      
      // Find all positions where the replacement occurs in the new text
      const replacementPositions: number[] = [];
      let searchFrom = 0;
      while (true) {
        const pos = newText.indexOf(existingPlaceholder, searchFrom);
        if (pos === -1) break;
        replacementPositions.push(pos);
        searchFrom = pos + existingPlaceholder.length;
      }
      
      // For each occurrence, add a detection at the correct position
      replacementPositions.forEach(position => {
        // Check if we already have this exact detection
        const exists = newDetections.some(d => 
          d.original === selection.text && 
          d.replacement === existingPlaceholder &&
          newText.indexOf(d.replacement) === position
        );
        
        if (!exists) {
          // Find where to insert based on position
          let insertIndex = 0;
          for (let i = 0; i < newDetections.length; i++) {
            const detectionPos = newText.indexOf(newDetections[i].replacement);
            if (detectionPos !== -1 && detectionPos < position) {
              insertIndex = i + 1;
            } else {
              break;
            }
          }
          
          // Insert the new detection
          newDetections.splice(insertIndex, 0, {
            type: selectedEntityType,
            original: selection.text,
            replacement: existingPlaceholder,
            confidence: 1.0,
            explanation: `Manually tagged as ${selectedEntityType}`,
            i: insertIndex
          });
          
          // Update indices for all items after each insertion
          for (let i = insertIndex + 1; i < newDetections.length; i++) {
            if (newDetections[i].i !== undefined) {
              newDetections[i].i = i;
            }
          }
        }
      });
      
      onReplaceAll(selection.text, newText, newDetections);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleClose = () => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  // Create a virtual element to anchor the tooltip at the selection position
  const virtualElement = React.useMemo(
    () => ({
      nodeType: 1,
      getBoundingClientRect: () => selection ? ({
        width: 0,
        height: 0,
        top: selection.y,
        left: selection.x,
        right: selection.x,
        bottom: selection.y,
        x: selection.x,
        y: selection.y,
        toJSON: () => {},
      }) : ({} as DOMRect),
    }),
    [selection]
  );

  const tooltipContent = (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }} display="block">
            Selected Text
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: 'monospace',
              fontWeight: 500,
              color: 'white',
              fontSize: '0.85rem',
            }}
          >
            {selection?.text}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ 
            color: 'rgba(255,255,255,0.9)',
            p: 0.5,
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
              color: 'white',
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <EntityTypePicker
        value={selectedEntityType}
        onChange={setSelectedEntityType}
        entityTypes={entityTypes}
        disabled={false}
      />

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="contained"
          startIcon={<CheckIcon />}
          onClick={handleReplace}
          disabled={!selectedEntityType}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            py: 0.5,
            bgcolor: '#3b82f6',
            color: 'white',
            '&:hover': {
              bgcolor: '#2563eb',
            },
            '&:disabled': {
              bgcolor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)',
            },
          }}
        >
          Tag This
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ReplaceAllIcon />}
          onClick={handleReplaceAll}
          disabled={!selectedEntityType}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            py: 0.5,
            borderColor: 'rgba(255,255,255,0.3)',
            color: 'white',
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.5)',
              bgcolor: 'rgba(255,255,255,0.05)',
            },
            '&:disabled': {
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)',
            },
          }}
        >
          Tag All
        </Button>
      </Stack>

      {selection && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
          This will tag "{selection.text}" as {entityTypes.find(t => t.type === selectedEntityType)?.label || selectedEntityType}
        </Typography>
      )}
    </Stack>
  );

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      <BaseTooltip
        open={Boolean(selection)}
        anchorEl={virtualElement as any}
        placement="bottom"
        content={tooltipContent}
        onClose={handleClose}
        arrow={false}
        disableInteractive={false}
      >
        {children ? (
          <Box sx={{ userSelect: 'text' }}>
            {children}
          </Box>
        ) : (
          <Box
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              lineHeight: 1.8,
              color: '#1f2937',
              p: 2,
              bgcolor: '#f9fafb',
              borderRadius: 1,
              border: '1px solid',
              borderColor: '#e5e7eb',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              userSelect: 'text',
              '::selection': {
                backgroundColor: '#3b82f6',
                color: 'white',
              },
            }}
          >
            {anonymizedText}
          </Box>
        )}
      </BaseTooltip>
    </Box>
  );
};

export default TextSelectionReplacer;