import requests
import os

GENERATION_MODEL = os.getenv("GENERATION_MODEL", "qwen2.5-coder:7b")


def generate_topic_for_cluster(titles):
    """Generate a topic label for a cluster of titles"""
    titles_text = "\n".join(f"- {title}" for title in titles)
    prompt = f"""You are a technical topic analyzer. Review these related titles and provide a single concise topic label (2-4 words) that best describes their common theme.

Titles:
{titles_text}

Provide ONLY the topic label, nothing else. Examples:
"Network Security Tools"
"UI Animation Design"
"Data Visualization"
"API Integration"
"""

    payload = {
        "model": GENERATION_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.2},
    }

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json=payload,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 200:
            topic = response.json().get("response", "").strip()
            return topic if topic else "Miscellaneous"
        else:
            print(f"Error: Received status code {response.status_code}")
            return "Error generating topic"
    except Exception as e:
        print(f"Error generating topic: {str(e)}")
        return "Error"
