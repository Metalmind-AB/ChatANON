"""
Response Parser Module
Intelligently extracts and separates thinking process from anonymized text
"""

import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class PIIDetection:
    """Represents a detected PII element"""
    type: str
    original: str
    replacement: str
    confidence: float
    explanation: str
    position: int = -1


class ReasoningExtractor:
    """Extracts and parses reasoning from LLM responses"""
    
    def __init__(self):
        # Thinking patterns
        self.think_pattern = re.compile(r'<think>(.*?)</think>', re.DOTALL)
        self.answer_pattern = re.compile(r'</think>\s*(.*?)$', re.DOTALL)
        
        # Fallback patterns for detecting thinking
        self.thinking_indicators = [
            r'^Let me',
            r'^First,',
            r'^I need to',
            r'^Checking',
            r'^Looking at',
            r'^Analyzing',
            r'^The text contains',
            r'^I\'ll',
            r'^Starting with'
        ]
        
        # PII detection patterns in thinking
        self.pii_detection_patterns = {
            'name': re.compile(r'["\']([^"\']+)["\'].*?(?:is a |as a |be a |are )(?:person|name|individual)', re.IGNORECASE),
            'phone': re.compile(r'["\']([^"\']+)["\'].*?(?:is a |as a |be a |are )(?:phone|telephone|number)', re.IGNORECASE),
            'email': re.compile(r'["\']([^"\']+)["\'].*?(?:is an? |as an? |be an? )(?:email)', re.IGNORECASE),
            'address': re.compile(r'["\']([^"\']+)["\'].*?(?:is an? |as an? |be an? )(?:address|location)', re.IGNORECASE),
            'ssn': re.compile(r'["\']([^"\']+)["\'].*?(?:is a |as a |be a )(?:SSN|social security)', re.IGNORECASE),
        }
    
    def extract(self, response: str) -> Dict:
        """
        Extract reasoning and anonymized text from response
        
        Returns:
            Dictionary with 'anonymized_text', 'thinking', and 'detected_pii'
        """
        # Primary: Try to extract <think> tags
        if '<think>' in response:
            return self._extract_think_tags(response)
        
        # Secondary: Try markdown detection
        if any(marker in response for marker in ['##', '**', '###']):
            return self._extract_markdown_reasoning(response)
        
        # Tertiary: Sentence classification
        return self._classify_sentences(response)
    
    def _extract_think_tags(self, response: str) -> Dict:
        """Extract content from <think> tags"""
        think_match = self.think_pattern.search(response)
        
        if think_match:
            thinking = think_match.group(1).strip()
            # Get text after </think>
            answer_match = self.answer_pattern.search(response)
            anonymized = answer_match.group(1).strip() if answer_match else ""
            
            # Parse PII decisions from thinking
            detected_pii = self._extract_pii_decisions(thinking)
            
            return {
                'anonymized_text': anonymized,
                'thinking': thinking,
                'detected_pii': detected_pii,
                'extraction_method': 'think_tags'
            }
        
        # Fallback if tags are malformed
        return self._classify_sentences(response)
    
    def _extract_markdown_reasoning(self, response: str) -> Dict:
        """Extract reasoning from markdown-formatted response"""
        lines = response.split('\n')
        thinking_lines = []
        result_lines = []
        in_result = False
        
        for line in lines:
            # Check for result section headers
            if any(header in line.lower() for header in ['result:', 'output:', 'anonymized:', 'final:']):
                in_result = True
                continue
            
            if in_result:
                result_lines.append(line)
            elif line.strip() and not line.startswith('#'):
                # Non-header lines before result section are thinking
                thinking_lines.append(line)
        
        thinking = '\n'.join(thinking_lines).strip()
        anonymized = '\n'.join(result_lines).strip()
        
        return {
            'anonymized_text': anonymized or response.split('\n')[-1].strip(),
            'thinking': thinking,
            'detected_pii': self._extract_pii_decisions(thinking),
            'extraction_method': 'markdown'
        }
    
    def _classify_sentences(self, response: str) -> Dict:
        """Classify sentences as thinking vs result"""
        lines = response.split('\n')
        thinking_lines = []
        result_lines = []
        found_transition = False
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            # Look for placeholder patterns to detect anonymized content
            has_placeholders = bool(re.search(r'\[[A-Z_0-9]+\]', line_stripped))
            
            # Check if line starts with thinking indicator
            is_thinking = any(
                re.match(pattern, line_stripped) 
                for pattern in self.thinking_indicators
            )
            
            # If we find placeholders, we've likely hit the anonymized text
            if has_placeholders and not found_transition:
                found_transition = True
                result_lines.append(line)
            elif found_transition or (not is_thinking and result_lines):
                # We're in the result section
                result_lines.append(line)
            elif is_thinking or not result_lines:
                # Still in thinking phase
                thinking_lines.append(line)
            else:
                result_lines.append(line)
        
        # If no clear division, split at first line with placeholders or use last paragraph
        if not result_lines:
            # Look for first line with placeholders
            for i, line in enumerate(lines):
                if re.search(r'\[[A-Z_0-9]+\]', line):
                    thinking_lines = lines[:i]
                    result_lines = lines[i:]
                    break
            
            # If still no division, use last paragraph approach
            if not result_lines:
                paragraphs = response.split('\n\n')
                if len(paragraphs) > 1:
                    result_lines = paragraphs[-1].split('\n')
                    thinking_lines = '\n\n'.join(paragraphs[:-1]).split('\n')
                else:
                    # Single paragraph - likely all result
                    result_lines = lines
                    thinking_lines = []
        
        thinking = '\n'.join(thinking_lines).strip()
        anonymized = '\n'.join(result_lines).strip()
        
        return {
            'anonymized_text': anonymized,
            'thinking': thinking,
            'detected_pii': self._extract_pii_decisions(thinking + '\n' + response),
            'extraction_method': 'sentence_classification'
        }
    
    def _extract_pii_decisions(self, thinking: str) -> List[PIIDetection]:
        """Parse thinking to extract PII detection decisions"""
        detections = []
        
        # Look for explicit PII identifications
        for pii_type, pattern in self.pii_detection_patterns.items():
            matches = pattern.finditer(thinking)
            for match in matches:
                original_text = match.group(1)
                detections.append(PIIDetection(
                    type=pii_type.upper(),
                    original=original_text,
                    replacement=f'[{pii_type.upper()}]',
                    confidence=0.9,  # High confidence for explicit mentions
                    explanation=f"Identified as {pii_type} in reasoning"
                ))
        
        # Look for placeholder mappings (e.g., "John Smith" -> [NAME_1])
        mapping_pattern = re.compile(r'["\']([^"\']+)["\'].*?(?:->|→|becomes|is replaced with|as)\s*(\[[A-Z_0-9]+\])')
        for match in mapping_pattern.finditer(thinking):
            original = match.group(1)
            replacement = match.group(2)
            
            # Determine PII type from replacement
            pii_type = replacement.strip('[]').split('_')[0]
            
            # Check if already detected
            if not any(d.original == original for d in detections):
                detections.append(PIIDetection(
                    type=pii_type,
                    original=original,
                    replacement=replacement,
                    confidence=0.95,
                    explanation="Explicit replacement mapping found"
                ))
        
        return detections
    
    def calculate_confidence(self, thinking: str, detection: PIIDetection) -> float:
        """
        Calculate confidence score based on multiple factors
        """
        confidence = 0.5  # Base confidence
        
        # Factor 1: Explicit mention in thinking
        if detection.original.lower() in thinking.lower():
            confidence += 0.2
        
        # Factor 2: Pattern certainty phrases
        certainty_phrases = ['definitely', 'clearly', 'obviously', 'certainly']
        if any(phrase in thinking.lower() for phrase in certainty_phrases):
            confidence += 0.15
        
        # Factor 3: Uncertainty phrases (reduce confidence)
        uncertainty_phrases = ['might be', 'could be', 'possibly', 'maybe']
        if any(phrase in thinking.lower() for phrase in uncertainty_phrases):
            confidence -= 0.15
        
        # Factor 4: Multiple confirmations
        if thinking.lower().count(detection.original.lower()) > 1:
            confidence += 0.1
        
        # Factor 5: Type-specific patterns
        type_patterns = {
            'NAME': r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b',
            'EMAIL': r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b',
            'PHONE': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            'SSN': r'\b\d{3}-\d{2}-\d{4}\b'
        }
        
        if detection.type in type_patterns:
            if re.search(type_patterns[detection.type], detection.original):
                confidence += 0.15
        
        return min(1.0, max(0.0, confidence))


class ResponseParser:
    """Main parser for handling LLM responses"""
    
    def __init__(self):
        self.extractor = ReasoningExtractor()
    
    def post_process_tagged_content(self, tagged_text: str) -> Dict:
        """
        Post-process tagged content to create actual redacted version
        Takes text with <red type="name">John</red> tags and replaces with [NAME_1] etc.
        """
        import re
        
        logger.info(f"[Parser] Processing tagged content, length: {len(tagged_text)} chars")
        
        # Extract thinking first (must be properly closed)
        think_match = re.search(r'<think>(.*?)</think>', tagged_text, re.DOTALL)
        thinking = ''
        if think_match:
            thinking = think_match.group(1).strip()
            logger.info(f"[Parser] Found <think> tags with {len(thinking)} chars of thinking")
            # Keep full thinking content for reasoning models
            # No truncation - users want to see the full thought process
        else:
            logger.info("[Parser] No <think> tags found")
        
        # Extract content from output envelope (must be properly closed)
        # More strict: require closing tag to avoid bleed-through
        output_match = re.search(r'<output>(.*?)</output>', tagged_text, re.DOTALL)
        if output_match:
            working_text = output_match.group(1).strip()
            logger.info(f"[Parser] Found <output> tags with {len(working_text)} chars of content")
            
            # Clean up any accidental tag remnants that might have slipped through
            working_text = re.sub(r'</think>', '', working_text).strip()
            working_text = re.sub(r'<output>', '', working_text).strip()
            working_text = re.sub(r'</output>', '', working_text).strip()
            # Also clean up any escaped or partial tags
            working_text = re.sub(r'&lt;output&gt;', '', working_text).strip()
            working_text = re.sub(r'&lt;/output&gt;', '', working_text).strip()
            # Additional cleanup for multiple output tags or fragments
            working_text = re.sub(r'</?output[^>]*>', '', working_text, flags=re.IGNORECASE).strip()
            
            # If no thinking tags but there's content before <output>, that's the thinking
            if not thinking and output_match.start() > 0:
                thinking = tagged_text[:output_match.start()].strip()
                # Remove any trailing "Output ONLY:" or similar
                for suffix in ['Output ONLY:', 'Output:', 'Result:']:
                    if thinking.endswith(suffix):
                        thinking = thinking[:-len(suffix)].strip()
        else:
            logger.info("[Parser] No <output> tags found, using full text after thinking removal")
            # If no output tags, but text starts after thinking
            # Remove thinking and any preamble
            working_text = re.sub(r'<think>.*?</think>', '', tagged_text, flags=re.DOTALL).strip()
            # Clean up any output tag remnants
            working_text = re.sub(r'</?output[^>]*>', '', working_text, flags=re.IGNORECASE).strip()
            # Also try to extract text after common preambles
            for prefix in ['Output:', 'Result:', 'Redacted text:', 'Here is']:
                if prefix in working_text:
                    parts = working_text.split(prefix, 1)
                    if len(parts) > 1:
                        working_text = parts[1].strip()
                        break
        
        # Track what we're replacing
        detections = []
        counters = {
            'name': 0,
            'email': 0,
            'phone': 0,
            'address': 0,
            'ssn': 0,
            'org': 0,
            'birth-date': 0,
            'id': 0,
            'location': 0,
            'product': 0,
            'service': 0,
            'project': 0,
            'proprietary': 0
        }
        
        # Track entity mappings for consistency (original text -> replacement)
        entity_map = {}
        
        # Type to placeholder mapping
        type_mapping = {
            'name': 'NAME',
            'email': 'EMAIL',
            'phone': 'PHONE',
            'address': 'ADDRESS',
            'ssn': 'SSN',
            'org': 'ORG',
            'birth-date': 'BIRTH_DATE',
            'date': 'BIRTH_DATE',  # Map old 'date' to birth-date for compatibility
            'id': 'ID',
            'proprietary': 'PROPRIETARY',
            'location': 'LOCATION',
            'product': 'PRODUCT',
            'service': 'SERVICE',
            'project': 'PROJECT'
        }
        
        # Pattern to find all <red> tags with type and optional score attributes
        # Matches both: <red type="email" score="95%"> and <red type="email">
        red_pattern = re.compile(
            r'<red\s+type="([^"]+)"(?:\s+score="(\d+)%?")?\s*>([^<]*)</red>', 
            re.IGNORECASE
        )
        
        # Find all matches first to preserve order
        matches = list(red_pattern.finditer(working_text))
        logger.info(f"[Parser] Found {len(matches)} <red> tags to process")
        
        # Build list of replacements with their positions
        replacements = []
        
        # Process matches to build replacements (don't modify text yet)
        for match in matches:
            tag_type = match.group(1).lower()
            score_str = match.group(2)  # May be None if no score attribute
            original_text = match.group(3)
            
            # Debug logging for problematic cases
            if len(original_text) < 3 or original_text.startswith("'"):
                logger.warning(f"[Parser] Suspicious red tag content: type='{tag_type}', original='{original_text}', full_match='{match.group(0)}'")
                # Log surrounding context to understand what's happening
                match_start = max(0, match.start() - 20)
                match_end = min(len(working_text), match.end() + 20)
                context = working_text[match_start:match_end]
                logger.warning(f"[Parser] Context around suspicious tag: ...{context}...")
            
            # Get the placeholder prefix
            placeholder_prefix = type_mapping.get(tag_type, 'UNKNOWN')
            
            # Check if we've seen this exact entity before
            entity_key = (tag_type, original_text.lower())
            if entity_key in entity_map:
                # Use existing replacement for consistency
                replacement = entity_map[entity_key]
            else:
                # Create new replacement
                if tag_type in counters:
                    counters[tag_type] += 1
                else:
                    counters[tag_type] = 1
                
                replacement = f'[{placeholder_prefix}_{counters[tag_type]}]'
                entity_map[entity_key] = replacement
            
            # Parse confidence score if provided, default to 0.85 if not
            confidence = float(score_str) / 100 if score_str else 0.85
            
            # Record the detection
            detections.append(PIIDetection(
                type=placeholder_prefix,
                original=original_text,
                replacement=replacement,
                confidence=confidence,
                explanation=f"Marked as {tag_type} by model (confidence: {int(confidence * 100)}%)"
            ))
            
            # Store replacement info for later
            start, end = match.span()
            replacements.append((start, end, replacement))
        
        # Now apply all replacements in reverse order to preserve positions
        for start, end, replacement in reversed(replacements):
            working_text = working_text[:start] + replacement + working_text[end:]
        
        # Calculate average confidence
        confidence_avg = None
        if detections:
            confidence_sum = sum(d.confidence for d in detections)
            confidence_avg = confidence_sum / len(detections)
        
        logger.info(f"[Parser] Final result: {len(working_text)} chars of text, {len(detections)} PII detections")
        if len(working_text) < 500:
            logger.info(f"[Parser] Final text: {working_text}")
        else:
            logger.info(f"[Parser] Final text preview: {working_text[:500]}...")
        
        return {
            'anonymized_text': working_text,
            'thinking': thinking,
            'detected_pii': detections,
            'confidence_avg': confidence_avg,
            'extraction_method': 'tagged_post_process'
        }
    
    def parse_structured(self, response: str, extract_reasoning: bool = True) -> Dict:
        """
        Parse structured response with <red> tags for redaction entries
        
        Args:
            response: Raw LLM response with <red> tags
            extract_reasoning: Whether to extract reasoning
            
        Returns:
            Structured response with anonymized text and redaction data
        """
        if not extract_reasoning:
            return {
                'anonymized_text': response.strip(),
                'reasoning': None,
                'detected_pii': []
            }
        
        # Extract thinking section
        think_match = re.search(r'<think>(.*?)</think>', response, re.DOTALL)
        thinking = think_match.group(1).strip() if think_match else ''
        
        # Extract anonymized text (after </think>)
        anonymized_match = re.search(r'</think>\s*(.*?)$', response, re.DOTALL)
        anonymized_text = anonymized_match.group(1).strip() if anonymized_match else response
        
        # Parse <red> tags from thinking section
        detected_pii = self._parse_red_tags(thinking)
        
        # Clean up anonymized text
        anonymized_text = self._clean_anonymized_text(anonymized_text)
        
        return {
            'anonymized_text': anonymized_text,
            'thinking': thinking,
            'detected_pii': detected_pii,
            'extraction_method': 'structured_tags'
        }
    
    def _parse_red_tags(self, thinking: str) -> List[PIIDetection]:
        """Parse structured <red> tags from thinking content"""
        detections = []
        
        # Pattern for <red type="TYPE" orig="original" repl="replacement" />
        red_pattern = re.compile(
            r'<red\s+type="([^"]+)"\s+orig="([^"]+)"\s+repl="([^"]+)"\s*/?>',
            re.IGNORECASE
        )
        
        for match in red_pattern.finditer(thinking):
            pii_type = match.group(1).upper()
            original = match.group(2)
            replacement = match.group(3)
            
            detections.append(PIIDetection(
                type=pii_type,
                original=original,
                replacement=replacement,
                confidence=0.95,  # High confidence for explicit structured tags
                explanation=f"Explicitly marked as {pii_type} for redaction"
            ))
        
        return detections
    
    def parse(self, response: str, extract_reasoning: bool = True) -> Dict:
        """
        Parse LLM response and return structured data
        
        Args:
            response: Raw LLM response
            extract_reasoning: Whether to extract reasoning/thinking
            
        Returns:
            Structured response with anonymized text and optional reasoning
        """
        if not extract_reasoning:
            # Simple case - just return the response
            return {
                'anonymized_text': response.strip(),
                'reasoning': None,
                'detected_pii': []
            }
        
        # Extract reasoning and anonymized text
        result = self.extractor.extract(response)
        
        # Calculate confidence scores for detections
        for detection in result.get('detected_pii', []):
            detection.confidence = self.extractor.calculate_confidence(
                result.get('thinking', ''), 
                detection
            )
        
        # Clean up anonymized text
        result['anonymized_text'] = self._clean_anonymized_text(result['anonymized_text'])
        
        return result
    
    def _clean_anonymized_text(self, text: str) -> str:
        """Remove any residual thinking indicators from anonymized text"""
        # Remove common prefixes
        prefixes_to_remove = [
            'Here is the anonymized text:',
            'Anonymized text:',
            'Anonymized:',
            'Result:',
            'Output:',
            'Final answer:',
            'Anonymized version:',
            'The anonymized text with PII replaced by placeholders'
        ]
        
        for prefix in prefixes_to_remove:
            if text.lower().startswith(prefix.lower()):
                text = text[len(prefix):].strip()
        
        # Remove bullet point analysis if present
        lines = text.split('\n')
        cleaned_lines = []
        found_actual_text = False
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Skip analysis lines (bullets, dashes, lists)
            if line.startswith(('- [', '* [', '• [')) and ']' in line and 'for' in line:
                continue  # Skip PII analysis lines like "- [NAME_1] for 'John Smith'"
            elif line.startswith('Anonymized text:'):
                continue  # Skip section headers
            elif any(word in line.lower() for word in ['pii elements', 'will be replaced', 'are pii', 'identified']):
                continue  # Skip analysis sentences
            elif not found_actual_text and any(char.isalpha() for char in line) and not line.startswith(('-', '*', '•')):
                # Check if this looks like actual content (has placeholders or natural text flow)
                if re.search(r'\[[A-Z_0-9]+\]', line) or (len(line.split()) > 2 and not any(analysis_word in line.lower() for analysis_word in ['analysis', 'identified', 'found', 'replacing', 'elements'])):
                    found_actual_text = True
                    cleaned_lines.append(line)
            elif found_actual_text:
                cleaned_lines.append(line)
        
        # If we removed everything, fall back to the original approach
        if not cleaned_lines:
            # Look for lines with placeholders
            for line in lines:
                if re.search(r'\[[A-Z_0-9]+\]', line.strip()):
                    cleaned_lines.append(line.strip())
        
        # Join and clean up
        result = '\n'.join(cleaned_lines).strip()
        
        # Remove any remaining think-like content
        if any(indicator in result.lower()[:100] for indicator in ['let me', 'first,', 'i need', 'checking', 'looking at']):
            # Try to find the actual content after analysis
            lines = result.split('\n')
            for i, line in enumerate(lines):
                if re.search(r'\[[A-Z_0-9]+\]', line) or (len(line.split()) > 3 and not any(indicator in line.lower() for indicator in ['analysis', 'identified', 'found', 'replacing'])):
                    result = '\n'.join(lines[i:]).strip()
                    break
        
        return result.strip()
    
    def generate_audit_trail(self, parsed_response: Dict, timestamp: str) -> Dict:
        """
        Generate audit trail from parsed response
        """
        audit_entries = []
        
        for detection in parsed_response.get('detected_pii', []):
            audit_entries.append({
                'timestamp': timestamp,
                'text_segment': detection.original,
                'decision': detection.type,
                'reasoning': detection.explanation,
                'confidence': detection.confidence,
                'replacement': detection.replacement,
                'model_thoughts': parsed_response.get('thinking', '')[:200] + '...' if len(parsed_response.get('thinking', '')) > 200 else parsed_response.get('thinking', '')
            })
        
        return {
            'decision_log': audit_entries,
            'extraction_method': parsed_response.get('extraction_method', 'unknown'),
            'total_detections': len(audit_entries)
        }