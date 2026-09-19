"""
Quick debug script to test OpenRouter API directly.
"""

import asyncio
import httpx
from app.core.config import Settings

async def test_openrouter():
    settings = Settings()
    api_key = settings.openrouter_api_key.get_secret_value()
    
    print(f"API Key configured: {bool(api_key)}")
    print(f"API Key (first 20 chars): {api_key[:20] if api_key else 'None'}...")
    print(f"Model: {settings.openrouter_model}")
    print(f"Timeout: {settings.openrouter_timeout_seconds}s")
    print(f"\nTesting OpenRouter API...\n")
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful assistant. Respond in JSON format.",
                        },
                        {
                            "role": "user",
                            "content": '{"test": "Generate a short explanation about Maize crop"}',
                        },
                    ],
                    "response_format": {"type": "json_object"},
                },
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"\nResponse:")
            print(response.text[:500])
            
            if response.status_code == 200:
                data = response.json()
                print(f"\n✅ SUCCESS! OpenRouter is working.")
                print(f"Model used: {data.get('model', 'unknown')}")
                if 'choices' in data and len(data['choices']) > 0:
                    content = data['choices'][0]['message']['content']
                    print(f"Response content: {content[:200]}...")
            else:
                print(f"\n❌ FAILED with status {response.status_code}")
                
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_openrouter())
