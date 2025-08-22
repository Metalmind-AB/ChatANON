// API Request Types
export interface AnonymizeRequest {
  text: string;
  custom_instructions?: string;
  return_reasoning?: boolean;
  model?: string;
  stream?: boolean;
}

export interface PIIDetection {
  type: string;
  original: string;
  replacement: string;
  confidence: number;
  explanation?: string;
  start_position?: number;
  end_position?: number;
  i?: number;  // occurrence order index
}

export interface ReasoningData {
  thought_process: string;
  detected_pii: PIIDetection[];
  processing_time: number;
  chunks_processed: number;
  extraction_method?: string;
  confidence_avg?: number;
}

export interface AnonymizeResponse {
  anonymized_text: string;
  reasoning?: ReasoningData;
  metadata: {
    model: string;
    timestamp: string;
    chunks: number;
    total_tokens?: number;
  };
  error?: string;
}

// UI State Types
export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  reasoning?: ReasoningData;
  isProcessing?: boolean;
}

export interface ChatState {
  messages: Message[];
  isProcessing: boolean;
  currentModel: string;
  showReasoning: boolean;
  customInstructions: string;
  error: string | null;
}

// Component Props Types
export interface ChatInterfaceProps {
  onMessageSend?: (message: string) => void;
}

export interface InstructionPanelProps {
  instructions: string;
  onChange: (instructions: string) => void;
  templates: Record<string, InstructionTemplate>;
  onTemplateSelect: (template: string) => void;
}

export interface ResultDisplayProps {
  originalText: string;
  anonymizedText: string;
  reasoning?: ReasoningData;
  showReasoning: boolean;
  onToggleReasoning: () => void;
}

export interface ReasoningPanelProps {
  reasoning: ReasoningData;
  isVisible: boolean;
  onToggle: () => void;
}

// Settings Types
export interface AppSettings {
  theme: 'light' | 'dark';
  showReasoningByDefault: boolean;
  defaultModel: string;
  autoSave: boolean;
  maxRetries: number;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'status' | 'progress' | 'result' | 'error';
  data: any;
  timestamp: string;
}

// Template Types
export interface InstructionTemplate {
  name: string;
  description: string;
  instructions: string;
  category: 'compliance' | 'general' | 'custom';
}

// Health Check Types
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  models: string[];
  current_model: string;
  ollama_status: string;
  timestamp: string;
}

// Error Types
export interface APIError {
  detail: string;
  status_code: number;
  timestamp: string;
}