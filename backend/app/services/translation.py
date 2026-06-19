import asyncio
import os
from typing import Dict, Any
from dotenv import load_dotenv


from groq import AsyncGroq

load_dotenv()

async def translate_transcription_advanced(
    transcription: str,
    target_language: str,
    preserve_formatting: bool = True,
    formality: str = "neutral",  # "formal", "informal", or "neutral"
    model: str = "llama-3.3-70b-versatile"
) -> Dict[str, Any]:
    """
    Advanced translation function using Groq AI with comprehensive error handling.
    
    Args:
        transcription (str): Original transcription text
        target_language (str): Target language for translation
        preserve_formatting (bool): Whether to preserve original formatting
        formality (str): Translation formality level ("formal", "informal", or "neutral")
        model (str): Groq model to use
    
    Returns:
        Dict containing:
        {
            "success": bool,
            "translated_text": str or None,
            "original_text": str,
            "target_language": str,
            "formality": str,
            "preserve_formatting": bool,
            "model_used": str,
            "error": str or None,
            "error_type": str or None,
            "usage": dict or None
        }
    """
    # Initialize result dictionary
    result = {
        "success": False,
        "translated_text": None,
        "original_text": transcription,
        "target_language": target_language,
        "formality": formality,
        "preserve_formatting": preserve_formatting,
        "model_used": model,
        "error": None,
        "error_type": None,
        "usage": None
    }
    
    # Input validation
    if not transcription or not isinstance(transcription, str):
        result["error"] = "Transcription text must be a non-empty string"
        result["error_type"] = "ValidationError"
        return result
    
    if not transcription.strip():
        result["error"] = "Transcription text cannot be empty or whitespace only"
        result["error_type"] = "ValidationError"
        return result
    
    if not target_language or not isinstance(target_language, str):
        target_language = "English"
    else:
        target_language = target_language.strip() or "English"

    result["target_language"] = target_language
    
    # Validate formality parameter
    valid_formality = ["formal", "informal", "neutral"]
    if formality.lower() not in valid_formality:
        result["error"] = f"Formality must be one of: {', '.join(valid_formality)}"
        result["error_type"] = "ValidationError"
        return result
    
    # Check for API key
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        result["error"] = "GROQ_API_KEY environment variable not set"
        result["error_type"] = "AuthenticationError"
        return result
    
    # Limit transcription length
    if len(transcription) > 10000:
        result["error"] = "Transcription text exceeds maximum length of 10,000 characters"
        result["error_type"] = "ValidationError"
        return result
    
    try:
        # Initialize Groq client
        client = AsyncGroq(api_key=api_key)
        
        # System prompt based on parameters
        system_prompt = f"""You are a professional translator specializing in {target_language} translations.
Rules:
1. Translate the text accurately into {target_language}
2. Maintain {formality.lower()} tone and register
3. {'Preserve' if preserve_formatting else 'Adapt'} original formatting, punctuation, and paragraph structure
4. Translate idioms and cultural references appropriately for {target_language} speakers
5. Return ONLY the translated text, no explanations, notes, or quotation marks
6. If the text contains any content that cannot be accurately translated, adapt it to the closest cultural equivalent"""

        user_prompt = f"Translate the following text to {target_language}:\n\n{transcription}"

        # Make API call using Groq's async client
        chat_response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            temperature=0.2,  # Lower temperature for consistent translations
            max_tokens=min(len(transcription) * 3, 2000),  # Dynamic token limit
            timeout=30,  # 30 second timeout
        )
        
        # Extract and clean translated text
        if chat_response and chat_response.choices:
            translated_text = chat_response.choices[0].message.content
            
            if translated_text:
                translated_text = translated_text.strip()
                # Remove any quotation marks if present
                if (translated_text.startswith('"') and translated_text.endswith('"')) or \
                   (translated_text.startswith("'") and translated_text.endswith("'")):
                    translated_text = translated_text[1:-1]
            
            # Validate translation exists
            if not translated_text:
                result["error"] = "Received empty translation from API"
                result["error_type"] = "APIResponseError"
                return result
            
            # Success
            result["success"] = True
            result["translated_text"] = translated_text
            
            # Include usage statistics if available
            if hasattr(chat_response, 'usage') and chat_response.usage:
                result["usage"] = {
                    "prompt_tokens": chat_response.usage.prompt_tokens,
                    "completion_tokens": chat_response.usage.completion_tokens,
                    "total_tokens": chat_response.usage.total_tokens,
                }
            
            return result
        else:
            result["error"] = "No response choices received from API"
            result["error_type"] = "APIResponseError"
            return result
    
    except asyncio.TimeoutError:
        result["error"] = "Request timed out after 30 seconds"
        result["error_type"] = "TimeoutError"
        return result
    
    except ConnectionError as e:
        result["error"] = f"Connection failed: {str(e)}"
        result["error_type"] = "ConnectionError"
        return result
    
    except PermissionError as e:
        result["error"] = f"Authentication failed: {str(e)}"
        result["error_type"] = "AuthenticationError"
        return result
    
    except ValueError as e:
        error_message = str(e).lower()
        if "rate limit" in error_message or "too many requests" in error_message:
            result["error"] = f"Rate limit exceeded: {str(e)}"
            result["error_type"] = "RateLimitError"
        elif "unauthorized" in error_message or "authentication" in error_message or "api key" in error_message:
            result["error"] = f"Authentication failed: {str(e)}"
            result["error_type"] = "AuthenticationError"
        else:
            result["error"] = f"Invalid value: {str(e)}"
            result["error_type"] = "ValueError"
        return result
    
    except RuntimeError as e:
        result["error"] = f"Runtime error: {str(e)}"
        result["error_type"] = "RuntimeError"
        return result
    
    except Exception as e:
        # Categorize unknown exceptions based on error message patterns
        error_message = str(e).lower()
        error_type = type(e).__name__
        
        if "timeout" in error_message:
            result["error"] = f"Request timed out: {str(e)}"
            result["error_type"] = "TimeoutError"
        elif "rate limit" in error_message or "too many requests" in error_message:
            result["error"] = f"Rate limit exceeded: {str(e)}"
            result["error_type"] = "RateLimitError"
        elif "unauthorized" in error_message or "authentication" in error_message or "401" in error_message:
            result["error"] = f"Authentication failed: {str(e)}"
            result["error_type"] = "AuthenticationError"
        elif "connection" in error_message or "network" in error_message:
            result["error"] = f"Connection error: {str(e)}"
            result["error_type"] = "ConnectionError"
        elif "api" in error_message:
            result["error"] = f"API error: {str(e)}"
            result["error_type"] = "APIError"
        else:
            result["error"] = f"Unexpected {error_type}: {str(e)}"
            result["error_type"] = "UnexpectedError"
        
        return result


async def main():
    """Main function demonstrating usage of the translation function."""
    
    # Example 1: Basic translation
    print("=" * 60)
    print("Example 1: Basic Translation")
    print("=" * 60)
    
    result = await translate_transcription_advanced(
        transcription="Hello, how are you today? I hope you're doing well.",
        target_language="Spanish",
        formality="neutral"
    )
    
    if result["success"]:
        print("✓ Translation successful")
        print(f"Original: {result['original_text']}")
        print(f"Translated ({result['target_language']}): {result['translated_text']}")
        print(f"Model used: {result['model_used']}")
        if result["usage"]:
            print(f"Tokens used: {result['usage']['total_tokens']}")
    else:
        print("✗ Translation failed")
        print(f"Error Type: {result['error_type']}")
        print(f"Error: {result['error']}")
    
    # Example 2: Formal translation
    print("\n" + "=" * 60)
    print("Example 2: Formal Business Translation")
    print("=" * 60)
    
    result = await translate_transcription_advanced(
        transcription="Please submit the quarterly report by Friday at 5 PM.",
        target_language="French",
        formality="formal",
        preserve_formatting=True
    )
    
    if result["success"]:
        print("✓ Translation successful")
        print(f"Original: {result['original_text']}")
        print(f"Translated ({result['target_language']}): {result['translated_text']}")
    else:
        print(f"✗ Translation failed: {result['error']}")
    
    # Example 3: Error handling demonstration
    print("\n" + "=" * 60)
    print("Example 3: Error Handling")
    print("=" * 60)
    
    # Test with empty transcription
    result = await translate_transcription_advanced(
        transcription="",
        target_language="German",
        formality="neutral"
    )
    
    if not result["success"]:
        print("✓ Error caught successfully")
        print(f"Error Type: {result['error_type']}")
        print(f"Error Message: {result['error']}")
    
    # Example 4: Informal translation
    print("\n" + "=" * 60)
    print("Example 4: Informal Translation")
    print("=" * 60)
    
    result = await translate_transcription_advanced(
        transcription="Hey, what's up? Want to grab lunch later?",
        target_language="Italian",
        formality="informal"
    )
    
    if result["success"]:
        print("✓ Translation successful")
        print(f"Original: {result['original_text']}")
        print(f"Translated ({result['target_language']}): {result['translated_text']}")


if __name__ == "__main__":
    asyncio.run(main())
