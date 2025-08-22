"""
Text Chunker Module
Smart text chunking with context preservation
"""

import tiktoken
from typing import List, Dict, Tuple, Optional
import re
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    """Represents a chunk of text with metadata"""
    content: str
    index: int
    start_pos: int
    end_pos: int
    token_count: int
    has_overlap: bool = False
    overlap_content: str = ""
    metadata: Dict = None


class SmartChunker:
    """Intelligent text chunking with boundary detection"""
    
    def __init__(
        self,
        chunk_size: int = 500,
        overlap_tokens: int = 50,
        model: str = "cl100k_base"
    ):
        """
        Initialize chunker
        
        Args:
            chunk_size: Maximum tokens per chunk for input text
            overlap_tokens: Number of tokens to overlap between chunks
            model: Tiktoken model for token counting
        """
        self.chunk_size = chunk_size
        self.overlap_tokens = overlap_tokens
        
        try:
            self.encoder = tiktoken.get_encoding(model)
        except Exception as e:
            logger.warning(f"Failed to load {model}, using cl100k_base: {e}")
            self.encoder = tiktoken.get_encoding("cl100k_base")
        
        # Sentence boundary patterns
        # Match period/exclamation/question followed by optional space
        self.sentence_endings = re.compile(r'[.!?]\s*')
        self.paragraph_boundary = re.compile(r'\n\n+')
        
    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        return len(self.encoder.encode(text))
    
    def chunk_text(self, text: str, preserve_context: bool = True) -> List[TextChunk]:
        """
        Chunk text into manageable pieces
        
        Args:
            text: Text to chunk
            preserve_context: Whether to preserve context across chunks
            
        Returns:
            List of text chunks
        """
        token_count = self.count_tokens(text)
        logger.info(f"[Chunker] Text has {token_count} tokens, chunk_size is {self.chunk_size}")
        if token_count <= self.chunk_size:
            # No chunking needed
            return [TextChunk(
                content=text,
                index=0,
                start_pos=0,
                end_pos=len(text),
                token_count=self.count_tokens(text),
                metadata={'single_chunk': True}
            )]
        
        # Find natural boundaries
        paragraphs = self._split_paragraphs(text)
        
        if len(paragraphs) > 1:
            # Try paragraph-based chunking first
            chunks = self._chunk_by_paragraphs(paragraphs, preserve_context)
            if chunks:
                return chunks
        
        # Fall back to sentence-based chunking
        return self._chunk_by_sentences(text, preserve_context)
    
    def _split_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs"""
        paragraphs = self.paragraph_boundary.split(text)
        return [p.strip() for p in paragraphs if p.strip()]
    
    def _chunk_by_paragraphs(
        self,
        paragraphs: List[str],
        preserve_context: bool
    ) -> List[TextChunk]:
        """Chunk text by paragraph boundaries"""
        chunks = []
        current_chunk = []
        current_tokens = 0
        current_pos = 0
        
        for para in paragraphs:
            para_tokens = self.count_tokens(para)
            
            if para_tokens > self.chunk_size:
                # Paragraph too large, need to split it
                if current_chunk:
                    # Save current chunk
                    chunk_text = '\n\n'.join(current_chunk)
                    chunks.append(TextChunk(
                        content=chunk_text,
                        index=len(chunks),
                        start_pos=current_pos,
                        end_pos=current_pos + len(chunk_text),
                        token_count=current_tokens,
                        metadata={'type': 'paragraph'}
                    ))
                    current_chunk = []
                    current_tokens = 0
                    current_pos += len(chunk_text) + 2
                
                # Split large paragraph
                para_chunks = self._chunk_by_sentences(para, preserve_context)
                for pc in para_chunks:
                    pc.index = len(chunks)
                    chunks.append(pc)
                
                current_pos += len(para) + 2
                
            elif current_tokens + para_tokens > self.chunk_size:
                # Would exceed limit, create chunk
                chunk_text = '\n\n'.join(current_chunk)
                overlap_content = ""
                
                if preserve_context and chunks:
                    # Add overlap from end of current chunk
                    overlap_content = self._get_overlap_content(current_chunk)
                
                chunks.append(TextChunk(
                    content=chunk_text,
                    index=len(chunks),
                    start_pos=current_pos,
                    end_pos=current_pos + len(chunk_text),
                    token_count=current_tokens,
                    has_overlap=bool(overlap_content),
                    overlap_content=overlap_content,
                    metadata={'type': 'paragraph'}
                ))
                
                current_chunk = [para]
                current_tokens = para_tokens
                current_pos += len(chunk_text) + 2
                
            else:
                # Add to current chunk
                current_chunk.append(para)
                current_tokens += para_tokens
        
        # Add remaining content
        if current_chunk:
            chunk_text = '\n\n'.join(current_chunk)
            chunks.append(TextChunk(
                content=chunk_text,
                index=len(chunks),
                start_pos=current_pos,
                end_pos=current_pos + len(chunk_text),
                token_count=current_tokens,
                metadata={'type': 'paragraph'}
            ))
        
        return chunks
    
    def _chunk_by_sentences(self, text: str, preserve_context: bool) -> List[TextChunk]:
        """Chunk text by sentence boundaries"""
        sentences = self.sentence_endings.split(text)
        logger.info(f"[Chunker] Split into {len(sentences)} sentences")
        
        # Restore sentence endings
        restored_sentences = []
        for i, sent in enumerate(sentences[:-1]):
            # Find the ending punctuation
            match = self.sentence_endings.search(text[text.find(sent) + len(sent):])
            if match:
                restored_sentences.append(sent + match.group(0).strip())
            else:
                restored_sentences.append(sent + '.')
        
        if sentences:
            restored_sentences.append(sentences[-1])
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        current_pos = 0
        
        for sent in restored_sentences:
            sent_tokens = self.count_tokens(sent)
            
            if sent_tokens > self.chunk_size:
                # Single sentence too long, split by words
                if current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    chunks.append(TextChunk(
                        content=chunk_text,
                        index=len(chunks),
                        start_pos=current_pos,
                        end_pos=current_pos + len(chunk_text),
                        token_count=current_tokens,
                        metadata={'type': 'sentence'}
                    ))
                    current_chunk = []
                    current_tokens = 0
                    current_pos += len(chunk_text) + 1
                
                # Split long sentence
                word_chunks = self._chunk_by_words(sent, preserve_context)
                chunks.extend(word_chunks)
                current_pos += len(sent) + 1
                
            elif current_tokens + sent_tokens > self.chunk_size:
                # Would exceed limit
                chunk_text = ' '.join(current_chunk)
                overlap_content = ""
                
                if preserve_context and current_chunk:
                    overlap_content = self._get_overlap_content(current_chunk)
                
                chunks.append(TextChunk(
                    content=chunk_text,
                    index=len(chunks),
                    start_pos=current_pos,
                    end_pos=current_pos + len(chunk_text),
                    token_count=current_tokens,
                    has_overlap=bool(overlap_content),
                    overlap_content=overlap_content,
                    metadata={'type': 'sentence'}
                ))
                
                # Start new chunk with overlap
                if preserve_context and overlap_content:
                    current_chunk = overlap_content.split()[-self.overlap_tokens:] + [sent]
                    current_tokens = self.count_tokens(' '.join(current_chunk))
                else:
                    current_chunk = [sent]
                    current_tokens = sent_tokens
                
                current_pos += len(chunk_text) + 1
                
            else:
                current_chunk.append(sent)
                current_tokens += sent_tokens
        
        # Add remaining
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append(TextChunk(
                content=chunk_text,
                index=len(chunks),
                start_pos=current_pos,
                end_pos=current_pos + len(chunk_text),
                token_count=current_tokens,
                metadata={'type': 'sentence'}
            ))
        
        return chunks
    
    def _chunk_by_words(self, text: str, preserve_context: bool) -> List[TextChunk]:
        """Last resort: chunk by word count"""
        words = text.split()
        chunks = []
        
        # Estimate words per chunk
        avg_tokens_per_word = self.count_tokens(text) / len(words)
        words_per_chunk = int(self.chunk_size / avg_tokens_per_word)
        
        for i in range(0, len(words), words_per_chunk):
            chunk_words = words[i:i + words_per_chunk]
            chunk_text = ' '.join(chunk_words)
            
            chunks.append(TextChunk(
                content=chunk_text,
                index=len(chunks),
                start_pos=i,
                end_pos=min(i + words_per_chunk, len(words)),
                token_count=self.count_tokens(chunk_text),
                metadata={'type': 'words', 'forced_split': True}
            ))
        
        return chunks
    
    def _get_overlap_content(self, chunk_content: List[str]) -> str:
        """Get overlap content from end of chunk"""
        if not chunk_content or self.overlap_tokens <= 0:
            return ""
        
        # Take last few sentences/paragraphs for context
        overlap_text = ' '.join(chunk_content[-2:]) if len(chunk_content) > 1 else chunk_content[-1]
        
        # Limit to overlap_tokens
        if self.count_tokens(overlap_text) > self.overlap_tokens:
            words = overlap_text.split()
            while self.count_tokens(' '.join(words)) > self.overlap_tokens and len(words) > 10:
                words = words[1:]  # Remove from beginning
            overlap_text = ' '.join(words)
        
        return overlap_text
    
    def merge_chunks(self, chunks: List[TextChunk]) -> str:
        """Merge chunks back into complete text"""
        if not chunks:
            return ""
        
        # Sort by index to ensure correct order
        sorted_chunks = sorted(chunks, key=lambda x: x.index)
        
        # Simple merge (ignoring overlaps)
        return '\n\n'.join(chunk.content for chunk in sorted_chunks)
    
    def aggregate_reasoning(self, chunk_reasonings: List[Dict]) -> Dict:
        """
        Aggregate reasoning from multiple chunks
        
        Args:
            chunk_reasonings: List of reasoning dicts from each chunk
            
        Returns:
            Aggregated reasoning
        """
        all_detections = []
        all_thoughts = []
        total_time = 0
        
        for i, reasoning in enumerate(chunk_reasonings):
            if not reasoning:
                continue
            
            # Collect detections
            detections = reasoning.get('detected_pii', [])
            for detection in detections:
                detection['chunk_index'] = i
                all_detections.append(detection)
            
            # Collect thoughts
            thought = reasoning.get('thought_process', '')
            if thought:
                all_thoughts.append(f"Chunk {i + 1}:\n{thought}")
            
            # Sum processing time
            total_time += reasoning.get('processing_time', 0)
        
        return {
            'thought_process': '\n\n'.join(all_thoughts),
            'detected_pii': all_detections,
            'processing_time': total_time,
            'chunks_processed': len(chunk_reasonings),
            'aggregation_method': 'sequential'
        }