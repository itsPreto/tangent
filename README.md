<div align="center">

<img src="https://github.com/user-attachments/assets/cd8a656e-f643-439c-a64a-694d521c43fe" alt="tangent" style="border-radius: 10px">

## What is this?

Tangent is a canvas for exploring AI conversations, treating each chat branch as an experiment you can merge, compare, and discard. It lets you resurrect conversations that hit context limits, pick up abandoned threads, and map the hidden connections between different discussions.

## Core stuff it does:
</div>

- 🌟 Resurrect & Continue: Seamlessly resume conversations after reaching a prior context limit.
- 🌿 Branch & Explore: Effortlessly create conversation forks at any point to test multiple approaches or ideas.
- 💻 Offline-First: Fully powered by local models, leveraging Ollama with plans to expand support.
- 📂 Topic Clustering: Dynamically organize and filter conversations by their inferred topics, streamlining navigation.
- 📜 Archive Support: Comprehensive compatibility with Claude and ChatGPT data exports, with additional integrations in development.

<div align="center">
> The idea is to make your interaction with AI assistants more of a visual/textual/audio exploration rather than a plain chat interface. Think less "chat app" and more "thoughts workbench" where you can experiment freely, revive old threads that still have potential, or dive into tangents.

https://github.com/user-attachments/assets/69fac816-ebec-4506-af33-2d31bbe9419e

## Project Structure

The backend is organized into a clean, modular structure:
</div>

```
tangent-api
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

<div align="center">
 
## Quick Installation

</div>



* [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`git clone https://github.com/ggerganov/whisper.cpp` -> `cd whisper.cpp` -> `sh ./models/download-ggml-model.sh base.en` -> `make` -> `make server && ./server`)
* [Ollama](https://ollama.com/) (project was kinda hardcoded for ollama but can be generalized to accept diff backends)
* Exported Archive Data (from Claude or ChatGPT)


```bash
# Clone the repository
git clone https://github.com/itsPreto/tangent.git
cd tangent

# Make the install script executable and run it
chmod +x install.sh
./install.sh
```

The script will:
- Check for and start required services (Ollama)
- Optionally install Whisper.cpp for voice features
- Set up the Python environment and dependencies
- Install and start the frontend
- Set up default models (all-minilm for embeddings, qwen2.5 for generation)

> For manual setup or troubleshooting, see the instructions below.

<div align="center">
 
### Manual Setup

</div>

Initialize a new venv (mac):
```bash
cd tangent-api
source my_env/bin/activate
```

Install Python packages:
```bash
pip install -r requirements.txt
```

<div align="center">
 
### Ollama Setup

</div>

Install Ollama
> find the appropriate image for your system here: https://ollama.com/

Verify installation
```bash
ollama --version
ollama version is 0.4.4
```

Download models (embedding + llm)
> if you choose to swap these pls see the `Configure local models` section below
```bash
ollama pull all-minilm
ollama pull qwen2.5-coder:7b
```

Start Ollama (download if u don't already have it)
```bash
ollama serve
```

<div align="center">
 
### Backend Setup

</div>

Configure local models:
```bash
cd src
export EMBEDDING_MODEL="custom-embedding-model"
export GENERATION_MODEL="custom-generation-model"
```

Then run with:
```bash
python3 app.py
```

Or all together:
```bash
python3 app.py --embedding-model "custom-embedding-model" --generation-model "custom-generation-model"
```

The backend will start up at `http://localhost:5001/api`.

<div align="center">
 
### Frontend Setup

</div>

```bash
cd simplified-ui
npm i
npm start
```
> if you get any missing pckg error just manually install it and restart the UI

<div align="center">
 
### API Endpoints

</div>

The backend exposes these main endpoints:
- `/api/process`: Send your chat data for processing
- `/api/process/status/<task_id>`: Check how your processing is going
- `/api/chats/save`: Save chat data
- `/api/chats/load/<chat_id>`: Load up specific chats
- `/api/topics`: Get all the generated topics

Feel free to contribute! Just submit a PR or open an issue for any cool features or fixes you've got in mind.

<div align="center">
 
> Licensed under Apache 2.0 - see the LICENSE file for the full details.

</div>

---

<div align="center">
⬇️ - JOIN OUR DISCORD SERVER - ⬇️
 
# [<img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6ca814282eca7172c6_icon_clyde_white_RGB.svg" width="20px" alt="Discord">](https://discord.gg/qHDavVmafF)
 
</div>
