import requests
import os

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-minilm")


def get_embeddings(texts):
    """Get embeddings from the embedding API"""
    url = "http://localhost:11434/api/embed"
    payload = {"model": EMBEDDING_MODEL, "input": texts}
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json().get("embeddings", [])
        else:
            print(f"Error: Received status code {response.status_code}")
            return None
    except Exception as e:
        print(f"Error getting embeddings: {str(e)}")
        return None
