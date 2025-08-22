"""
Anonymizer Engine Module
Orchestrates the complete anonymization process
"""

from typing import Dict, Optional
from datetime import datetime
import logging

from .ollama_client import OllamaClient
from .chunker import SmartChunker
from .response_parser import ResponseParser

logger = logging.getLogger(__name__)


class ConsistencyManager:
    """Manages consistency of replacements across chunks"""
    
    def __init__(self):
        self.entity_map = {}  # Original -> Replacement mapping
        self.entity_counter = {}  # Track numbering for each entity type
        
    def get_replacement(self, original: str, pii_type: str) -> str:
        """Get consistent replacement for an entity"""
        if original in self.entity_map:
            return self.entity_map[original]
        
        # Generate new replacement
        if pii_type not in self.entity_counter:
            self.entity_counter[pii_type] = 0
        
        self.entity_counter[pii_type] += 1
        
        # All types get numbered placeholders for unique identification
        replacement = f'[{pii_type}_{self.entity_counter[pii_type]}]'
        
        self.entity_map[original] = replacement
        return replacement
    
    def apply_consistency(self, text: str) -> str:
        """Apply consistent replacements to text"""
        # DISABLED: The model already outputs properly tagged content with <red> tags
        # The parser handles converting those tags to placeholders
        # Additional text replacement is unnecessary and causes issues
        # (e.g., replacing "P" with "[ID]" everywhere in the text)
        return text
    
    def get_mapping_summary(self) -> Dict:
        """Get summary of all mappings"""
        return {
            'total_entities': len(self.entity_map),
            'entity_types': list(self.entity_counter.keys()),
            'mappings': self.entity_map.copy()
        }


class AnonymizerEngine:
    """Main engine for text anonymization"""
    
    def __init__(
        self,
        ollama_client: Optional[OllamaClient] = None,
        chunker: Optional[SmartChunker] = None,
        chunk_size: int = 500,
        chunk_overlap: int = 50
    ):
        self.ollama_client = ollama_client or OllamaClient()
        self.chunker = chunker or SmartChunker(
            chunk_size=chunk_size,
            overlap_tokens=chunk_overlap
        )
        self.parser = ResponseParser()
        
    # Removed non-streaming anonymize method - use anonymize_stream instead
    
    async def anonymize_stream(
        self,
        text: str,
        custom_instructions: str = "",
        return_reasoning: bool = True,
        temperature: float = 0.1,
        top_p: float = 0.9
    ):
        """
        Stream anonymization with chunking support
        
        Yields streaming updates for real-time display
        """
        # Check if chunking is needed
        logger.info(f"[Stream] Input text length: {len(text)} chars, {self.chunker.count_tokens(text)} tokens")
        chunks = self.chunker.chunk_text(text)
        logger.info(f"[Stream] Text split into {len(chunks)} chunks")
        
        if len(chunks) == 1:
            # Single chunk - direct streaming
            prompt = self.ollama_client.instruction_template.format(
                custom_instructions=custom_instructions or self.ollama_client.DEFAULT_TYPES,
                input_text=text
            )
            
            actual_instructions = custom_instructions or self.ollama_client.DEFAULT_TYPES
            async for chunk_data in self.ollama_client._anonymize_stream(
                prompt=prompt,
                return_reasoning=return_reasoning,
                temperature=temperature,
                top_p=top_p,
                custom_instructions=actual_instructions
            ):
                yield chunk_data
        else:
            # Multi-chunk streaming
            consistency_manager = ConsistencyManager()
            full_anonymized = ""
            full_thinking = ""
            all_detections = []
            
            for i, chunk in enumerate(chunks):
                # Notify chunk start
                yield {
                    'type': 'status',
                    'message': f'Processing chunk {i + 1} of {len(chunks)}...'
                }
                
                # Build chunk text
                if chunk.has_overlap and chunk.overlap_content:
                    chunk_text = chunk.overlap_content + "\n\n" + chunk.content
                else:
                    chunk_text = chunk.content
                
                # Build prompt
                prompt = self.ollama_client.instruction_template.format(
                    custom_instructions=custom_instructions or self.ollama_client.DEFAULT_TYPES,
                    input_text=chunk_text
                )
                
                chunk_anonymized = ""
                chunk_thinking = ""
                
                # Stream this chunk
                actual_instructions = custom_instructions or self.ollama_client.DEFAULT_TYPES
                async for chunk_data in self.ollama_client._anonymize_stream(
                    prompt=prompt,
                    return_reasoning=return_reasoning,
                    temperature=temperature,
                    top_p=top_p,
                    custom_instructions=actual_instructions
                ):
                    if chunk_data.get('type') == 'stream':
                        # Pass through streaming content
                        yield chunk_data
                    elif chunk_data.get('type') == 'complete':
                        # Chunk completed
                        chunk_anonymized = chunk_data.get('anonymized_text', '')
                        
                        # Fix placeholder numbering to be consistent across chunks
                        if chunk_anonymized and chunk_data.get('reasoning'):
                            # Process each detection and fix the numbering
                            for detection in chunk_data['reasoning'].get('detected_pii', []):
                                original = detection.get('original', '') if isinstance(detection, dict) else detection.original
                                old_replacement = detection.get('replacement', '') if isinstance(detection, dict) else detection.replacement
                                pii_type = detection.get('type', '') if isinstance(detection, dict) else detection.type
                                
                                # Get the consistent replacement from our manager
                                new_replacement = consistency_manager.get_replacement(original, pii_type)
                                
                                # Replace the old placeholder with the new consistent one in the chunk text
                                if old_replacement != new_replacement and old_replacement in chunk_anonymized:
                                    chunk_anonymized = chunk_anonymized.replace(old_replacement, new_replacement)
                                    logger.info(f"[Chunk {i+1}] Renumbered {old_replacement} -> {new_replacement} for '{original}'")
                                
                                # Update the detection object with the new replacement
                                if isinstance(detection, dict):
                                    detection['replacement'] = new_replacement
                                else:
                                    detection.replacement = new_replacement
                        
                        # Remove overlap if present
                        if chunk_anonymized and chunk.has_overlap and chunk.overlap_content:
                            # TODO: Also need to apply consistent replacements to overlap check
                            overlap_anon = chunk.overlap_content
                            # Replace known entities in overlap with their placeholders
                            for orig, repl in consistency_manager.entity_map.items():
                                overlap_anon = overlap_anon.replace(orig, repl)
                            
                            if chunk_anonymized.startswith(overlap_anon):
                                chunk_anonymized = chunk_anonymized[len(overlap_anon):].strip()
                        
                        if chunk_anonymized:
                            full_anonymized += ("\n\n" if full_anonymized else "") + chunk_anonymized
                        
                        # Collect reasoning
                        if chunk_data.get('reasoning'):
                            reasoning = chunk_data['reasoning']
                            if reasoning.get('thought_process'):
                                chunk_thinking = reasoning['thought_process']
                                full_thinking += f"\n\nChunk {i + 1}:\n{chunk_thinking}"
                            
                            # Add all detections with updated replacements
                            for detection in reasoning.get('detected_pii', []):
                                if hasattr(detection, '__dict__'):
                                    # It's a PIIDetection object
                                    detection_dict = {
                                        'type': detection.type,
                                        'original': detection.original,
                                        'replacement': detection.replacement,  # Now has consistent numbering
                                        'confidence': getattr(detection, 'confidence', 1.0),
                                        'explanation': getattr(detection, 'explanation', ''),
                                        'chunk_index': i
                                    }
                                    all_detections.append(detection_dict)
                                else:
                                    # It's already a dict
                                    detection['chunk_index'] = i
                                    all_detections.append(detection)
                    elif chunk_data.get('type') == 'error':
                        yield chunk_data
                        return
            
            # Sort detections by their order of appearance in the final text
            # and add occurrence order index
            import re
            ordered_detections = []
            used_positions = set()
            
            # Find each placeholder in the final text and map to its detection
            placeholder_pattern = re.compile(r'\[([A-Z_]+)_(\d+)\]')
            for match in placeholder_pattern.finditer(full_anonymized):
                placeholder = match.group(0)
                position = match.start()
                
                # Find corresponding detection(s) for this placeholder
                for detection in all_detections:
                    det_replacement = detection.get('replacement') if isinstance(detection, dict) else detection.replacement
                    
                    # Match this detection to the placeholder and ensure we haven't used this detection yet
                    if det_replacement == placeholder and id(detection) not in used_positions:
                        ordered_detection = detection.copy() if isinstance(detection, dict) else {
                            'type': detection.type,
                            'original': detection.original,
                            'replacement': detection.replacement,
                            'confidence': detection.confidence,
                            'explanation': detection.explanation,
                            'chunk_index': getattr(detection, 'chunk_index', 0)
                        }
                        ordered_detection['i'] = len(ordered_detections)  # Add occurrence order
                        ordered_detections.append(ordered_detection)
                        used_positions.add(id(detection))
                        break
            
            # Calculate confidence average from ordered detections
            confidence_avg = None
            if ordered_detections:
                confidence_sum = sum(d.get('confidence', 0) if isinstance(d, dict) else d.confidence for d in ordered_detections)
                confidence_avg = confidence_sum / len(ordered_detections)
            
            # Send final complete response with ordered detections
            yield {
                'type': 'complete',
                'anonymized_text': full_anonymized,
                'reasoning': {
                    'thought_process': full_thinking,
                    'detected_pii': ordered_detections,
                    'chunks_processed': len(chunks),
                    'extraction_method': 'stream_chunked',
                    'consistency_map': consistency_manager.get_mapping_summary(),
                    'confidence_avg': confidence_avg
                } if return_reasoning else None
            }
    
    # Removed chunk processing methods - handled in anonymize_stream now
    
    # Removed merge results method - not needed with streaming-only approach
    
    async def validate_anonymization(self, original: str, anonymized: str) -> Dict:
        """
        Validate that anonymization was successful
        
        Returns:
            Validation results with any issues found
        """
        issues = []
        
        # Check for common PII patterns that might have been missed
        import re
        
        patterns = {
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'phone': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
            'credit_card': r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b'
        }
        
        for pii_type, pattern in patterns.items():
            matches = re.findall(pattern, anonymized)
            if matches:
                issues.append({
                    'type': pii_type,
                    'found': matches,
                    'severity': 'high'
                })
        
        # Check for proper placeholder format
        placeholder_pattern = r'\[[A-Z_0-9]+\]'
        placeholders = re.findall(placeholder_pattern, anonymized)
        
        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'placeholders_found': len(placeholders),
            'length_reduction': (len(original) - len(anonymized)) / len(original) * 100
        }
    
    # Removed batch_anonymize - not used with streaming-only approach
    
    def create_anonymization_report(self, result: Dict) -> str:
        """Create a human-readable anonymization report"""
        report = []
        report.append("=" * 60)
        report.append("ANONYMIZATION REPORT")
        report.append("=" * 60)
        
        # Metadata
        metadata = result.get('metadata', {})
        report.append(f"\nTimestamp: {metadata.get('timestamp', 'N/A')}")
        report.append(f"Model: {metadata.get('model', 'N/A')}")
        report.append(f"Processing Time: {metadata.get('processing_time', 0):.2f} seconds")
        report.append(f"Chunks Processed: {metadata.get('chunks', 1)}")
        
        # Statistics
        report.append(f"\nInput Length: {metadata.get('input_length', 0)} characters")
        report.append(f"Output Length: {metadata.get('output_length', 0)} characters")
        
        # PII Detections
        if result.get('reasoning', {}).get('detected_pii'):
            detections = result['reasoning']['detected_pii']
            report.append(f"\nPII Detected: {len(detections)} items")
            
            # Group by type
            by_type = {}
            for detection in detections:
                pii_type = detection.get('type', 'UNKNOWN')
                if pii_type not in by_type:
                    by_type[pii_type] = []
                by_type[pii_type].append(detection)
            
            for pii_type, items in by_type.items():
                report.append(f"\n{pii_type}: {len(items)} occurrences")
                for item in items[:3]:  # Show first 3
                    report.append(f"  - {item.get('original', 'N/A')} → {item.get('replacement', 'N/A')}")
                if len(items) > 3:
                    report.append(f"  ... and {len(items) - 3} more")
        
        # Consistency Map
        if result.get('reasoning', {}).get('consistency_map'):
            consistency = result['reasoning']['consistency_map']
            report.append(f"\nConsistency Mappings: {consistency.get('total_entities', 0)}")
        
        report.append("\n" + "=" * 60)
        
        return '\n'.join(report)