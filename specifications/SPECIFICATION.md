# ChatANON: Local Text Anonymization Service Specification

## Executive Summary
ChatANON is a privacy-preserving text anonymization service that runs entirely on local infrastructure, utilizing Ollama and state-of-the-art language models to redact and anonymize sensitive information while maintaining text utility and readability.

## System Requirements

### Hardware Requirements
- Minimum 32GB RAM (recommended 64GB for optimal performance)
- NVIDIA GPU with 24GB+ VRAM (recommended) or Apple Silicon M1/M2/M3 with 32GB+ unified memory
- 100GB available storage for models and application data

### Software Requirements
- Ollama installed and running
- Python 3.10+
- Node.js 18+ (for web interface)
- Modern web browser

## Core Features

### 1. Text Anonymization Engine
- **PII Detection**: Automatically identify and redact personal identifiable information including:
  - Names (persons, organizations, locations)
  - Dates and timestamps
  - Email addresses, phone numbers
  - Social security numbers, credit card numbers
  - Medical record numbers, license plates
  - IP addresses, URLs with personal information
  - Custom patterns defined by user

- **Redaction Strategies**:
  - Token replacement with placeholders (e.g., [NAME], [DATE], [EMAIL])
  - Pseudonymization with consistent fake data
  - Generalization (e.g., "John Smith" → "Person A")
  - Suppression (complete removal)
  - Custom redaction rules based on user instructions

### 2. Smart Text Chunking
- **Automatic segmentation** of long texts based on:
  - Token limits (configurable, default 4096 tokens)
  - Natural language boundaries (paragraphs, sentences)
  - Context preservation across chunks
  - Overlap management for coherent processing

- **Chunk processing strategies**:
  - Sequential processing with context carry-over
  - Parallel processing for independent chunks
  - Reassembly with consistency checking

### 3. Custom Instruction Support
- **User-defined rules** for specific redaction requirements:
  - Industry-specific compliance (HIPAA, GDPR, PCI-DSS)
  - Organization-specific patterns
  - Selective preservation of certain data types
  - Output format specifications

- **Instruction persistence**:
  - Save and load instruction templates
  - Per-session or global defaults
  - Versioning and history

### 4. Chat Interface (React-based SPA)
- **Interactive conversation flow**:
  - Real-time text input and anonymization
  - Visual differentiation between original and anonymized text
  - Side-by-side comparison view option
  - Processing status indicators with React state management

- **Features**:
  - Copy anonymized text to clipboard
  - Export results (TXT, JSON, CSV)
  - Undo/redo functionality with React hooks
  - Search within conversation history
  - React Router for navigation between views

### 5. Network Accessibility
- **Local network access**:
  - Configurable host binding (0.0.0.0 for network access)
  - Port configuration (default 8080)
  - HTTPS support with self-signed certificates
  - Basic authentication for access control

- **API endpoints**:
  - REST API for programmatic access
  - WebSocket support for real-time processing
  - Batch processing endpoints

## Technical Architecture

### Technology Stack
- **Backend**: Python 3.10+ with FastAPI
- **Frontend**: React 18+ with TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context API / Redux Toolkit
- **WebSocket**: Socket.io
- **LLM Integration**: Ollama
- **Testing**: Jest (Frontend), Pytest (Backend)

### Backend (Python/FastAPI)
```
chatanon/
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── anonymize.py
│   │   │   ├── instructions.py
│   │   │   └── health.py
│   │   └── websocket.py
│   ├── core/
│   │   ├── anonymizer.py
│   │   ├── chunker.py
│   │   ├── ollama_client.py
│   │   └── pii_detector.py
│   ├── models/
│   │   ├── request_models.py
│   │   └── response_models.py
│   ├── utils/
│   │   ├── text_processing.py
│   │   └── validation.py
│   └── config.py
```

### Frontend (React/TypeScript)
```
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── InstructionPanel.tsx
│   │   │   ├── ResultDisplay.tsx
│   │   │   ├── ReasoningPanel.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── ErrorBoundary.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   ├── hooks/
│   │   │   ├── useAnonymization.ts
│   │   │   └── useWebSocket.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   └── formatters.ts
│   │   └── App.tsx
│   ├── public/
│   └── package.json
```

## Model Selection

### Primary Model: Qwen3-30B-A3B
- **Rationale**:
  - Efficient MoE architecture (30.5B total, 3.3B activated)
  - Strong multilingual support
  - Excellent context understanding (32K native, 131K with YaRN)
  - Available through Ollama
  - Balance between performance and resource usage

### Fallback Models:
1. **Qwen3-Coder:30B** - For technical/code-heavy content
2. **Yi-1.5-34B** - Alternative with strong instruction following
3. **Smaller models** for resource-constrained environments

## Data Flow

1. **Input Reception**
   - User submits text via chat interface
   - Optional custom instructions provided
   - Text validation and sanitization

2. **Preprocessing**
   - Text chunking if exceeds token limit
   - Context extraction for multi-chunk processing
   - Instruction parsing and validation

3. **Anonymization Processing**
   - Send chunks to Ollama with appropriate prompts
   - Apply custom rules and patterns
   - Maintain consistency across chunks

4. **Post-processing**
   - Reassemble chunks
   - Consistency verification
   - Format output according to user preferences

5. **Result Delivery**
   - Display in chat interface
   - Provide export options
   - Log for audit trail (optional)

## Security Considerations

### Data Protection
- All processing occurs locally (no external API calls)
- No persistent storage of original text (configurable)
- Memory clearing after session completion
- Encrypted communication over HTTPS

### Access Control
- Basic authentication for network access
- Session management with timeouts
- Rate limiting to prevent abuse
- IP whitelisting option

### Audit and Compliance
- Optional audit logging (anonymized only)
- Compliance mode templates (GDPR, HIPAA, etc.)
- Data retention policies
- Export capabilities for compliance reporting

## Performance Specifications

### Target Metrics
- **Latency**: < 2 seconds for texts up to 1000 words
- **Throughput**: 10+ concurrent users
- **Accuracy**: 95%+ PII detection rate
- **Availability**: 99.9% uptime for local service

### Optimization Strategies
- Model quantization (4-bit, 8-bit options)
- Response streaming for large texts
- Caching of common patterns
- Batch processing for multiple requests

## User Experience

### Onboarding
- Quick start guide with example texts
- Pre-configured instruction templates
- Interactive tutorial mode
- Performance benchmark tool

### Customization
- Theme selection (light/dark mode)
- Layout preferences
- Hotkey configuration
- Export format templates

## Testing Requirements

### Unit Tests
- PII detection accuracy
- Chunking algorithm correctness
- API endpoint validation
- Model integration tests

### Integration Tests
- End-to-end anonymization flow
- Multi-user concurrent access
- Large text processing
- Network accessibility

### Performance Tests
- Load testing with various text sizes
- Concurrent user simulation
- Memory usage monitoring
- Response time benchmarking

### Security Tests
- Authentication bypass attempts
- Input validation edge cases
- XSS and injection prevention
- Network security scanning

## Success Criteria

1. **Functional Success**
   - Accurately anonymizes 95%+ of common PII types
   - Maintains text readability and context
   - Processes texts up to 100,000 words
   - Supports custom instruction sets

2. **Performance Success**
   - Handles 10+ concurrent users
   - Sub-2 second response for standard texts
   - Runs on specified hardware requirements
   - Stable operation for 24+ hours

3. **Usability Success**
   - Intuitive interface requiring no training
   - One-click export functionality
   - Clear visual feedback during processing
   - Accessible from local network devices

## Future Enhancements

### Phase 2 Features
- Multi-language support (beyond English)
- Document format support (PDF, DOCX)
- Batch file processing
- Advanced analytics dashboard
- Fine-tuning capability for domain-specific needs

### Phase 3 Features
- Distributed processing for scale
- Advanced compliance reporting
- Integration with existing systems via plugins
- Mobile application
- Federated learning for model improvement