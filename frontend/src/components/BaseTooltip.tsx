import React from 'react';
import {
  Paper,
  Tooltip,
  TooltipProps,
  Zoom,
  Popper,
  Fade,
} from '@mui/material';

interface BaseTooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  placement?: TooltipProps['placement'];
  // Controlled mode props (for text selection)
  open?: boolean;
  anchorEl?: any;
  onClose?: () => void;
  // Hover mode props (for interactive placeholders)
  onOpen?: () => void;
  enterDelay?: number;
  leaveDelay?: number;
  // Style options
  arrow?: boolean;
  disableInteractive?: boolean;
  minWidth?: number;
  maxWidth?: number;
}

export const BaseTooltip: React.FC<BaseTooltipProps> = ({
  children,
  content,
  placement = 'top',
  open,
  anchorEl,
  onOpen,
  onClose,
  enterDelay = 200,
  leaveDelay = 100,
  arrow = true,
  disableInteractive = false,
  minWidth = 280,
  maxWidth = 400,
}) => {
  // Hooks must be called at the top level, not conditionally
  const popperRef = React.useRef<HTMLDivElement>(null);
  const isInteractingRef = React.useRef(false);
  
  const tooltipContent = (
    <Paper
      sx={{
        p: 1.5,
        bgcolor: 'rgba(30, 41, 59, 0.95)',
        color: 'white',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        minWidth,
        maxWidth,
      }}
    >
      {content}
    </Paper>
  );

  // Use controlled mode if open prop is provided
  const isControlled = open !== undefined;

  React.useEffect(() => {
    if (!isControlled || !open) return;
    
    // Add a small delay before enabling click-away to avoid immediate closure
    const timeoutId = setTimeout(() => {
        const handleDocumentClick = (event: MouseEvent) => {
          // Don't do anything if we're interacting with the dropdown
          if (isInteractingRef.current) {
            return;
          }
          
          const target = event.target as HTMLElement;
          
          // Don't close if clicking within the popper content
          if (popperRef.current && popperRef.current.contains(target)) {
            return;
          }
          
          // Don't close on text selection within the document
          const selection = window.getSelection();
          if (selection && selection.toString().trim()) {
            return;
          }
          
          if (onClose) {
            onClose();
          }
        };
        
        document.addEventListener('mousedown', handleDocumentClick);
        
        return () => {
          document.removeEventListener('mousedown', handleDocumentClick);
        };
      }, 100); // Small delay to let the tooltip fully render
      
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isControlled, open, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // For controlled mode, use Popper directly
  if (isControlled) {
    return (
      <>
        {children}
        <Popper
          open={open || false}
          anchorEl={anchorEl}
          placement={placement}
          transition
          modifiers={[
            {
              name: 'offset',
              options: {
                offset: [0, 8],
              },
            },
            {
              name: 'preventOverflow',
              enabled: true,
              options: {
                boundary: 'viewport',
              },
            },
          ]}
          style={{ zIndex: 1400 }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={200}>
              <div 
                ref={popperRef}
                onMouseEnter={() => { isInteractingRef.current = true; }}
                onMouseLeave={() => { isInteractingRef.current = false; }}
              >
                {tooltipContent}
              </div>
            </Fade>
          )}
        </Popper>
      </>
    );
  }

  // For hover mode, use regular Tooltip
  return (
    <Tooltip
      title={tooltipContent}
      placement={placement}
      arrow={arrow}
      TransitionComponent={Zoom}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      onOpen={onOpen}
      onClose={onClose}
      disableInteractive={false}
    >
      {children}
    </Tooltip>
  );
};

export default BaseTooltip;