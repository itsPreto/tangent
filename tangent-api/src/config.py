import os

# Configuration settings
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-minilm")
GENERATION_MODEL = os.getenv("GENERATION_MODEL", "qwen2.5-coder:7b")

# Directory paths
BASE_DATA_DIR = "./processed_data"
CLAUDE_DATA_DIR = os.path.join(BASE_DATA_DIR, "claude")
CHATGPT_DATA_DIR = os.path.join(BASE_DATA_DIR, "chatgpt")

# Required files for processing
REQUIRED_FILES = [
    "analytics.json",
    "embeddings_2d.json",
    "clusters.json",
    "topics.json",
    "chat_titles.json",
    "reflections.json",
]
