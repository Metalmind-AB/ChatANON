import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Stack,
} from '@mui/material';
import {
  Undo as UndoIcon,
} from '@mui/icons-material';
import { PIIDetection } from '../types';
import BaseTooltip from './BaseTooltip';

interface InteractiveAnonymizedTextProps {
  anonymizedText: string;
  detections: PIIDetection[];
  inactiveReplacements?: Set<string>;
  onToggleReplacement?: (placeholder: string, isActive: boolean) => void;
  // New props for occurrence-based toggling
  inactiveOccurrences?: Set<number>;
  onToggleOccurrence?: (occurrenceIndex: number, isActive: boolean) => void;
  onToggleAllOccurrences?: (placeholder: string, isActive: boolean) => void;
  // Toggle by entity (all instances of same original text)
  onToggleEntity?: (originalText: string, isActive: boolean) => void;
}

interface RevertedItem {
  replacement: string;
  original: string;
}

const InteractiveAnonymizedText: React.FC<InteractiveAnonymizedTextProps> = ({
  anonymizedText,
  detections,
  inactiveReplacements = new Set(),
  onToggleReplacement,
  inactiveOccurrences = new Set(),
  onToggleOccurrence,
  onToggleAllOccurrences,
  onToggleEntity,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Create a map of replacements to detections
  const replacementMap = useMemo(() => {
    const map = new Map<string, PIIDetection>();
    detections.forEach(detection => {
      // For backwards compatibility, store the first detection for each placeholder
      if (!map.has(detection.replacement)) {
        map.set(detection.replacement, detection);
      }
    });
    return map;
  }, [detections]);
  
  // Create a map to find detection by its index
  const detectionByIndex = useMemo(() => {
    const map = new Map<number, PIIDetection>();
    detections.forEach(detection => {
      if (detection.i !== undefined) {
        map.set(detection.i, detection);
      }
    });
    return map;
  }, [detections]);
  
  // Map each placeholder position in text to its detection
  const positionToDetection = useMemo(() => {
    const map = new Map<number, PIIDetection>();
    const placeholderRegex = /\[([A-Z_0-9]+)\]/g;
    let match;
    
    // Count occurrences of each placeholder as we encounter them
    const placeholderCounts = new Map<string, number>();
    
    while ((match = placeholderRegex.exec(anonymizedText)) !== null) {
      const placeholder = match[0];
      const position = match.index;
      
      // Increment count for this placeholder
      const count = placeholderCounts.get(placeholder) || 0;
      placeholderCounts.set(placeholder, count + 1);
      
      // Find the detection that matches this occurrence
      // Detections are ordered, so we find the nth occurrence
      const matchingDetections = detections.filter(d => d.replacement === placeholder);
      if (matchingDetections[count]) {
        map.set(position, matchingDetections[count]);
      }
    }
    
    return map;
  }, [detections, anonymizedText]);

  // Process the text to identify and replace placeholders
  const processedContent = useMemo(() => {
    // Regular expression to match placeholders like [NAME_1], [EMAIL_1], etc.
    const placeholderRegex = /\[([A-Z_0-9]+)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const textToProcess = anonymizedText;
    
    while ((match = placeholderRegex.exec(textToProcess)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      const placeholder = match[0];
      
      // Add text before the match
      if (matchStart > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {textToProcess.substring(lastIndex, matchStart)}
          </span>
        );
      }

      // Get the specific detection for this position
      const detection = positionToDetection.get(matchStart) || replacementMap.get(placeholder);
      const detectionIndex = detection?.i;
      
      // Check if this specific occurrence is inactive
      const isInactive = detectionIndex !== undefined ? 
        inactiveOccurrences.has(detectionIndex) : 
        inactiveReplacements.has(placeholder);
      
      if (isInactive && detection) {
        // Show original text
        parts.push(
          <span
            key={`inactive-${matchStart}`}
            style={{
              color: '#10b981',
              fontWeight: 500,
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textDecorationColor: '#10b981',
              textDecorationThickness: '1px',
              textUnderlineOffset: '2px',
              cursor: 'pointer',
            }}
            onClick={() => {
              if (detectionIndex !== undefined && onToggleOccurrence) {
                onToggleOccurrence(detectionIndex, true);
              } else if (onToggleReplacement) {
                handleToggle(placeholder, true);
              }
            }}
            title="Click to show placeholder"
          >
            {detection.original}
          </span>
        );
      } else {
        // Show interactive placeholder
        parts.push(
          <InteractiveLabel
            key={`label-${matchStart}`}
            placeholder={placeholder}
            detection={detection}
            onToggle={() => {
              if (detectionIndex !== undefined && onToggleOccurrence) {
                onToggleOccurrence(detectionIndex, false);
              } else if (onToggleReplacement) {
                handleToggle(placeholder, false);
              }
            }}
            onToggleAllInstances={() => {
              if (onToggleAllOccurrences) {
                onToggleAllOccurrences(placeholder, false);
              }
            }}
            onToggleEntity={() => {
              if (detection && onToggleEntity) {
                onToggleEntity(detection.original, false);
              }
            }}
            isHovered={hoveredItem === placeholder}
            onHover={(hover) => setHoveredItem(hover ? placeholder : null)}
          />
        );
      }

      lastIndex = matchEnd;
    }

    // Add remaining text
    if (lastIndex < textToProcess.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {textToProcess.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  }, [anonymizedText, inactiveReplacements, inactiveOccurrences, replacementMap, positionToDetection, hoveredItem, onToggleOccurrence, onToggleAllOccurrences, onToggleReplacement, onToggleEntity]);

  const handleToggle = (placeholder: string, makeActive: boolean) => {
    if (onToggleReplacement) {
      onToggleReplacement(placeholder, makeActive);
    }
  };

  return (
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
      }}
    >
      {processedContent}
    </Box>
  );
};

interface InteractiveLabelProps {
  placeholder: string;
  detection?: PIIDetection;
  onToggle: () => void;
  onToggleAllInstances?: () => void;
  onToggleEntity?: () => void;
  isHovered: boolean;
  onHover: (hover: boolean) => void;
}

const InteractiveLabel: React.FC<InteractiveLabelProps> = ({
  placeholder,
  detection,
  onToggle,
  onToggleAllInstances,
  onToggleEntity,
  isHovered,
  onHover,
}) => {
  const confidencePercent = detection 
    ? Math.round(detection.confidence * 100) 
    : 85;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return '#10b981'; // success
    if (confidence >= 70) return '#f59e0b'; // warning
    return '#ef4444'; // error
  };

  const tooltipContent = (
    <Stack spacing={1}>
      <Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }} display="block">
          Original
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
          {detection?.original || 'Unknown'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {detection?.type || 'UNKNOWN'} • {confidencePercent}%
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', display: 'block', mt: 0.5 }}>
            Click to show original
          </Typography>
        </Box>
        {onToggleAllInstances && (
          <Tooltip title="Hide all instances of this placeholder" placement="top">
            <IconButton
              size="small"
              onClick={onToggleAllInstances}
              sx={{
                color: 'rgba(255,255,255,0.9)',
                p: 0.5,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                },
              }}
            >
              <UndoIcon sx={{ fontSize: 14 }} />
              <UndoIcon sx={{ fontSize: 14, ml: -0.5 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Stack>
  );

  return (
    <BaseTooltip
      content={tooltipContent}
      placement="top"
      onOpen={() => onHover(true)}
      onClose={() => onHover(false)}
    >
      <span
        onClick={onToggle}
        style={{
          display: 'inline',
          backgroundColor: isHovered ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
          color: '#3b82f6',
          borderBottom: '1px solid #3b82f6',
          fontWeight: 700,
          fontFamily: 'inherit',
          fontSize: 'inherit',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          textDecoration: 'none',
        }}
      >
        {placeholder}
      </span>
    </BaseTooltip>
  );
};

export default InteractiveAnonymizedText;