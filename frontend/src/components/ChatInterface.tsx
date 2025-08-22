import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Fade,
  Stack,
  Avatar,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Clear as ClearIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Lock as LockIcon,
  CreditCard as CreditCardIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAnonymization, useChatMessages } from '../hooks/useAnonymization';
import InstructionPanel from './InstructionPanel';
import ResultDisplay from './ResultDisplay';
import InteractiveAnonymizedText from './InteractiveAnonymizedText';
import TextSelectionReplacer from './TextSelectionReplacer';
import { Message } from '../types';

const ChatInterface: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [selectedModel, setSelectedModel] = useState('qwen3:8b');
  const [_availableModels, _setAvailableModels] = useState<string[]>(['qwen3:8b', 'qwen3:14b', 'qwen3:32b', 'llama3.3:70b']);
  // Track inactive items at two levels:
  // 1. Individual occurrences (by occurrence index 'i')
  // 2. Entity level (all instances of same original text)
  const [inactiveOccurrences, setInactiveOccurrences] = useState<Map<number, Set<number>>>(new Map());
  const [inactiveEntities, setInactiveEntities] = useState<Map<number, Set<string>>>(new Map());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { anonymizeTextStream, isProcessing, error, clearError } = useAnonymization(showReasoning);
  const { messages, addMessage, updateMessage, clearMessages } = useChatMessages();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  // Scroll only during message generation
  useEffect(() => {
    // Only scroll if the last message is processing
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.isProcessing) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  const handleSubmit = useCallback(async () => {
    if (!inputText.trim() || isProcessing) return;

    clearError();
    
    // Add user message immediately with custom instructions as metadata
    addMessage(inputText, 'user', customInstructions ? { customInstructions } : undefined);
    
    // Clear input immediately after adding user message
    const textToProcess = inputText;
    setInputText('');
    
    // Add assistant processing message
    const assistantMessageId = addMessage('Processing your request...', 'assistant');
    updateMessage(assistantMessageId, { isProcessing: true });

    try {
      // Use streaming for real-time updates
      let streamingContent = '';
      let thinkingContent = '';
      let currentChunkThinking = '';
      let currentChunkContent = '';
      let hasStartedContent = false;
      let lastThinkingUpdate = 0;
      let currentStatus = '';
      let isShowingThinking = false;
      
      await anonymizeTextStream(
        textToProcess, 
        customInstructions, 
        selectedModel,
        (chunk) => {
          // console.log('Stream chunk:', chunk.type, chunk.content?.substring(0, 50));
          
          // Handle streaming chunks
          if (chunk.type === 'content') {
            hasStartedContent = true;
            streamingContent += chunk.content;
            currentChunkContent += chunk.content;
            // Show status, thinking (if any), and content together
            let displayContent = '';
            if (currentStatus) {
              displayContent = currentStatus;
              if (currentChunkThinking) {
                displayContent += `\n\n🤔 Thinking:\n${currentChunkThinking}`;
              }
              displayContent += `\n\n📝 Output:\n${streamingContent}`;
            } else {
              displayContent = streamingContent;
            }
            updateMessage(assistantMessageId, {
              content: displayContent,
              isProcessing: true,
            });
          } else if (chunk.type === 'thinking') {
            thinkingContent += chunk.content;
            currentChunkThinking += chunk.content;
            // For multi-chunk: show status and current thinking, but keep previous output separate
            let thinkingDisplay = '';
            if (currentStatus) {
              // During thinking phase of new chunk, show a condensed view
              thinkingDisplay = `${currentStatus}\n\n🤔 Thinking:\n${currentChunkThinking}`;
              // Don't show full previous output during thinking to avoid jumping
              // Just show a summary line
              if (streamingContent) {
                const outputLines = streamingContent.split('\n');
                const lineCount = outputLines.length;
                thinkingDisplay += `\n\n📝 Previous output: ${lineCount} lines processed...`;
              }
            } else {
              // First chunk - simple display
              thinkingDisplay = `🤔 AI is analyzing...\n\n${thinkingContent}`;
            }
            updateMessage(assistantMessageId, {
              content: thinkingDisplay,
              isProcessing: true,
            });
          } else if (chunk.type === 'status') {
            // New chunk starting - reset chunk-specific content
            currentStatus = `⏳ ${chunk.message}`;
            currentChunkThinking = '';
            currentChunkContent = '';
            // Keep showing accumulated content with status
            const statusDisplay = streamingContent ? 
              `${currentStatus}\n\n📝 Previous output:\n${streamingContent}` : 
              currentStatus;
            updateMessage(assistantMessageId, {
              content: statusDisplay,
              isProcessing: true,
            });
          } else if (chunk.type === 'complete') {
            console.log('Stream complete chunk:', chunk);
            // Use the anonymized text from the complete chunk, which contains placeholders
            // If chunk.anonymized_text is not provided, we need to construct it from detections
            let finalContent = chunk.anonymized_text;
            
            if (!finalContent && chunk.reasoning?.detected_pii && chunk.reasoning.detected_pii.length > 0) {
              console.log('No anonymized_text in chunk, constructing from detections');
              // Fallback: construct anonymized text from streamingContent and detections
              finalContent = streamingContent;
              const detections = chunk.reasoning.detected_pii;
              
              // Sort by position (longest first to avoid substring issues)
              const sortedDetections = [...detections].sort((a, b) => 
                b.original.length - a.original.length
              );
              
              for (const detection of sortedDetections) {
                if (detection.original && detection.replacement) {
                  // Replace all occurrences of the original text with the placeholder
                  const regex = new RegExp(detection.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                  finalContent = finalContent.replace(regex, detection.replacement);
                }
              }
              console.log('Constructed anonymized text:', finalContent?.substring(0, 100));
            }
            
            // Always fall back to streamingContent if we still don't have content
            const contentToStore = finalContent || streamingContent || '';
            console.log('Storing content:', contentToStore?.substring(0, 100), '... length:', contentToStore?.length);
            
            updateMessage(assistantMessageId, {
              content: contentToStore,
              reasoning: chunk.reasoning,
              isProcessing: false,
            });
          } else if (chunk.type === 'error') {
            updateMessage(assistantMessageId, {
              content: `Error: ${chunk.message}`,
              isProcessing: false,
            });
          }
        }
      );
      
    } catch (err) {
      console.error('Anonymization error:', err);
      updateMessage(assistantMessageId, {
        content: `An error occurred while processing your request: ${err instanceof Error ? err.message : 'Unknown error'}`,
        isProcessing: false,
      });
    }
  }, [inputText, customInstructions, selectedModel, isProcessing, anonymizeTextStream, clearError, addMessage, updateMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleClearMessages = useCallback(() => {
    clearMessages();
    clearError();
  }, [clearMessages, clearError]);

  // Helper function to apply inactive replacements to text
  const applyInactiveOccurrences = useCallback((text: string, detections: any[], inactiveIndices: Set<number>) => {
    let adjustedText = text;
    
    // Sort detections by their occurrence index (reverse order to avoid position shifts)
    const sortedDetections = [...detections]
      .filter(d => d.i !== undefined && inactiveIndices.has(d.i))
      .sort((a, b) => (b.i ?? 0) - (a.i ?? 0));
    
    // Apply replacements for inactive occurrences
    for (const detection of sortedDetections) {
      // Find the actual position of this specific occurrence
      const regex = new RegExp(detection.replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      let match;
      let occurrenceCount = 0;
      
      while ((match = regex.exec(adjustedText)) !== null) {
        // Check if this is the right occurrence based on order
        if (occurrenceCount === detection.i) {
          // Replace this specific occurrence
          const before = adjustedText.substring(0, match.index);
          const after = adjustedText.substring(match.index + match[0].length);
          adjustedText = before + detection.original + after;
          break;
        }
        occurrenceCount++;
      }
    }
    
    return adjustedText;
  }, []);

  const copyToClipboard = useCallback(async (text: string, messageIndex?: number) => {
    // Apply user adjustments if we have a message index
    let textToCopy = text;
    if (messageIndex !== undefined) {
      const message = messages[messageIndex];
      const inactiveIndices = inactiveOccurrences.get(messageIndex);
      
      if (message?.reasoning?.detected_pii && inactiveIndices && inactiveIndices.size > 0) {
        textToCopy = applyInactiveOccurrences(text, message.reasoning.detected_pii, inactiveIndices);
      }
    }
    
    try {
      console.log('Copying to clipboard:', textToCopy?.substring(0, 100), '... length:', textToCopy?.length);
      if (!textToCopy) {
        console.error('No text to copy!');
        return;
      }
      
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        console.log('Text copied to clipboard successfully (modern API)');
      } else {
        // Fallback for older browsers or non-HTTPS contexts
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
          document.execCommand('copy');
          console.log('Text copied to clipboard successfully (fallback method)');
        } catch (err) {
          console.error('Fallback copy failed:', err);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      
      // Last resort fallback
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        console.log('Text copied to clipboard successfully (last resort)');
      } catch (fallbackErr) {
        console.error('All copy methods failed:', fallbackErr);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }, [messages, inactiveOccurrences, applyInactiveOccurrences]);

  const handleToggleOccurrence = useCallback((messageIndex: number, occurrenceIndex: number, makeActive: boolean) => {
    setInactiveOccurrences(prev => {
      const newMap = new Map(prev);
      const messageInactives = new Set(prev.get(messageIndex) || []);
      
      if (makeActive) {
        messageInactives.delete(occurrenceIndex);
      } else {
        messageInactives.add(occurrenceIndex);
      }
      
      if (messageInactives.size === 0) {
        newMap.delete(messageIndex);
      } else {
        newMap.set(messageIndex, messageInactives);
      }
      
      return newMap;
    });
  }, []);
  
  // New function to toggle all occurrences of a placeholder
  const handleToggleAllOccurrences = useCallback((messageIndex: number, placeholder: string, makeActive: boolean) => {
    const message = messages[messageIndex];
    if (!message.reasoning) return;
    
    setInactiveOccurrences(prev => {
      const newMap = new Map(prev);
      const messageInactives = new Set(prev.get(messageIndex) || []);
      
      // Find all occurrences with this placeholder
      message.reasoning.detected_pii.forEach((detection, index) => {
        if (detection.replacement === placeholder) {
          if (makeActive) {
            messageInactives.delete(detection.i ?? index);
          } else {
            messageInactives.add(detection.i ?? index);
          }
        }
      });
      
      if (messageInactives.size === 0) {
        newMap.delete(messageIndex);
      } else {
        newMap.set(messageIndex, messageInactives);
      }
      
      return newMap;
    });
  }, [messages]);

  const handleToggleEntity = useCallback((messageIndex: number, originalText: string, makeActive: boolean) => {
    // Toggle all instances of the same entity
    const message = messages[messageIndex];
    if (!message?.reasoning?.detected_pii) return;

    // Find all replacements for this entity
    const replacements = message.reasoning.detected_pii
      .filter(detection => detection.original === originalText)
      .map(detection => detection.replacement);

    setInactiveReplacements(prev => {
      const newMap = new Map(prev);
      const messageInactives = new Set(prev.get(messageIndex) || []);
      
      replacements.forEach(replacement => {
        if (makeActive) {
          messageInactives.delete(replacement);
        } else {
          messageInactives.add(replacement);
        }
      });
      
      if (messageInactives.size === 0) {
        newMap.delete(messageIndex);
      } else {
        newMap.set(messageIndex, messageInactives);
      }
      
      return newMap;
    });

    // Also track at entity level
    setInactiveEntities(prev => {
      const newMap = new Map(prev);
      const messageEntities = new Set(prev.get(messageIndex) || []);
      
      if (makeActive) {
        messageEntities.delete(originalText);
      } else {
        messageEntities.add(originalText);
      }
      
      if (messageEntities.size === 0) {
        newMap.delete(messageIndex);
      } else {
        newMap.set(messageIndex, messageEntities);
      }
      
      return newMap;
    });
  }, [messages]);

  const handleReplace = useCallback((messageIndex: number, originalText: string, newText: string, newDetections?: any[]) => {
    console.log('[ChatInterface] handleReplace called with:', {
      messageIndex,
      originalText: originalText?.substring(0, 50),
      newText: newText?.substring(0, 50),
      messageId: messages[messageIndex]?.id,
      newDetections: newDetections?.length,
    });
    
    // Update both content and detections
    const updates: any = { content: newText };
    if (newDetections) {
      updates.reasoning = {
        ...messages[messageIndex].reasoning,
        detected_pii: newDetections
      };
    }
    
    updateMessage(messages[messageIndex].id, updates);
  }, [messages, updateMessage]);

  const handleReplaceAll = useCallback((messageIndex: number, originalText: string, newText: string, newDetections?: any[]) => {
    // Update both content and detections
    const updates: any = { content: newText };
    if (newDetections) {
      updates.reasoning = {
        ...messages[messageIndex].reasoning,
        detected_pii: newDetections
      };
    }
    
    updateMessage(messages[messageIndex].id, updates);
  }, [messages, updateMessage]);

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', py: 3 }}>
      <Stack spacing={3} sx={{ height: '100%' }}>
        {/* Professional Header */}
        <Box>
          <Paper
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              color: 'white',
              p: 4,
              borderRadius: 1,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                opacity: 0.1
              }
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56 }}>
                    <SecurityIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="h3" fontWeight="bold" gutterBottom>
                      ChatANON
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9 }}>
                      AI-Powered Text Anonymization Service
                    </Typography>
                  </Box>
                </Stack>
              </Box>
              
              <Stack direction="row" spacing={1}>
                <Tooltip title={showReasoning ? "Hide AI reasoning" : "Show AI reasoning"}>
                  <span>
                    <IconButton
                      onClick={() => setShowReasoning(!showReasoning)}
                      sx={{ 
                        color: 'white',
                        bgcolor: showReasoning 
                          ? 'rgba(255,255,255,0.3)' 
                          : 'rgba(255,255,255,0.1)',
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        border: showReasoning 
                          ? '2px solid rgba(255,255,255,0.5)' 
                          : '2px solid transparent',
                        '&:hover': { 
                          bgcolor: 'rgba(255,255,255,0.3)'
                        },
                        '&:disabled': {
                          color: 'rgba(255,255,255,0.3)',
                          bgcolor: 'rgba(255,255,255,0.05)'
                        }
                      }}
                    >
                      <PsychologyIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Configuration">
                  <IconButton
                    onClick={() => setShowInstructions(!showInstructions)}
                    sx={{ 
                      color: 'white',
                      bgcolor: showInstructions ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      border: showInstructions ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                    }}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="outlined"
                  onClick={handleClearMessages}
                  startIcon={<ClearIcon />}
                  sx={{ 
                    borderColor: 'rgba(255,255,255,0.3)',
                    color: 'white',
                    height: 44,
                    borderRadius: 3,
                    '&:hover': { 
                      borderColor: 'rgba(255,255,255,0.5)',
                      bgcolor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  Clear Chat
                </Button>
              </Stack>
            </Stack>
            
            {/* Status Bar */}
            <Box mt={3}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip
                  icon={isProcessing ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <CheckCircleIcon />}
                  label={isProcessing ? "Processing..." : "Ready"}
                  color={isProcessing ? "warning" : "success"}
                  sx={{ 
                    bgcolor: isProcessing ? 'rgba(251, 146, 60, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: 'white',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select
                    value={selectedModel}
                    onChange={(e) => {
                      const newModel = e.target.value;
                      setSelectedModel(newModel);
                      // All models now support reasoning
                    }}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.3)',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'white',
                      },
                    }}
                  >
                    <MenuItem value="qwen3:8b">
                      <Box display="flex" alignItems="center">
                        <SmartToyIcon sx={{ mr: 1, fontSize: 16 }} />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">Qwen 8B</Typography>
                          <Typography variant="caption" color="text.secondary">Fast, lightweight</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                    <MenuItem value="qwen3:14b">
                      <Box display="flex" alignItems="center">
                        <SmartToyIcon sx={{ mr: 1, fontSize: 16 }} />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">Qwen 14B</Typography>
                          <Typography variant="caption" color="text.secondary">Balanced</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                    <MenuItem value="qwen3:32b">
                      <Box display="flex" alignItems="center">
                        <SmartToyIcon sx={{ mr: 1, fontSize: 16 }} />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">Qwen 32B</Typography>
                          <Typography variant="caption" color="text.secondary">High Quality</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                    <MenuItem value="llama3.3:70b">
                      <Box display="flex" alignItems="center">
                        <SmartToyIcon sx={{ mr: 1, fontSize: 16 }} />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">Llama 3.3 70B</Typography>
                          <Typography variant="caption" color="text.secondary">Best Quality</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
                {showReasoning && (
                  <Chip
                    icon={<PsychologyIcon />}
                    label="Reasoning ON"
                    size="small"
                    sx={{
                      color: 'white',
                      bgcolor: 'rgba(255,255,255,0.2)',
                      borderColor: 'rgba(255,255,255,0.3)',
                      border: '1px solid'
                    }}
                  />
                )}
              </Stack>
            </Box>
          </Paper>
        </Box>

        {/* Main Content Area */}
        <Box display="flex" gap={3} sx={{ flexGrow: 1, minHeight: 0 }}>
          {/* Instructions Panel */}
          {showInstructions && (
            <Paper 
              elevation={1} 
              sx={{ 
                width: 400, 
                flexShrink: 0,
                borderRadius: 1,
                overflow: 'hidden'
              }}
            >
              <InstructionPanel
                instructions={customInstructions}
                onChange={setCustomInstructions}
                templates={{}}
                onTemplateSelect={() => {}}
              />
            </Paper>
          )}

          {/* Chat Area */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Messages */}
            <Paper 
              ref={chatContainerRef}
              elevation={1} 
              sx={{ 
                flexGrow: 1,
                p: 3,
                overflow: 'auto',
                borderRadius: 1,
                mb: 2,
                bgcolor: 'grey.50'
              }}
            >
              {messages.length === 0 ? (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  height="100%"
                  textAlign="center"
                >
                  <Avatar sx={{ bgcolor: 'primary.main', width: 80, height: 80, mb: 3 }}>
                    <SecurityIcon sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography variant="h4" fontWeight="bold" color="primary.main" gutterBottom>
                    Secure Text Anonymization
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mb: 4 }}>
                    Protect sensitive information in your documents while preserving context and readability. 
                    Our AI-powered system identifies and replaces personal data with consistent placeholders.
                  </Typography>
                  
                  <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
                    {[
                      { label: 'Names', icon: <PersonIcon /> },
                      { label: 'Email Addresses', icon: <EmailIcon /> },
                      { label: 'Phone Numbers', icon: <PhoneIcon /> },
                      { label: 'Addresses', icon: <HomeIcon /> },
                      { label: 'Social Security', icon: <LockIcon /> },
                      { label: 'Credit Cards', icon: <CreditCardIcon /> }
                    ].map(({ label, icon }) => (
                      <Chip
                        key={label}
                        icon={icon}
                        label={label}
                        variant="outlined"
                        sx={{
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ) : (
                <Stack spacing={3}>
                  {messages.map((message, index) => (
                    <ProfessionalMessageComponent
                      key={message.id}
                      message={message}
                      messageIndex={index}
                      showReasoning={showReasoning}
                      onCopy={copyToClipboard}
                      inactiveOccurrences={inactiveOccurrences.get(index) || new Set()}
                      detections={message.reasoning?.detected_pii || []}
                      onToggleOccurrence={(occurrenceIndex, makeActive) => 
                        handleToggleOccurrence(index, occurrenceIndex, makeActive)
                      }
                      onToggleAllOccurrences={(placeholder, makeActive) =>
                        handleToggleAllOccurrences(index, placeholder, makeActive)
                      }
                      onToggleEntity={(originalText, makeActive) =>
                        handleToggleEntity(index, originalText, makeActive)
                      }
                      onReplace={(originalText, newText, newDetections) =>
                        handleReplace(index, originalText, newText, newDetections)
                      }
                      onReplaceAll={(originalText, newText, newDetections) =>
                        handleReplaceAll(index, originalText, newText, newDetections)
                      }
                      customInstructions={customInstructions}
                    />
                  ))}
                </Stack>
              )}
            </Paper>

            {/* Input Area */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 1 }}>
              <Stack spacing={2}>
                {error && (
                  <Fade in={!!error}>
                    <Alert 
                      severity="error" 
                      onClose={clearError}
                      sx={{ borderRadius: 2 }}
                    >
                      {error}
                    </Alert>
                  </Fade>
                )}
                
                <Box display="flex" gap={2} alignItems="flex-end">
                  <TextField
                    inputRef={inputRef}
                    fullWidth
                    multiline
                    maxRows={6}
                    placeholder="Paste your text here for secure anonymization..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isProcessing}
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        minHeight: '60px',
                        fontSize: '16px'
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSubmit}
                    disabled={!inputText.trim() || isProcessing}
                    startIcon={isProcessing ? 
                      <CircularProgress size={20} color="inherit" /> : 
                      <SecurityIcon />
                    }
                    sx={{ 
                      minWidth: 160,
                      height: 60,
                      fontSize: '16px',
                      fontWeight: 600
                    }}
                  >
                    {isProcessing ? 'Processing...' : 'Anonymize'}
                  </Button>
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  Press ⌘/Ctrl + Enter to anonymize • All processing happens locally for maximum security
                </Typography>
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Stack>
    </Container>
  );
};

// Professional Message Component
interface ProfessionalMessageComponentProps {
  message: Message;
  messageIndex: number;
  showReasoning: boolean;
  onCopy: (text: string, messageIndex?: number) => void;
  inactiveOccurrences: Set<number>;
  detections: any[];
  onToggleOccurrence: (occurrenceIndex: number, makeActive: boolean) => void;
  onToggleAllOccurrences: (placeholder: string, makeActive: boolean) => void;
  onToggleEntity?: (originalText: string, makeActive: boolean) => void;
  onReplace?: (originalText: string, newText: string, newDetections?: any[]) => void;
  onReplaceAll?: (originalText: string, newText: string, newDetections?: any[]) => void;
  customInstructions?: string;
}

const ProfessionalMessageComponent: React.FC<ProfessionalMessageComponentProps> = ({ 
  message, 
  messageIndex,
  showReasoning, 
  onCopy,
  inactiveOccurrences,
  detections,
  onToggleOccurrence,
  onToggleAllOccurrences,
  onToggleEntity,
  onReplace,
  onReplaceAll,
  customInstructions,
}) => {
  const isUser = message.type === 'user';

  return (
    <Box display="flex" gap={2} alignItems="flex-start">
      {/* Avatar */}
      <Avatar 
        sx={{ 
          bgcolor: isUser ? 'primary.main' : 'secondary.main',
          width: 40,
          height: 40
        }}
      >
        {isUser ? <PersonIcon /> : <SmartToyIcon />}
      </Avatar>

      {/* Message Content */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
            {isUser ? 'You' : 'ChatANON'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {message.timestamp.toLocaleString()}
          </Typography>
          {!isUser && !message.isProcessing && (
            <Tooltip title="Copy to clipboard">
              <IconButton 
                size="small" 
                onClick={() => onCopy(message.content, messageIndex)}
                sx={{ ml: 'auto' }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Message Body */}
        <Paper 
          elevation={0}
          sx={{
            p: 2.5,
            bgcolor: isUser ? 'primary.50' : 'white',
            border: 1,
            borderColor: isUser ? 'primary.200' : 'grey.200',
            borderRadius: 2,
            position: 'relative'
          }}
        >
          {message.isProcessing && !message.content ? (
            <Box display="flex" alignItems="center" gap={2}>
              <Skeleton variant="circular" width={24} height={24} />
              <Stack spacing={1} sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="60%" />
              </Stack>
            </Box>
          ) : (
            <>
              {isUser ? (
                <UserMessageContent 
                  content={message.content} 
                  customInstructions={customInstructions}  // Show current instructions with user message
                />
              ) : (
                <Box>
                  {/* Show instructions used for this response */}
                  {message.reasoning?.instructions_used && (
                    <Box 
                      sx={{ 
                        mb: 2, 
                        p: 1.5, 
                        bgcolor: 'rgba(99, 102, 241, 0.05)',
                        borderLeft: '3px solid #6366f1',
                        borderRadius: 1,
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: '#6366f1',
                          fontWeight: 600,
                          display: 'block',
                          mb: 0.5
                        }}
                      >
                        Instructions Used
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.4,
                          color: 'text.secondary',
                          fontStyle: 'italic',
                          fontSize: '0.85rem'
                        }}
                      >
                        {message.reasoning.instructions_used}
                      </Typography>
                    </Box>
                  )}
                  {/* Use InteractiveAnonymizedText for system messages with detections, wrapped in TextSelectionReplacer */}
                  {message.reasoning?.detected_pii && message.reasoning.detected_pii.length > 0 ? (
                    onReplace && onReplaceAll ? (
                      <TextSelectionReplacer
                        anonymizedText={message.content}
                        onReplace={onReplace}
                        onReplaceAll={onReplaceAll}
                        detections={message.reasoning.detected_pii}
                      >
                        <InteractiveAnonymizedText
                          anonymizedText={message.content}
                          detections={message.reasoning.detected_pii}
                          inactiveOccurrences={inactiveOccurrences}
                          onToggleOccurrence={onToggleOccurrence}
                          onToggleAllOccurrences={onToggleAllOccurrences}
                          onToggleEntity={onToggleEntity}
                        />
                      </TextSelectionReplacer>
                    ) : (
                      <InteractiveAnonymizedText
                        anonymizedText={message.content}
                        detections={message.reasoning.detected_pii}
                        inactiveOccurrences={inactiveOccurrences}
                        onToggleOccurrence={onToggleOccurrence}
                        onToggleAllOccurrences={onToggleAllOccurrences}
                        onToggleEntity={onToggleEntity}
                      />
                    )
                  ) : (
                    onReplace && onReplaceAll ? (
                      <TextSelectionReplacer
                        anonymizedText={message.content}
                        onReplace={onReplace}
                        onReplaceAll={onReplaceAll}
                        detections={[]}
                      />
                    ) : (
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                          fontFamily: 'Roboto Mono, monospace',
                          fontSize: '0.9rem'
                        }}
                      >
                        {message.content}
                      </Typography>
                    )
                  )}
                  {message.isProcessing && message.content && (
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="text.secondary">
                        Streaming...
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Reasoning Section */}
              {!isUser && message.reasoning && showReasoning && (
                <Box mt={3}>
                  <Divider sx={{ mb: 2 }} />
                  <ResultDisplay
                    originalText=""
                    anonymizedText={message.content}
                    reasoning={message.reasoning}
                    showReasoning={true}
                    onToggleReasoning={() => {}}
                    inactiveOccurrences={inactiveOccurrences}
                    onToggleOccurrence={onToggleOccurrence}
                    onToggleAllOccurrences={onToggleAllOccurrences}
                    onToggleEntity={onToggleEntity}
                  />
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

// User Message Content Component with expand/collapse
interface UserMessageContentProps {
  content: string;
  customInstructions?: string;
}

const UserMessageContent: React.FC<UserMessageContentProps> = ({ content, customInstructions }) => {
  const [expanded, setExpanded] = useState(false);
  const maxPreviewLength = 200;
  
  // Combine instructions with content for display
  const fullContent = customInstructions 
    ? `[Custom Instructions]\n${customInstructions}\n\n[Message]\n${content}`
    : content;
    
  const shouldTruncate = fullContent.length > maxPreviewLength;
  
  const previewText = shouldTruncate 
    ? fullContent.substring(0, maxPreviewLength) + '...' 
    : fullContent;

  return (
    <Box>
      {customInstructions && (
        <Box 
          sx={{ 
            mb: 1.5, 
            p: 1, 
            bgcolor: 'rgba(59, 130, 246, 0.05)',
            borderLeft: '3px solid #3b82f6',
            borderRadius: 1,
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#3b82f6',
              fontWeight: 600,
              display: 'block',
              mb: 0.5
            }}
          >
            Custom Instructions
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              lineHeight: 1.4,
              color: 'text.secondary',
              fontStyle: 'italic'
            }}
          >
            {customInstructions}
          </Typography>
        </Box>
      )}
      <Typography 
        variant="body1" 
        sx={{ 
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6
        }}
      >
        {expanded ? content : (shouldTruncate ? content.substring(0, maxPreviewLength) + '...' : content)}
      </Typography>
      
      {shouldTruncate && (
        <Button
          size="small"
          onClick={() => setExpanded(!expanded)}
          startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ 
            mt: 1,
            textTransform: 'none',
            fontSize: '0.75rem',
            color: 'text.secondary'
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Box>
  );
};

export default ChatInterface;