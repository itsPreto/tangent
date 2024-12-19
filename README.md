<div align="center">
  <img src="https://github.com/user-attachments/assets/cd8a656e-f643-439c-a64a-694d521c43fe" alt="tangent" style="border-radius: 10px">

 -> [<img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6ca814282eca7172c6_icon_clyde_white_RGB.svg" width="20px" alt="Discord">](https://discord.gg/Y6tqtCr4) <-


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


## Prerequisites

</div>


* [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`git clone https://github.com/ggerganov/whisper.cpp` -> `cd whisper.cpp` -> `sh ./models/download-ggml-model.sh base.en` -> `make` -> `make server && ./server`)
* [Ollama](https://ollama.com/) (project was kinda hardcoded for ollama but can be generalized to accept diff backends)
* Exported Archive Data (from Claude or ChatGPT).

<div align="center">



</div>

<div align="center">

### Environment Setup

</div>

Initialize a new venv (mac):
```bash
cd 
source my_env/bin/activate
```

Install Python packages:
```bash
pip install flask flask-cors scikit-learn numpy pandas hdbscan umap-learn requests
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
cd simplified-ab
export EMBEDDING_MODEL="custom-embedding-model"
export GENERATION_MODEL="custom-generation-model"
```

Then run with:
```bash
python3 tsne.py
```

Or all together:
```bash
python3 tsne.py --embedding-model "custom-embedding-model" --generation-model "custom-generation-model"
```

<div align="center">

  ### Frontend Setup

</div>

```bash
cd simplified-ui
npm i
npm start
```

> if you get any missing pckg error just manually install it and restart the UI
