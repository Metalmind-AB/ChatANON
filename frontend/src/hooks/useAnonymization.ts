import { useState, useCallback } from 'react';
import { ChatANONAPI } from '../services/api';
import {
  AnonymizeRequest,
  AnonymizeResponse,
  Message,
} from '../types';

interface UseAnonymizationState {
  isProcessing: boolean;
  error: string | null;
  lastResponse: AnonymizeResponse | null;
}

interface UseAnonymizationReturn extends UseAnonymizationState {
  anonymizeText: (text: string, customInstructions?: string, model?: string) => Promise<AnonymizeResponse | null>;
  anonymizeTextStream: (text: string, customInstructions?: string, model?: string, onChunk?: (chunk: any) => void) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useAnonymization = (returnReasoning: boolean = true): UseAnonymizationReturn => {
  const [state, setState] = useState<UseAnonymizationState>({
    isProcessing: false,
    error: null,
    lastResponse: null,
  });

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      error: null,
      lastResponse: null,
    });
  }, []);

  const anonymizeText = useCallback(async (
    text: string,
    customInstructions?: string,
    model?: string
  ): Promise<AnonymizeResponse | null> => {
    if (!text.trim()) {
      setState(prev => ({ ...prev, error: 'Please provide text to anonymize' }));
      return null;
    }

    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null 
    }));

    try {
      const request: AnonymizeRequest = {
        text: text.trim(),
        return_reasoning: returnReasoning,
        custom_instructions: customInstructions?.trim() || undefined,
        model: model || undefined,
      };

      // console.log('[useAnonymization] Sending request:', {
      //   textLength: request.text.length,
      //   hasInstructions: !!request.custom_instructions,
      //   returnReasoning: request.return_reasoning
      // });

      const response = await ChatANONAPI.anonymizeText(request);
      
      // console.log('[useAnonymization] Received response:', {
      //   anonymizedLength: response.anonymized_text.length,
      //   hasReasoning: !!response.reasoning,
      //   piiDetections: response.reasoning?.detected_pii.length || 0,
      //   processingTime: response.reasoning?.processing_time || 0
      // });

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        lastResponse: response 
      }));

      return response;
    } catch (error: any) {
      console.error('[useAnonymization] Error:', error);
      
      let errorMessage = 'Failed to anonymize text';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: errorMessage 
      }));

      return null;
    }
  }, [returnReasoning]);

  const anonymizeTextStream = useCallback(async (
    text: string,
    customInstructions?: string,
    model?: string,
    onChunk?: (chunk: any) => void
  ): Promise<void> => {
    if (!text.trim()) {
      setState(prev => ({ ...prev, error: 'Please provide text to anonymize' }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null 
    }));

    const startTime = Date.now(); // Track start time for processing duration

    try {
      const request: AnonymizeRequest = {
        text: text.trim(),
        return_reasoning: returnReasoning,
        custom_instructions: customInstructions?.trim() || undefined,
        model: model || undefined,
      };

      // console.log('[useAnonymization] Starting stream:', {
      //   textLength: request.text.length,
      //   hasInstructions: !!request.custom_instructions,
      //   model: request.model,
      //   returnReasoning: request.return_reasoning
      // });

      let fullContent = '';
      let reasoning = '';

      // console.log('Starting anonymization stream...');
      for await (const chunk of ChatANONAPI.anonymizeTextStream(request)) {
        
        if (chunk.type === 'content') {
          fullContent += chunk.content;
        } else if (chunk.type === 'thinking') {
          reasoning += chunk.content;
        }
        
        if (onChunk) {
          onChunk(chunk);
        }

        if (chunk.type === 'complete') {
          const processingTime = (Date.now() - startTime) / 1000; // Calculate duration in seconds
          
          const response: AnonymizeResponse = {
            anonymized_text: chunk.anonymized_text || fullContent,
            reasoning: chunk.reasoning || { 
              thought_process: reasoning, 
              detected_pii: [], 
              processing_time: processingTime, 
              chunks_processed: 1, 
              extraction_method: 'stream' 
            },
            metadata: { 
              model: model || 'unknown', 
              timestamp: new Date().toISOString(),
              chunks: 1,
              total_tokens: (chunk.anonymized_text || fullContent).length
            }
          };
          
          // Ensure processing_time is set even if reasoning exists
          if (response.reasoning && !response.reasoning.processing_time) {
            response.reasoning.processing_time = processingTime;
          }

          setState(prev => ({ 
            ...prev, 
            isProcessing: false, 
            lastResponse: response 
          }));
          break;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.message || 'Streaming failed');
        }
      }

    } catch (error: any) {
      console.error('[useAnonymization] Stream error:', error);
      
      let errorMessage = 'Failed to anonymize text';
      if (error.message) {
        errorMessage = error.message;
      }

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: errorMessage 
      }));
    }
  }, [returnReasoning]);

  return {
    ...state,
    anonymizeText,
    anonymizeTextStream,
    clearError,
    reset,
  };
};

// Helper hook for managing chat messages
export const useChatMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = useCallback((
    content: string, 
    type: Message['type'] = 'user',
    reasoning?: any
  ) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      reasoning,
    };

    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const getLastMessage = useCallback((): Message | null => {
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }, [messages]);

  return {
    messages,
    addMessage,
    updateMessage,
    clearMessages,
    getLastMessage,
  };
};

export default useAnonymization;