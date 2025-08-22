# Ollama Service Testing Documentation

## Test Results Summary

✅ **Ollama service is operational**
- Version: 0.11.6
- API endpoint: http://localhost:11434
- Successfully connected and tested

## Available Models

| Model | Size | Status | Notes |
|-------|------|--------|-------|
| qwen3:32b | 20.2 GB | ✅ Installed | Currently using for testing |
| qwen3:30b-a3b | ~18 GB | ⏳ Downloading | Recommended model (38% complete) |
| qwen3:14b | 9.3 GB | ✅ Installed | Smaller alternative |
| qwen3:8b | 5.2 GB | ✅ Installed | Lightweight option |
| llama3.3:70b | 42.5 GB | ✅ Installed | Large model |
| llama3.2:latest | 2.0 GB | ✅ Installed | Very lightweight |

## Test Results with Qwen3:32b

### Anonymization Test
- **Processing time**: 59.49 seconds
- **Accuracy**: Successfully identified and replaced all PII types
- **Output quality**: Good, but includes thinking process in output

### Identified Issue
The model includes its internal thinking process (`<think>` tags) in the output. This needs to be filtered in production.

### Sample Output
```
Input: John Smith called me yesterday at 555-1234-5678...
Output: [NAME_1] called me yesterday at [PHONE]...
```

## Key Findings

1. **Model Performance**: Qwen3:32b works well for anonymization but needs output filtering
2. **Processing Speed**: ~1 minute for moderate text, acceptable for MVP
3. **API Integration**: Ollama Python client works smoothly
4. **Streaming Support**: Available for real-time feedback

## Recommended Prompt Structure

```python
prompt = """You are a text anonymization assistant. 
Replace PII with placeholders:
- Names → [NAME_N]
- Phone → [PHONE]
- Address → [ADDRESS]
- Email → [EMAIL]
- SSN → [SSN]

Text: {input_text}

Output only the anonymized text without any explanation or thinking process.
Anonymized:"""
```

## Next Steps

1. **Wait for qwen3:30b-a3b download** (~16 minutes remaining)
2. **Implement output filtering** to remove thinking tags
3. **Optimize prompts** for cleaner output
4. **Test with larger texts** to validate chunking needs

## Python Integration Example

```python
from ollama import Client

client = Client(host='http://localhost:11434')

response = client.generate(
    model='qwen3:32b',
    prompt=prompt,
    options={
        'temperature': 0.1,  # Low for consistency
        'top_p': 0.9,
    }
)

# Filter output
anonymized = response['response']
if '<think>' in anonymized:
    anonymized = anonymized.split('</think>')[-1].strip()
```

## Configuration Notes

- **Temperature**: Keep low (0.1) for consistent anonymization
- **Top-p**: 0.9 works well
- **Stream**: Enable for real-time UI feedback
- **Context window**: 32K tokens native, sufficient for most documents

## Model Comparison

| Aspect | Qwen3:32b | Qwen3:30b-a3b (expected) |
|--------|-----------|-------------------------|
| Parameters | 32B | 30.5B total, 3.3B active |
| Architecture | Standard | MoE (more efficient) |
| Context | 32K | 32K-131K |
| Speed | Moderate | Faster (fewer active params) |
| Accuracy | Good | Expected better |

## Fallback Strategy

If qwen3:30b-a3b doesn't meet requirements:
1. Continue with qwen3:32b (already tested and working)
2. Implement aggressive output filtering
3. Consider fine-tuning prompts for cleaner output
4. Test qwen3:14b for faster processing on smaller texts