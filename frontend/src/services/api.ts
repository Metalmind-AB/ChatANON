import axios, { AxiosResponse } from 'axios';
import {
  AnonymizeRequest,
  AnonymizeResponse,
  HealthResponse,
  InstructionTemplate
} from '../types';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://192.168.0.177:8081';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: BASE_URL,
  timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000'),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    // console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    // console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // console.error('[API] Response error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export class ChatANONAPI {
  // Health check endpoint
  static async checkHealth(): Promise<HealthResponse> {
    try {
      const response: AxiosResponse<HealthResponse> = await api.get('/api/health');
      return response.data;
    } catch (error) {
      // console.error('Health check failed:', error);
      throw error;
    }
  }

  // Main anonymization endpoint
  static async anonymizeText(request: AnonymizeRequest): Promise<AnonymizeResponse> {
    try {
      const response: AxiosResponse<AnonymizeResponse> = await api.post('/api/anonymize', request);
      return response.data;
    } catch (error) {
      // console.error('Anonymization failed:', error);
      throw error;
    }
  }

  // Streaming anonymization endpoint
  static async *anonymizeTextStream(request: AnonymizeRequest): AsyncGenerator<any, void, unknown> {
    try {
      const response = await fetch(`${BASE_URL}/api/anonymize/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.trim()) {
                try {
                  const parsed = JSON.parse(data);
                  yield parsed;
                } catch (e) {
                  // console.warn('Failed to parse SSE data:', data);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      // console.error('Streaming anonymization failed:', error);
      throw error;
    }
  }

  // Get available instruction templates
  static async getTemplates(): Promise<Record<string, InstructionTemplate>> {
    try {
      const response = await api.get('/api/templates');
      return response.data.templates;
    } catch (error) {
      // console.error('Failed to fetch templates:', error);
      throw error;
    }
  }

  // Get available models
  static async getModels(): Promise<string[]> {
    try {
      const response = await api.get('/api/models');
      return response.data.models;
    } catch (error) {
      // console.error('Failed to fetch models:', error);
      throw error;
    }
  }

  // Get available entity types for tagging
  static async getEntityTypes(): Promise<{types: Array<{type: string, label: string, placeholder: string}>, custom_types: string[]}> {
    try {
      const response = await api.get('/api/entity-types');
      return response.data;
    } catch (error) {
      // console.error('Failed to fetch entity types:', error);
      throw error;
    }
  }

  // Apply manual tagging to selected text
  static async manualTag(request: {
    text: string;
    selected_text: string;
    entity_type: string;
    custom_instructions?: string;
    current_detections?: any[];
  }): Promise<{
    anonymized_text: string;
    tagged_text: string;
    detections: Array<any>;
  }> {
    try {
      const response = await api.post('/api/manual-tag', request);
      return response.data;
    } catch (error) {
      // console.error('Manual tagging failed:', error);
      throw error;
    }
  }

  // Test connection to backend
  static async testConnection(): Promise<boolean> {
    try {
      await this.checkHealth();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default ChatANONAPI;