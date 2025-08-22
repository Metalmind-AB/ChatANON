"""
Ollama Client Module
Handles communication with Ollama API for text anonymization
"""

from typing import Dict, AsyncGenerator, List
import logging
from datetime import datetime
from ollama import AsyncClient
import time

from .response_parser import ResponseParser

logger = logging.getLogger(__name__)


class OllamaClient:
    """Async client for Ollama API with anonymization capabilities"""
    
    # Default tagging types
    DEFAULT_TYPES = """You are to assist in identification and flagging of information that is sensitive and that can help identify the people and organizations that are parties of the case.
    You should focus on information that makes the parties identifiable. Information, such as organization names or locations that do not directly relate to the parties should not be tagged.
    Tag all PII, names, proprietary information, organizations, and third parties with <red type=\"TYPE\" score=\"XX%\">text</red> tags. 
    Include confidence score (0-100%). Types include: name, email, phone, address, location, ssn, org, id, proprietary, product, service, project.
    Names of individuals should *always* be tagged.
    Be aware that just because something is flagged as proprietary, doesn't make it identifiable. 
    Only information that makes the parties identifiable should be tagged."""
    
    def __init__(
        self, 
        base_url: str = "http://localhost:11434", 
        model: str = "qwen3:8b",  # Default to 8b for speed
        timeout: int = 300,
        max_retries: int = 3
    ):
        self.base_url = base_url
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.client = AsyncClient(host=base_url, timeout=timeout)
        self.parser = ResponseParser()
        self._model_warmed = False
        
        # Check if this is a reasoning model
        self.is_reasoning_model = self._is_reasoning_model(model)
        self._setup_prompts()
        logger.info(f"Initialized with model {model}, is_reasoning: {self.is_reasoning_model}")
    
    def _is_reasoning_model(self, model: str) -> bool:
        """All models now support reasoning/thinking extraction"""
        return True  # Unified approach - all models can show their thinking process
    
    def _setup_prompts(self):
        """Setup prompts - same for all models"""
        # All models use the same format now
        self.system_prompt = """Tag sensitive data as <red type="TYPE" score="XX%">text</red>.
Include confidence score for each tag (e.g., score="95%" for high confidence, score="60%" for uncertain).
Copy ALL other text EXACTLY. Include every word, typo, fragment.
NO summaries. NO explanations. ONLY tagged text in <output> tags."""
        
        self.instruction_template = """{custom_instructions}

CRITICAL: Return ONLY the input text with <red type="TYPE" score="XX%">text</red> tags added.
Include confidence scores (e.g. for illustration - view these as interval markers: score="90%" or higher for certain, score="50%" for probable, score="20%" for uncertain).
DO NOT summarize, shorten, or explain. Do not redact the text, but keep it as it is with the addition of the tags. Copy EVERYTHING else EXACTLY.

<input>
{input_text}
</input>

Format your response EXACTLY like this:
<think>
[Your reasoning about what to tag and confidence levels]
</think>

<output>
[The COMPLETE input text with <red type="TYPE" score="XX%"> tags added]
</output>"""
    
    async def health_check(self) -> bool:
        """Check if Ollama service is running and model is available"""
        try:
            models = await self.client.list()
            available_models = [m['model'] for m in models.get('models', [])]
            
            if self.model not in available_models:
                # Try alternative model names
                alternatives = [
                    self.model.replace(':', '-'),
                    self.model.split(':')[0],
                    'qwen3:32b',       # 32B model
                    'qwen3:14b',       # 14B fallback
                    'qwen3:8b',        # 8B fallback
                ]
                
                for alt in alternatives:
                    if alt in available_models:
                        logger.info(f"Using alternative model: {alt}")
                        self.model = alt
                        return True
                
                logger.warning(f"Model {self.model} not found. Available: {available_models}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    async def warm_up_model(self) -> bool:
        """Warm up the model with a small test to reduce first-request latency"""
        if self._model_warmed:
            return True
            
        try:
            logger.info(f"Warming up model: {self.model}")
            start_time = time.time()
            
            # Small test prompt
            response = await self.client.generate(
                model=self.model,
                prompt="Test: anonymize 'John Smith'",
                options={'num_predict': 50}
            )
            
            warm_time = time.time() - start_time
            logger.info(f"Model warmed up in {warm_time:.2f}s")
            self._model_warmed = True
            return True
            
        except Exception as e:
            logger.warning(f"Model warm-up failed: {e}")
            return False
    
    async def list_models(self) -> List[str]:
        """List all available models"""
        try:
            models = await self.client.list()
            return [m['model'] for m in models.get('models', [])]
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []
    
    # Removed non-streaming anonymize method - use _anonymize_stream directly
    
    async def _anonymize_stream(
        self,
        prompt: str,
        return_reasoning: bool,
        temperature: float,
        top_p: float,
        custom_instructions: str = ""
    ) -> AsyncGenerator[Dict, None]:
        """Stream anonymization response"""
        # Warm up model if not already done
        if not self._model_warmed:
            await self.warm_up_model()
            
        # logger.info(f"Streaming with model {self.model}, reasoning: {self.is_reasoning_model}")
        # logger.debug(f"Prompt preview: {prompt[:200]}...")
        
        try:
            # Calculate output token limit - fixed at 4096
            max_output_tokens = 4096
            
            # Stop sequence - only use the closing output tag
            stop_sequences = ["</output>"]
            
            # Conservative sampling for streaming
            options = {
                'temperature': 0.25,  # Conservative
                'top_p': 0.85,        # Tighter nucleus
                'top_k': 32,          # Limited vocabulary
                'repeat_penalty': 1.15,  # Prevent repetition
                'num_predict': max_output_tokens,
                'stop': stop_sequences
            }
            
            # Build the full request
            generate_kwargs = {
                'model': self.model,
                'prompt': prompt,
                'system': self.system_prompt,
                'stream': True,
                'options': options
            }
            
            # Add keep_alive for reasoning models
            if self.is_reasoning_model:
                generate_kwargs['keep_alive'] = '5m'
            
            stream = await self.client.generate(**generate_kwargs)
            
            full_response = ""
            in_output = False
            anonymized_content = ""
            
            async for chunk in stream:
                if 'response' in chunk:
                    chunk_text = chunk['response']
                    full_response += chunk_text
                    
                    # Track output envelope for reasoning models
                    if self.is_reasoning_model and return_reasoning:
                        # Look for output tags
                        if '<output>' in chunk_text:
                            in_output = True
                            # Get content after <output> tag
                            parts = chunk_text.split('<output>')
                            if len(parts) > 1:
                                anonymized_content += parts[1]
                        elif '</output>' in chunk_text:
                            in_output = False
                            # Get content before </output> tag
                            parts = chunk_text.split('</output>')
                            if parts[0]:
                                anonymized_content += parts[0]
                        elif in_output:
                            anonymized_content += chunk_text
                        else:
                            # Content outside output tags (thinking, etc)
                            pass
                    else:
                        # For non-reasoning models, all content is output
                        # Strip any think tags that might slip through
                        if '<think>' in chunk_text or '</think>' in chunk_text:
                            # Remove think tags if they appear
                            chunk_text = chunk_text.replace('<think>', '').replace('</think>', '')
                        anonymized_content += chunk_text
                    
                    # Yield streaming update
                    yield {
                        'type': 'stream',
                        'content': chunk_text,
                        'in_thinking': not in_output if self.is_reasoning_model else False
                    }
            
            # Final parsed response - use same processing for all models
            parsed = self.parser.post_process_tagged_content(full_response)
            
            # Add occurrence order to detections
            import re
            ordered_detections = []
            if parsed.get('detected_pii') and parsed.get('anonymized_text'):
                placeholder_pattern = re.compile(r'\[([A-Z_]+)_(\d+)\]')
                used_detections = set()
                
                # Find each placeholder and map to its detection in order
                for match in placeholder_pattern.finditer(parsed['anonymized_text']):
                    placeholder = match.group(0)
                    
                    # Find the detection for this placeholder
                    for detection in parsed['detected_pii']:
                        if detection.replacement == placeholder and id(detection) not in used_detections:
                            # Add occurrence order
                            detection_dict = {
                                'type': detection.type,
                                'original': detection.original,
                                'replacement': detection.replacement,
                                'confidence': detection.confidence,
                                'explanation': detection.explanation,
                                'i': len(ordered_detections)  # occurrence order
                            }
                            ordered_detections.append(detection_dict)
                            used_detections.add(id(detection))
                            break
            else:
                # No detections or text, keep empty
                ordered_detections = parsed.get('detected_pii', [])
            
            # Recalculate confidence average based on ordered detections
            confidence_avg = None
            if ordered_detections:
                confidence_sum = sum(d.get('confidence', 0) if isinstance(d, dict) else d.confidence for d in ordered_detections)
                confidence_avg = confidence_sum / len(ordered_detections)
            
            yield {
                'type': 'complete',
                'anonymized_text': parsed['anonymized_text'],
                'reasoning': {
                    'thought_process': parsed.get('thinking', ''),
                    'detected_pii': ordered_detections,
                    'extraction_method': parsed.get('extraction_method', 'stream'),
                    'confidence_avg': confidence_avg,
                    'instructions_used': custom_instructions  # Include the instructions used
                } if return_reasoning else None
            }
                
        except Exception as e:
            logger.error(f"Stream anonymization failed: {e}")
            yield {
                'type': 'error',
                'error': str(e)
            }
    
    # Removed batch anonymization - not used with streaming-only approach
    
    async def validate_model_response(self, response: str) -> bool:
        """
        Validate that model response follows expected format
        """
        # Check for thinking tags or clear separation
        has_thinking = '<think>' in response and '</think>' in response
        has_placeholders = any(
            placeholder in response
            for placeholder in ['[NAME', '[PHONE', '[EMAIL', '[ADDRESS']
        )
        
        return has_thinking or has_placeholders
    
    async def switch_model(self, new_model: str) -> bool:
        """
        Switch to a different model
        
        Args:
            new_model: Name of the model to switch to
            
        Returns:
            True if switch was successful
        """
        available = await self.list_models()
        if new_model in available:
            self.model = new_model
            self.is_reasoning_model = self._is_reasoning_model(new_model)
            self._setup_prompts()  # Update prompts for new model
            self._model_warmed = False  # Reset warm-up status
            logger.info(f"Switched to model: {new_model} (reasoning: {self.is_reasoning_model})")
            return True
        else:
            logger.error(f"Model {new_model} not available")
            return False
    
    def get_model_info(self) -> Dict:
        """Get current model information"""
        return {
            'current_model': self.model,
            'base_url': self.base_url,
            'system_prompt_length': len(self.system_prompt),
            'supports_streaming': True,
            'supports_reasoning': self.is_reasoning_model
        }