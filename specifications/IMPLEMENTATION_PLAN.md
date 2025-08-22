# ChatANON Implementation Plan

## Phase 1: Environment Setup & Model Installation (Day 1)

### 1.1 Verify Ollama Installation
- [x] Check Ollama version and status
- [x] Test basic Ollama functionality
- [x] Configure Ollama for optimal performance

### 1.2 Download and Test Qwen3-30B-A3B Model
```bash
ollama pull qwen3:30b-a3b
```
- [x] Verify model download completion
- [x] Test model with sample anonymization prompts
- [x] Benchmark response times and resource usage
- [x] Document optimal prompt structure for anonymization

### 1.3 Development Environment Setup
- [x] Initialize Python virtual environment
- [ ] Set up Node.js environment for React frontend
- [ ] Configure development tools (ESLint, Prettier for React/TypeScript)
- [ ] Set up version control (git)

**Validation Checkpoint**: 
- Model responds correctly to anonymization prompts
- Development environment is functional
- Resource usage is within acceptable limits

## Phase 2: Backend Core Implementation (Days 2-3)

### 2.1 Project Structure Creation
```bash
mkdir -p chatanon/{backend,frontend,tests,docs}
cd chatanon
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
```

### 2.2 Install Backend Dependencies
```bash
pip install -r requirements.txt
# Core: fastapi, uvicorn, pydantic, ollama
# Processing: tiktoken for token counting
# Testing: pytest, pytest-asyncio
```

### 2.3 Implement Core Modules

#### 2.3.1 Ollama Client (`backend/core/ollama_client.py`)
- [ ] Async client for Ollama API
- [ ] Model management and health checks
- [ ] Response streaming support
- [ ] **Thought process extraction** - Parse and separate `<think>` tags
- [ ] Error handling and retries

#### 2.3.2 Response Parser (`backend/core/response_parser.py`)
- [ ] **Intelligent output filtering** using regex patterns:
  ```python
  # Extract thinking process
  thinking_pattern = r'<think>(.*?)</think>'
  # Extract final answer after thinking
  answer_pattern = r'</think>\s*(.*?)$'
  # Fallback: detect common thinking indicators
  fallback_patterns = ['Let me', 'First,', 'I need to', 'Checking']
  ```
- [ ] **Transparency features**:
  - Return both anonymized text and reasoning separately
  - Confidence scoring based on reasoning complexity
  - PII detection explanations from thinking process
- [ ] **Smart filtering strategies**:
  - Primary: Extract content between think tags
  - Secondary: Detect markdown/structured output
  - Tertiary: Use NLP to identify explanation vs result
  - Fallback: Return last paragraph as result

#### 2.3.3 Text Chunker (`backend/core/chunker.py`)
- [ ] Token counting with tiktoken
- [ ] Smart boundary detection
- [ ] Context overlap management
- [ ] Chunk metadata tracking
- [ ] **Thinking process aggregation** across chunks

#### 2.3.4 PII Detector (`backend/core/pii_detector.py`)
- [ ] **Dual-mode detection**:
  - Pre-processing: Quick pattern matching for obvious PII
  - Post-processing: Validate LLM's detections from thinking
- [ ] Custom pattern definitions
- [ ] Confidence scoring from both rule-based and LLM reasoning
- [ ] Pattern validation against thinking process

#### 2.3.5 Anonymizer Engine (`backend/core/anonymizer.py`)
- [ ] Orchestration of detection and redaction
- [ ] **Enhanced prompt engineering**:
  ```python
  SYSTEM_PROMPT = """You are an expert text anonymization assistant.
  
  CRITICAL: Structure your response as follows:
  <think>
  [Your detailed analysis of PII elements here]
  </think>
  
  [Final anonymized text only]
  """
  
  INSTRUCTION_TEMPLATE = """
  Task: Anonymize the text below by replacing PII with placeholders.
  
  Rules:
  1. Think step-by-step inside <think> tags
  2. After </think>, provide ONLY the anonymized text
  3. Use these placeholders:
     - [NAME_N] for people (unique N per person)
     - [PHONE] for phone numbers
     - [ADDRESS] for physical addresses
     - [EMAIL] for email addresses
     - [SSN] for social security numbers
     - [DATE] for dates
     - [ORGANIZATION] for companies/institutions
     - [CREDIT_CARD] for card information
     - [AMOUNT] for monetary values
  
  {custom_instructions}
  
  Text to anonymize:
  {input_text}
  """
  ```
- [ ] Consistency management across chunks
- [ ] Custom instruction processing
- [ ] **Reasoning extraction and analysis**

### 2.4 API Implementation
- [ ] FastAPI application setup
- [ ] REST endpoints for anonymization:
  ```python
  POST /api/anonymize
  {
    "text": "string",
    "custom_instructions": "string (optional)",
    "return_reasoning": true,  # Include thinking process
    "stream": false
  }
  
  Response:
  {
    "anonymized_text": "string",
    "reasoning": {
      "thought_process": "string",  # Full thinking
      "detected_pii": [
        {
          "type": "NAME",
          "original": "John Smith",
          "replacement": "[NAME_1]",
          "confidence": 0.95,
          "explanation": "Identified as person name"
        }
      ],
      "processing_time": 1.23,
      "chunks_processed": 1
    },
    "metadata": {
      "model": "qwen3:32b",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
  ```
- [ ] WebSocket for real-time processing with reasoning stream
- [ ] Request/response models with Pydantic
- [ ] Error handling middleware

**Validation Checkpoint**:
- Core modules pass unit tests
- API endpoints are accessible
- Reasoning extraction works correctly
- Basic anonymization flow works end-to-end

## Phase 3: Smart Chunking & Transparency Features (Day 4)

### 3.0 Implement Clever Transparency System

#### 3.0.1 Thought Process Parser
- [ ] **Multi-format reasoning extraction**:
  ```python
  class ReasoningExtractor:
      def extract(self, response: str) -> dict:
          # Primary: <think> tags
          if '<think>' in response:
              return self._extract_think_tags(response)
          
          # Secondary: Markdown headers
          if '##' in response or '**' in response:
              return self._extract_markdown_reasoning(response)
          
          # Tertiary: Sentence classification
          return self._classify_sentences(response)
      
      def _extract_pii_decisions(self, thinking: str) -> list:
          """Parse thinking to extract PII detection decisions"""
          # Extract patterns like "John Smith is a name"
          # Return structured PII detection data
  ```

#### 3.0.2 Confidence Scoring
- [ ] **Multi-factor confidence calculation**:
  - Model certainty (from thinking phrases)
  - Pattern match strength
  - Context consistency
  - Replacement uniqueness
- [ ] **Visual confidence indicators**:
  - High (>0.9): Green checkmark
  - Medium (0.7-0.9): Yellow warning
  - Low (<0.7): Red flag with manual review prompt

#### 3.0.3 Reasoning Presentation
- [ ] **Smart summarization**:
  - Full reasoning (developer mode)
  - Executive summary (key decisions only)
  - Visual mode (flowchart of decisions)
- [ ] **Audit trail generation**:
  ```json
  {
    "decision_log": [
      {
        "timestamp": "2024-01-01T12:00:00.123Z",
        "text_segment": "John Smith",
        "decision": "NAME",
        "reasoning": "Identified as person name format",
        "confidence": 0.95,
        "model_thoughts": "Checking if John Smith is a name..."
      }
    ]
  }
  ```

## Phase 3: Smart Chunking & Instruction Processing (Day 4)

### 3.1 Advanced Chunking Algorithm
- [ ] Implement semantic boundary detection
- [ ] Add support for different text formats
- [ ] Optimize chunk size based on content type
- [ ] Implement parallel processing for independent chunks

### 3.2 Custom Instruction Engine
- [ ] Parse and validate user instructions
- [ ] Create instruction templates (GDPR, HIPAA, etc.)
- [ ] Implement rule priority system
- [ ] Add instruction persistence

### 3.3 Consistency Manager
- [ ] Track entity mappings across chunks
- [ ] Implement pseudonym generation
- [ ] Ensure consistent redaction across document
- [ ] Add validation for output consistency

**Validation Checkpoint**:
- Long documents are processed correctly
- Custom instructions are applied accurately
- Consistency is maintained across chunks

## Phase 4: Frontend Development (Days 5-6)

### 4.1 Setup React Application with TypeScript
```bash
cd frontend
npx create-react-app . --template typescript
npm install axios socket.io-client @mui/material @emotion/react @emotion/styled
npm install react-markdown monaco-editor @monaco-editor/react
npm install react-router-dom @types/react-router-dom
```

### 4.1.1 Implement Style Guide
- [ ] Configure MUI theme according to STYLE_GUIDE.md
- [ ] Set up CSS variables for color palette
- [ ] Implement typography system from style guide
- [ ] Create base component styles (buttons, cards, inputs)
- [ ] Set up responsive breakpoints
- [ ] Configure dark mode support

**Reference**: See STYLE_GUIDE.md for complete design system

### 4.2 Implement Core Components

#### 4.2.1 Chat Interface (React Component)
- [ ] Message input with auto-resize (using React useState/useRef)
- [ ] Message history display (React state with useReducer)
- [ ] Real-time status updates (WebSocket integration with useEffect)
- [ ] Copy/export functionality (using navigator.clipboard API)
- [ ] **Transparency toggle** - Show/hide reasoning (React state)
- [ ] Implement with Material-UI components for consistent design

#### 4.2.2 Instruction Panel
- [ ] Custom instruction editor
- [ ] Template selector
- [ ] Validation feedback
- [ ] Save/load functionality
- [ ] **Reasoning preferences**:
  - Always show reasoning
  - Show on hover
  - Hide reasoning
  - Compact view (PII list only)

#### 4.2.3 Result Display
- [ ] **Three-panel layout** (per SPECIFICATION.md Section 4.2.3):
  - Left: Original text with highlighted PII
  - Center: Anonymized result
  - Right: Reasoning panel (collapsible)
- [ ] **Reasoning panel features**:
  - Thought process viewer (formatted per STYLE_GUIDE.md reasoning-panel styles)
  - PII detection list with confidence scores (using pii-badge styles)
  - Processing timeline for chunks
  - Model decision explanations
- [ ] **Interactive PII map**:
  - Hover over placeholder to see reasoning
  - Click to view detection confidence
  - Color-coded by PII type (using semantic colors from STYLE_GUIDE.md)
- [ ] Statistics display (PII found, processing time)
- [ ] Export options (with or without reasoning)

#### 4.2.4 Settings Component
- [ ] Model selection
- [ ] Performance tuning
- [ ] Theme selection
- [ ] Network configuration

### 4.3 Service Integration
- [ ] API client implementation with Axios
- [ ] WebSocket connection management with socket.io-client
- [ ] Error handling and retry logic
- [ ] State management with React Context API (or Redux Toolkit if needed)
- [ ] Custom React hooks for data fetching and state
- [ ] TypeScript interfaces for type safety

**Validation Checkpoint**:
- UI is responsive and intuitive
- All features are accessible
- Real-time updates work correctly

## Phase 5: Network Configuration & Security (Day 7)

### 5.1 Network Accessibility
- [ ] Configure CORS for local network access
- [ ] Set up HTTPS with self-signed certificates
- [ ] Implement host binding configuration
- [ ] Add service discovery for local network

### 5.2 Security Implementation
- [ ] Add basic authentication
- [ ] Implement session management
- [ ] Add rate limiting
- [ ] Set up IP whitelisting (optional)

### 5.3 Deployment Configuration
- [ ] Create Docker containers (optional)
- [ ] Set up systemd service files
- [ ] Configure auto-start on boot
- [ ] Add health monitoring

**Validation Checkpoint**:
- Service accessible from other devices on network
- Authentication works correctly
- Security measures are effective

## Phase 6: Testing & Optimization (Days 8-9)

### 6.1 Comprehensive Testing

#### 6.1.1 Unit Tests
```bash
pytest tests/unit --cov=backend
```
- [ ] Test all core modules
- [ ] Test API endpoints
- [ ] Test chunking algorithms
- [ ] Test PII detection accuracy
- [ ] **Test reasoning extraction**:
  - Think tag parsing
  - Markdown detection
  - Sentence classification
  - PII decision extraction
- [ ] **Test transparency features**:
  - Confidence scoring accuracy
  - Reasoning summarization
  - Audit trail generation
  - Edge cases (no thinking, mixed formats)

#### 6.1.2 Integration Tests
- [ ] End-to-end anonymization flows
- [ ] Multi-user scenarios
- [ ] Large document processing
- [ ] Network access tests

#### 6.1.3 Performance Tests
- [ ] Load testing with locust/apache bench
- [ ] Memory profiling
- [ ] Response time analysis
- [ ] Concurrent user testing

### 6.2 Optimization
- [ ] Identify and fix bottlenecks
- [ ] Optimize prompt engineering
- [ ] Tune chunk sizes
- [ ] Implement caching where appropriate

### 6.3 Accuracy Validation
- [ ] Create test dataset with known PII
- [ ] Measure detection rates
- [ ] Validate against specification (95%+ accuracy)
- [ ] Fine-tune detection patterns

**Validation Checkpoint**:
- All tests pass
- Performance meets specifications
- Accuracy targets achieved

## Phase 7: Documentation & Deployment (Day 10)

### 7.1 User Documentation
- [ ] Installation guide
- [ ] Quick start tutorial
- [ ] API documentation
- [ ] Troubleshooting guide

### 7.2 Developer Documentation
- [ ] Code documentation
- [ ] Architecture diagrams
- [ ] Contribution guidelines
- [ ] Configuration reference

### 7.3 Final Deployment
- [ ] Production configuration
- [ ] Monitoring setup
- [ ] Backup procedures
- [ ] Update mechanism

### 7.4 User Acceptance Testing
- [ ] Deploy to colleague's environment
- [ ] Gather feedback
- [ ] Make necessary adjustments
- [ ] Final validation against specification

**Validation Checkpoint**:
- Documentation is complete and clear
- Deployment is successful
- User feedback is positive
- All specification requirements met

## Risk Mitigation Strategies

### Technical Risks
1. **Model Performance Issues**
   - Mitigation: Have fallback models ready, implement model quantization
   
2. **Memory Constraints**
   - Mitigation: Implement streaming, optimize chunk sizes, add swap configuration

3. **Network Latency**
   - Mitigation: Implement caching, optimize payload sizes, add compression

### Operational Risks
1. **Complex Setup**
   - Mitigation: Create automated setup scripts, provide detailed documentation

2. **User Adoption**
   - Mitigation: Focus on UX, provide training materials, implement feedback quickly

## Success Metrics

### Phase Completion Criteria
- Each phase must pass its validation checkpoint
- Code coverage > 80%
- No critical security vulnerabilities
- Performance within specified limits

### Project Success Criteria
- Achieves 95%+ PII detection accuracy
- Processes 10,000 word documents in < 30 seconds
- Supports 10+ concurrent users
- Runs stable for 24+ hours
- Positive user feedback from colleague

## Timeline Summary

- **Days 1-3**: Environment setup and backend core (40% complete)
- **Days 4-6**: Advanced features and frontend (70% complete)
- **Days 7-9**: Security, testing, and optimization (90% complete)
- **Day 10**: Documentation and deployment (100% complete)

## Next Steps

1. Begin Phase 1.1 - Verify Ollama installation
2. Download Qwen3-30B-A3B model
3. Create initial project structure
4. Start backend implementation with Ollama client

## Contingency Plans

### If Qwen3-30B-A3B doesn't perform well:
1. Try Qwen3-Coder:30B
2. Test Yi-1.5-34B
3. Consider smaller models with better prompting
4. Implement ensemble approach with multiple models

### If performance targets aren't met:
1. Implement more aggressive caching
2. Use quantized model versions
3. Optimize chunking strategy
4. Consider GPU acceleration options

### If accuracy is below 95%:
1. Enhance Presidio patterns
2. Implement multi-pass detection
3. Add rule-based post-processing
4. Consider fine-tuning option