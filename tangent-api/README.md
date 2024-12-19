# README.md

# TSNE App

## Overview

The TSNE App is a Flask-based web application designed for processing chat data, generating embeddings, and performing clustering operations. It provides an API for managing chat messages, reflections, and topics, making it a powerful tool for analyzing conversational data.

## Project Structure

```
tsne-app
├── src
│   ├── app.py                # Entry point of the application
│   ├── config.py             # Configuration settings
│   ├── models.py             # Data models and structures
│   ├── tasks.py              # Background task management
│   ├── utils.py              # Utility functions
│   ├── routes                # API route definitions
│   │   ├── __init__.py
│   │   ├── api.py            # Main API routes
│   │   ├── chats.py          # Chat-related routes
│   │   ├── messages.py       # Message retrieval routes
│   │   ├── states.py         # State management routes
│   │   └── topics.py         # Topic-related routes
│   └── services              # Service layer for background processing and data handling
│       ├── __init__.py
│       ├── background_processor.py  # Background processing tasks
│       ├── clustering.py      # Clustering operations
│       ├── data_processing.py  # Data processing functions
│       ├── embedding.py       # Embedding functions
│       ├── reflection.py      # Reflection generation functions
│       └── topic_generation.py # Topic generation functions
├── requirements.txt           # Project dependencies
└── README.md                  # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd tsne-app
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

1. Start the Flask application:
   ```
   python src/app.py
   ```

2. Access the API at `http://localhost:5001/api`.

## API Endpoints

- `/api/process`: Process uploaded chat data.
- `/api/process/status/<task_id>`: Check the status of a processing task.
- `/api/chats/save`: Save chat data.
- `/api/chats/load/<chat_id>`: Load specific chat data.
- `/api/topics`: Retrieve generated topics.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.