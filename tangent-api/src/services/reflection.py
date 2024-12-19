import requests
import os

GENERATION_MODEL = os.getenv("GENERATION_MODEL", "qwen2.5-coder:7b")


def generate_reflection_for_cluster(struggle_texts):
    """Generate a reflection for a cluster based on struggle texts"""
    if not struggle_texts:
        return ""

    texts = "\n".join(f"- {text}" for text in struggle_texts)
    prompt = f"""You are a helpful assistant. Review the following user messages where they express difficulties:

{texts}

Summarize the key challenges they faced and provide a reflection or guidance that addresses these challenges.

Provide ONLY the reflection."""

    payload = {
        "model": GENERATION_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.5},
    }

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json=payload,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 200:
            reflection = response.json().get("response", "").strip()
            return reflection if reflection else "No reflection generated"
        else:
            print(f"Error: Received status code {response.status_code}")
            return "Error generating reflection"
    except Exception as e:
        print(f"Error generating reflection: {str(e)}")
        return "Error"
