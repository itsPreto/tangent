from datetime import datetime
import json
import requests
import os
from pathlib import Path
import re
import traceback
from flask import Blueprint, request, jsonify
import numpy as np
import pandas as pd
from torch import cosine_similarity
from services.embedding import get_embeddings
from services.background_processor import BackgroundProcessor
from services.code_interpreter import CodeInterpreter 
from services.data_processing import analyze_branches
from utils import load_visualization_data
from config import CLAUDE_DATA_DIR, CHATGPT_DATA_DIR, BASE_DATA_DIR
from services.topic_generation import generate_topic_for_cluster
from shared_data import models_data

api_bp = Blueprint("api", __name__)
background_processor = BackgroundProcessor()
code_interpreter = CodeInterpreter()

@api_bp.route("/process", methods=["POST"])
def process_data():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if not file.filename.endswith(".json"):
            return jsonify({"error": "Invalid file type"}), 400

        # Save uploaded file
        data_dir = Path("./unprocessed")
        data_dir.mkdir(exist_ok=True)
        file_path = data_dir / "chat_data.json"
        file.save(file_path)

        # Start background processing
        task_id = background_processor.start_task(str(file_path))

        return jsonify({"task_id": task_id, "message": "Processing started"}), 202

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/process/status/<task_id>", methods=["GET"])
def check_task_status(task_id):
    status = background_processor.get_task_status(task_id)
    if status:
        return jsonify(
            {
                "status": status.status,
                "progress": status.progress,
                "error": status.error,
                "completed": status.completed,
            }
        ), 200
    return jsonify({"error": "Task not found"}), 404


@api_bp.route("/get-reflections", methods=["POST"])
def get_reflections():
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        data = request.json
        current_context = data.get("context", "")

        if not current_context:
            return jsonify({"reflections": []})

        # Generate embedding for current context

        context_embedding = np.array(get_embeddings([current_context])[0]).flatten()

        # Load reflections and embeddings
        reflections_file = os.path.join(data_dir, "reflections.json")
        if not os.path.exists(reflections_file):
            return jsonify({"reflections": []})

        with open(reflections_file, "r") as f:
            reflections_data = json.load(f)

        # Compute similarity scores
        similarities = []
        for cluster_id, data in reflections_data.items():
            reflection_embedding = data["embedding"]
            similarity = np.dot(context_embedding, reflection_embedding) / (
                np.linalg.norm(context_embedding) * np.linalg.norm(reflection_embedding)
            )
            similarities.append((similarity, data["reflection"]))

        # Sort and filter reflections
        similarities.sort(reverse=True)
        top_reflections = [ref for sim, ref in similarities[:3] if sim > 0.5]

        return jsonify({"reflections": top_reflections})

    except Exception as e:
        print(f"Error retrieving reflections: {str(e)}")
        return jsonify({"reflections": []})


@api_bp.route("/topics", methods=["GET"])
def get_topics():
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        with open(os.path.join(data_dir, "topics.json"), "r") as f:
            topics = json.load(f)
        return jsonify(topics)
    except Exception as e:
        print(f"Error getting topics: {str(e)}")
        return jsonify({"error": str(e)}), 500


@api_bp.route("/models/library", methods=["GET"])
def get_library_models():
    if not models_data:
        return jsonify({"error": "Models data not yet loaded"}), 503
    return jsonify({"models": models_data})


@api_bp.route("/embeddings", methods=["POST"])
def embeddings():
    data = request.json
    texts = data.get("texts", [])
    embeddings = get_embeddings(texts)
    return jsonify({"embeddings": embeddings}), 200


@api_bp.route("/visualization", methods=["GET"])
def get_visualization_data():
    chat_type = request.args.get("type", "claude")  # Default to claude if not specified
    data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

    try:
        data = load_visualization_data(data_dir)
        if not data["points"] or not data["clusters"] or not data["titles"]:
            return jsonify([]), 200

        return jsonify(
            {
                "points": data["points"],
                "clusters": data["clusters"],
                "titles": data["titles"],
                "topics": data["topics"],
                "chats_with_reflections": data["chats_with_reflections"],
            }
        )

    except Exception as e:
        print(f"Error getting visualization data: {str(e)}")
        return jsonify({"error": str(e)}), 500


@api_bp.route("/content/identify-messages", methods=["POST"])
def identify_relevant_messages():
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        topic_id = request.json["topicId"]

        # Load necessary data
        with open(os.path.join(data_dir, "messages.json"), "r") as f:
            all_messages = json.load(f)

        with open(os.path.join(data_dir, "chat_titles.json"), "r") as f:
            chat_titles = json.load(f)

        with open(os.path.join(data_dir, "clusters.json"), "r") as f:
            clusters = json.load(f)

        # Get messages from the selected topic
        topic_messages = []
        for message in all_messages:
            chat_index = chat_titles.index(message["chat_name"])
            if clusters[chat_index] == int(topic_id):
                topic_messages.append(message)

        # Process messages
        message_texts = [msg["text"] for msg in topic_messages]
        embeddings = get_embeddings(message_texts)

        # Calculate scores
        centroid = np.mean(embeddings, axis=0)
        similarities = cosine_similarity([centroid], embeddings)[0]
        lengths = np.array([len(msg["text"]) for msg in topic_messages])
        length_scores = lengths / np.max(lengths) if lengths.size > 0 else np.array([])
        final_scores = 0.6 * similarities + 0.4 * length_scores

        # Get top messages
        top_indices = np.argsort(final_scores)[-20:][::-1]
        top_messages = [topic_messages[i] for i in top_indices]

        return jsonify(top_messages)

    except Exception as e:
        print(f"Error identifying messages: {str(e)}")
        return jsonify({"error": str(e)}), 500


@api_bp.route("/chats/save", methods=["POST"])
def save_chat():
    try:
        data = request.json
        chat_id = data.get("chatId", str(datetime.now().timestamp()))
        chat_data = {
            "id": chat_id,
            "nodes": data.get("nodes", []),
            "lastModified": datetime.now().isoformat(),
            "title": data.get("title", "Untitled Chat"),
            "metadata": data.get("metadata", {}),
        }
        # Create chats directory if it doesn't exist
        chats_dir = os.path.join(BASE_DATA_DIR, "chats")
        os.makedirs(chats_dir, exist_ok=True)
        # Save chat data
        chat_file = os.path.join(chats_dir, f"{chat_id}.json")
        with open(chat_file, "w") as f:
            json.dump(chat_data, f)
        return jsonify(
            {"success": True, "chatId": chat_id, "message": "Chat saved successfully"}
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@api_bp.route("/chats/load/<chat_id>", methods=["GET"])
def load_chat(chat_id):
    try:
        chat_file = os.path.join(BASE_DATA_DIR, "chats", f"{chat_id}.json")
        if not os.path.exists(chat_file):
            return jsonify({"success": False, "error": "Chat not found"}), 404
        with open(chat_file, "r") as f:
            chat_data = json.load(f)
        return jsonify({"success": True, "data": chat_data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@api_bp.route("/chats/list", methods=["GET"])
def list_chats():
    try:
        chats_dir = os.path.join(BASE_DATA_DIR, "chats")
        os.makedirs(chats_dir, exist_ok=True)
        chats = []
        for filename in os.listdir(chats_dir):
            if filename.endswith(".json"):
                with open(os.path.join(chats_dir, filename), "r") as f:
                    chat_data = json.load(f)
                chats.append(
                    {
                        "id": chat_data["id"],
                        "title": chat_data.get("title", "Untitled Chat"),
                        "lastModified": chat_data.get("lastModified"),
                        "metadata": chat_data.get("metadata", {}),
                    }
                )
        return jsonify(
            {
                "success": True,
                "chats": sorted(chats, key=lambda x: x["lastModified"], reverse=True),
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@api_bp.route("/chats/delete/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    try:
        chat_file = os.path.join(BASE_DATA_DIR, "chats", f"{chat_id}.json")
        if not os.path.exists(chat_file):
            return jsonify({"success": False, "error": "Chat not found"}), 404
        os.remove(chat_file)
        return jsonify({"success": True, "message": "Chat deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@api_bp.route("/messages/<path:chat_name>", methods=["GET"])
def get_chat_messages(chat_name):
    """Get messages for a specific chat and branch."""
    try:
        chat_type = request.args.get("type", "chatgpt")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR
        states_dir = os.path.join(data_dir, "states")

        # Get the latest messages file
        message_files = [f for f in os.listdir(states_dir) if f.startswith("messages_")]
        if not message_files:
            return jsonify({"error": "No message data found"}), 404

        latest_file = sorted(message_files)[-1]
        messages_path = os.path.join(states_dir, latest_file)

        print(f"Loading messages from: {messages_path}")
        with open(messages_path, "r") as f:
            all_messages = json.load(f)

        # Parse chat_name to extract base name and branch_id
        match = re.match(r"^(.*) \(Branch (\d+)\)$", chat_name)
        if match:
            base_chat_name = match.group(1)
            branch_id = match.group(2)
        else:
            base_chat_name = chat_name
            branch_id = "0"  # Default branch ID if none is specified

        # Filter messages based on base_chat_name and branch_id
        chat_messages = [
            msg
            for msg in all_messages
            if msg.get("chat_name") == base_chat_name
            and msg.get("branch_id", "0") == branch_id
        ]

        if not chat_messages:
            return jsonify({"error": f"No messages found for chat: {chat_name}"}), 404

        # Sort messages by timestamp
        chat_messages.sort(key=lambda x: pd.to_datetime(x.get("timestamp", "0")))

        return jsonify({"messages": chat_messages})

    except Exception as e:
        print(f"Error retrieving messages: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@api_bp.route("/messages_all/<path:chat_name>", methods=["GET"])
def get_all_chat_messages(chat_name):
    try:
        chat_type = request.args.get("type", "chatgpt")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR
        states_dir = os.path.join(data_dir, "states")

        # Get latest messages file
        message_files = [f for f in os.listdir(states_dir) if f.startswith("messages_")]
        if not message_files:
            return jsonify({"error": "No message data found"}), 404

        latest_file = sorted(message_files)[-1]
        messages_path = os.path.join(states_dir, latest_file)

        print(f"Loading messages from: {messages_path}")
        with open(messages_path, "r") as f:
            all_messages = json.load(f)

        # **Parse chat_name to extract base name**
        match = re.match(r"^(.*) \(Branch \d+\)$", chat_name)
        if match:
            base_chat_name = match.group(1)
        else:
            base_chat_name = chat_name

        # **Filter messages for the base chat name**
        chat_messages = [
            msg for msg in all_messages if msg.get("chat_name") == base_chat_name
        ]

        if not chat_messages:
            return jsonify({"error": f"No messages found for chat: {chat_name}"}), 404

        # Group messages by branch_id
        from collections import defaultdict

        branches = defaultdict(list)
        for msg in chat_messages:
            branch_id = msg.get("branch_id", "0")
            branches[branch_id].append(msg)

        # Sort messages within each branch
        for branch_msgs in branches.values():
            branch_msgs.sort(key=lambda x: pd.to_datetime(x.get("timestamp", "0")))

        return jsonify({"branches": branches})

    except Exception as e:
        print(f"Error retrieving messages: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@api_bp.route("/messages/branched", methods=["GET"])
def get_branched_messages():
    try:
        print("\n=== Starting Enhanced Branch Analysis ===")

        chat_type = request.args.get("type", "chatgpt")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR
        states_dir = os.path.join(data_dir, "states")

        # Load latest messages
        message_files = [f for f in os.listdir(states_dir) if f.startswith("messages_")]
        if not message_files:
            return jsonify({"error": "No message data found"}), 404

        latest_file = sorted(message_files)[-1]
        messages_path = os.path.join(states_dir, latest_file)

        print(f"\nLoading messages from: {messages_path}")
        with open(messages_path, "r") as f:
            all_messages = json.load(f)

        print(f"\nAnalyzing {len(all_messages)} messages for branches")

        # Perform enhanced branch analysis
        branched_data = analyze_branches(all_messages)

        # Transform the analysis into the API response format
        response_data = {
            "branched_chats": {},
            "stats": {
                "total_chats_analyzed": len(branched_data),
                "total_branched_chats": 0,
                "total_messages_processed": len(all_messages),
                "branching_structure": {},
                "edit_branches": {},
            },
        }

        # Process each chat's branch data
        for chat_name, chat_data in branched_data.items():
            edit_branches = chat_data.get("edit_branches", [])
            if edit_branches:
                chat_branches = {"main_branch": [], "branches": {}, "edit_points": []}

                # Process each edit branch
                for idx, branch in enumerate(edit_branches):
                    branch_id = f"branch_{idx + 1}"

                    # Find the parent message in the main conversation
                    parent_message = next(
                        (
                            msg
                            for msg in chat_data["messages"]
                            if msg.get("message_id") == branch["parent_message"]
                        ),
                        None,
                    )

                    if parent_message:
                        # Add parent to main branch if not already there
                        if parent_message not in chat_branches["main_branch"]:
                            chat_branches["main_branch"].append(parent_message)

                        # Add branch information
                        chat_branches["branches"][branch_id] = {
                            "parent_message": parent_message,
                            "branch_start": branch["edit_branch"],
                            "branch_messages": branch["branch_messages"],
                            "branch_length": len(branch["branch_messages"]),
                            "time_gap": branch["time_gap"],
                            "is_edit_branch": True,
                        }

                        # Record edit point metadata
                        chat_branches["edit_points"].append(
                            {
                                "parent_message_id": branch["parent_message"],
                                "original_message": branch["original_branch"],
                                "edit_message": branch["edit_branch"],
                                "time_gap": branch["time_gap"],
                            }
                        )

                if chat_branches["branches"]:
                    response_data["branched_chats"][chat_name] = chat_branches
                    response_data["stats"]["total_branched_chats"] += 1

                    # Add detailed statistics
                    response_data["stats"]["branching_structure"][chat_name] = {
                        "total_branches": len(chat_branches["branches"]),
                        "total_edit_points": len(chat_branches["edit_points"]),
                        "branch_lengths": [
                            data["branch_length"]
                            for data in chat_branches["branches"].values()
                        ],
                        "average_time_gap": np.mean(
                            [
                                branch["time_gap"]
                                for branch in chat_branches["branches"].values()
                            ]
                        ),
                    }

                    response_data["stats"]["edit_branches"][chat_name] = {
                        "count": len(edit_branches),
                        "average_branch_length": np.mean(
                            [len(branch["branch_messages"]) for branch in edit_branches]
                        ),
                        "time_gaps": [branch["time_gap"] for branch in edit_branches],
                    }

        print("\n=== Branch Analysis Complete ===")
        print(f"Total chats analyzed: {response_data['stats']['total_chats_analyzed']}")
        print(
            f"Chats with edit branches: {response_data['stats']['total_branched_chats']}"
        )
        print(
            f"Total messages processed: {response_data['stats']['total_messages_processed']}"
        )

        return jsonify(response_data)

    except Exception as e:
        error_msg = f"Error processing branched messages: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        return jsonify({"error": error_msg}), 500


@api_bp.route("/states", methods=["GET"])
def get_available_states():
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        state_dir = os.path.join(data_dir, "states")
        if not os.path.exists(state_dir):
            return jsonify({"states": []})

        states = []
        for file in os.listdir(state_dir):
            if file.startswith("state_") and file.endswith(".json"):
                with open(os.path.join(state_dir, file), "r") as f:
                    state_data = json.load(f)
                    states.append(
                        {
                            "month_year": state_data["month_year"],
                            "total_conversations": state_data["total_conversations"],
                        }
                    )

        return jsonify({"states": sorted(states, key=lambda x: x["month_year"])})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/state/<month_year>", methods=["GET"])
def get_state(month_year):
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        state_file = os.path.join(data_dir, "states", f"state_{month_year}.json")
        if not os.path.exists(state_file):
            return jsonify({"error": "State not found"}), 404

        with open(state_file, "r") as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/topics/generate", methods=["POST"])
def generate_topic():
    try:
        data = request.json
        titles = data.get("titles", [])
        if not titles:
            return jsonify({"error": "No titles provided"}), 400

        topic = generate_topic_for_cluster(titles)
        return jsonify({"topic": topic})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route("/api/generate", methods=["POST"])
def generate():
    try:
        data = request.json
        response = requests.post(
            'http://localhost:11434/api/generate',
            headers={'Content-Type': 'application/json'},
            json=data,
            stream=True
        )
        
        # Extract complete response from streaming
        full_response = ''
        for line in response.iter_lines():
            if line:
                try:
                    chunk = json.loads(line.decode('utf-8'))
                    if 'response' in chunk:
                        full_response += chunk['response']
                except json.JSONDecodeError:
                    continue

        # Execute any code blocks
        execution_results = code_interpreter.handle_response(full_response)
        
        return jsonify({
            'response': full_response,
            'code_execution': execution_results
        })
            
    except Exception as e:
        print(f"Error in generate endpoint: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
def register_routes(app):
    app.register_blueprint(api_bp, url_prefix="/api")
