import os
import json
from config import BASE_DATA_DIR, CLAUDE_DATA_DIR, CHATGPT_DATA_DIR

def check_files_exist(data_dir: str) -> dict:
    REQUIRED_FILES = [
        "analytics.json",
        "embeddings_2d.json",
        "clusters.json",
        "topics.json",
        "chat_titles.json",
        "reflections.json",
    ]

    existing_files = {}
    for file in REQUIRED_FILES:
        path = os.path.join(data_dir, file)
        existing_files[file] = os.path.exists(path)
    return existing_files


def send_progress(step, progress=0):
    return f"data: {json.dumps({'type': 'progress', 'step': step, 'progress': progress})}\n\n"


def send_error(message):
    return f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"


def send_complete():
    return f"data: {json.dumps({'type': 'complete'})}\n\n"


def ensure_directories():
    """Ensure all required data directories exist"""
    # Create base data directory
    os.makedirs(BASE_DATA_DIR, exist_ok=True)

    # Create chat-specific directories
    os.makedirs(CLAUDE_DATA_DIR, exist_ok=True)
    os.makedirs(CHATGPT_DATA_DIR, exist_ok=True)

    # Create states directories for both chat types
    os.makedirs(os.path.join(CLAUDE_DATA_DIR, "states"), exist_ok=True)
    os.makedirs(os.path.join(CHATGPT_DATA_DIR, "states"), exist_ok=True)

def load_visualization_data(data_dir: str) -> dict:
    """Load visualization data from the specified directory."""
    try:
        data = {}

        # Load embeddings
        embeddings_path = os.path.join(data_dir, "embeddings_2d.json")
        if os.path.exists(embeddings_path):
            with open(embeddings_path, "r") as f:
                data["points"] = json.load(f)
        else:
            data["points"] = []

        # Load clusters
        clusters_path = os.path.join(data_dir, "clusters.json")
        if os.path.exists(clusters_path):
            with open(clusters_path, "r") as f:
                data["clusters"] = json.load(f)
        else:
            data["clusters"] = []

        # Load topics
        topics_path = os.path.join(data_dir, "topics.json")
        if os.path.exists(topics_path):
            with open(topics_path, "r") as f:
                data["topics"] = json.load(f)
        else:
            data["topics"] = {}

        # Load chat titles (now include branch info)
        titles_path = os.path.join(data_dir, "chat_titles.json")
        if os.path.exists(titles_path):
            with open(titles_path, "r") as f:
                data["titles"] = json.load(f)
        else:
            data["titles"] = []

        # Load chats with reflections
        reflections_path = os.path.join(data_dir, "chats_with_reflections.json")
        if os.path.exists(reflections_path):
            with open(reflections_path, "r") as f:
                data["chats_with_reflections"] = json.load(f)
        else:
            data["chats_with_reflections"] = []

        return data

    except Exception as e:
        print(f"Error loading visualization data: {str(e)}")
        return {
            "points": [],
            "clusters": [],
            "titles": [],
            "topics": {},
            "chats_with_reflections": [],
        }
