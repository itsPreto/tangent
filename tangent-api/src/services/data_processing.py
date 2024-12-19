import json
import os
import traceback
import numpy as np
import pandas as pd
from collections import defaultdict

from torch import pdist
import umap
from config import CLAUDE_DATA_DIR, CHATGPT_DATA_DIR
from typing import List, Tuple
from services.embedding import get_embeddings
from scipy.spatial.distance import squareform
from services.clustering import perform_clustering, generate_cluster_metadata


def save_state(state_data, month_year, data_dir):
    """Save a specific state with timestamp to the appropriate directory"""
    state_dir = os.path.join(data_dir, "states")
    os.makedirs(state_dir, exist_ok=True)

    state_file = os.path.join(state_dir, f"state_{month_year}.json")
    with open(state_file, "w") as f:
        json.dump(
            {
                "month_year": month_year,
                "points": state_data["points"],
                "clusters": state_data["clusters"],
                "titles": state_data["titles"],
                "topics": state_data["topics"],
                "total_conversations": state_data["total_conversations"],
            },
            f,
        )


def save_latest_state(update, data_dir):
    """Save the latest state files to the appropriate directory"""
    with open(os.path.join(data_dir, "embeddings_2d.json"), "w") as f:
        json.dump(update["points"], f)
    with open(os.path.join(data_dir, "clusters.json"), "w") as f:
        json.dump(update["clusters"], f)
    with open(os.path.join(data_dir, "topics.json"), "w") as f:
        json.dump(update["topics"], f)
    with open(os.path.join(data_dir, "chat_titles.json"), "w") as f:
        json.dump(update["titles"], f)


def process_claude_messages(data: List[dict]) -> List[dict]:
    messages = []
    for chat in data:
        chat_name = chat.get("name", "Unnamed Chat")
        chat_id = chat.get("uuid", "")
        chat_messages = chat.get("chat_messages", [])
        children_by_parent = defaultdict(list)
        messages_dict = {}

        for msg in chat_messages:
            msg_id = msg.get("uuid", "")
            parent_id = msg.get("parent", None)

            if msg_id:
                messages_dict[msg_id] = msg
                if parent_id:
                    children_by_parent[parent_id].append(msg_id)

        for msg_id, msg in messages_dict.items():
            timestamp = pd.to_datetime(msg.get("created_at"))
            if pd.isna(timestamp):
                continue

            parent_id = msg.get("parent")
            has_multiple_children = len(children_by_parent.get(msg_id, [])) > 1

            processed_msg = {
                "chat_name": chat_name,
                "chat_id": chat_id,
                "message_id": msg_id,
                "parent_message_id": parent_id,
                "branch_id": "0",  # Will be updated during tree traversal
                "sender": msg.get("sender", "unknown"),
                "timestamp": timestamp,
                "text": msg.get("text", ""),
                "is_branch_point": has_multiple_children,
            }

            messages.append(processed_msg)

    # Second pass: Assign proper branch IDs through tree traversal
    chats = defaultdict(list)
    for msg in messages:
        chats[msg["chat_name"]].append(msg)

    processed_messages = []
    for chat_messages in chats.values():
        roots = [msg for msg in chat_messages if not msg["parent_message_id"]]
        for root in roots:
            branch_queue = [(root, "0")]
            while branch_queue:
                current_msg, current_branch = branch_queue.pop(0)
                current_msg["branch_id"] = current_branch
                processed_messages.append(current_msg)

                children = [
                    msg
                    for msg in chat_messages
                    if msg["parent_message_id"] == current_msg["message_id"]
                ]

                if len(children) > 1:
                    for idx, child in enumerate(children):
                        branch_queue.append((child, f"{current_branch}.{idx}"))
                elif children:
                    branch_queue.append((children[0], current_branch))

    return processed_messages


def process_chatgpt_messages(data: List[dict]) -> List[dict]:
    messages = []
    for conversation in data:
        conv_title = conversation.get("title", "Untitled Chat")
        conv_id = conversation.get("id", "")

        if "mapping" in conversation:
            mapping = conversation["mapping"]
            for node_id, node_data in mapping.items():
                message_data = node_data.get("message", {})
                if not message_data:
                    continue

                created_at = message_data.get("create_time")
                try:
                    if isinstance(created_at, (int, float)):
                        timestamp = pd.to_datetime(created_at, unit="s")
                    else:
                        timestamp = pd.to_datetime(created_at)

                    if pd.isna(timestamp):
                        continue
                except (ValueError, TypeError):
                    continue

                content = message_data.get("content", {})
                if isinstance(content, dict) and "parts" in content:
                    text = " ".join(str(part) for part in content["parts"])
                else:
                    text = str(content)

                sender_role = message_data.get("author", {}).get("role")
                sender = "human" if sender_role == "user" else "assistant"

                messages.append(
                    {
                        "chat_name": conv_title,
                        "chat_id": conv_id,
                        "message_id": message_data.get("id", ""),
                        "parent_message_id": node_data.get("parent"),
                        "branch_id": "0",  # Default branch ID
                        "sender": sender,
                        "timestamp": timestamp,  # This will be a pandas datetime object
                        "text": text,
                    }
                )

    if messages:
        df = pd.DataFrame(messages)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp")
        messages = df.to_dict("records")

    return messages


def traverse_tree(
    node: dict,
    conv_title: str,
    conv_id: str,
    messages: List[dict],
    branch_id: str = "0",
):
    message_data = node["message"]
    if not message_data or "content" not in message_data:
        return
    content = message_data.get("content", {})
    if isinstance(content, dict) and "parts" in content:
        text = " ".join(str(part) for part in content["parts"])
    else:
        text = str(content)
    try:
        created_at = message_data.get("create_time")
        if isinstance(created_at, (int, float)):
            timestamp = pd.to_datetime(created_at, unit="s")
        else:
            timestamp = pd.to_datetime(created_at)
        if pd.isna(timestamp):
            return
        sender_role = message_data.get("author", {}).get("role")
        messages.append(
            {
                "chat_name": conv_title,
                "chat_id": conv_id,
                "message_id": message_data.get("id", ""),
                "parent_message_id": node["parent_id"],
                "branch_id": branch_id,
                "sender": "human" if sender_role == "user" else "assistant",
                "timestamp": timestamp,
                "text": text,
            }
        )
        if len(node["children"]) > 1:
            for idx, child in enumerate(node["children"]):
                traverse_tree(
                    child, conv_title, conv_id, messages, f"{branch_id}.{idx}"
                )
        elif node["children"]:
            traverse_tree(node["children"][0], conv_title, conv_id, messages, branch_id)
    except (ValueError, TypeError) as e:
        print(f"Error processing message: {e}")


def identify_struggle_messages(df: pd.DataFrame) -> pd.DataFrame:
    struggle_keywords = [
        "I'm struggling with",
        "I don't understand",
        "This is confusing",
        "I'm stuck on",
        "Need help with",
        "This doesn't make sense",
        "Can't figure out",
        "Having trouble with",
        "Not sure how to",
        "Difficult to",
        "Problem with",
        "Issue with",
        "Error when",
        "Failing to",
    ]
    pattern = "|".join(struggle_keywords)
    struggle_df = df[df["text"].str.contains(pattern, case=False, na=False)]
    return struggle_df


def detect_chat_type(file_path: str) -> Tuple[str, str]:
    """
    Detect whether the file contains Claude or ChatGPT chats and return the appropriate data directory
    """
    try:
        with open(file_path, "r") as f:
            data = json.load(f)

        # Check first item in the data
        if isinstance(data, list):
            first_item = data[0] if data else {}

            # ChatGPT format detection (has 'mapping' field)
            if isinstance(first_item, dict) and "mapping" in first_item:
                os.makedirs(CHATGPT_DATA_DIR, exist_ok=True)
                return "chatgpt", CHATGPT_DATA_DIR

            # Claude format detection (has 'chat_messages' field)
            elif isinstance(first_item, dict) and "chat_messages" in first_item:
                os.makedirs(CLAUDE_DATA_DIR, exist_ok=True)
                return "claude", CLAUDE_DATA_DIR

        raise ValueError("Unknown chat format")

    except Exception as e:
        raise Exception(f"Error detecting chat type: {str(e)}")


def process_data_by_month(df):
    """Process data month by month and yield updates."""
    try:
        # Ensure timestamp column is datetime
        df["timestamp"] = pd.to_datetime(df["timestamp"])

        # Remove any rows with invalid timestamps
        df = df.dropna(subset=["timestamp"])

        # Add month_year column with consistent format
        df["month_year"] = df["timestamp"].dt.strftime("%Y-%m")

        # Sort by month_year
        months = sorted(df["month_year"].unique())

        if not months:
            raise ValueError("No valid months found in data")

        accumulated_data = pd.DataFrame()

        print(f"Processing {len(months)} months of data...")
        for month in months:
            try:
                # Get data for current month and all previous months
                month_mask = df["month_year"] <= month
                accumulated_data = df[month_mask].copy()

                # Group messages by chat and branch for this time period
                chat_messages = accumulated_data.groupby(["chat_name", "branch_id"])[
                    "text"
                ].agg(list)
                chat_titles = [
                    "{} (Branch {})".format(chat_name, branch_id)
                    for chat_name, branch_id in chat_messages.index
                ]

                if len(chat_titles) < 2:
                    print(f"Skipping month {month} - insufficient data points")
                    continue

                print(f"Processing month {month} with {len(chat_titles)} chats...")
                # Process the month's data and yield update
                update_data = process_single_month(chat_titles, month)
                if update_data:
                    yield update_data

            except Exception as e:
                print(f"Error processing month {month}: {str(e)}")
                traceback.print_exc()
                continue

    except Exception as e:
        print(f"Error in process_data_by_month: {str(e)}")
        traceback.print_exc()
        raise Exception(f"Error in process_data_by_month: {str(e)}")


def process_single_month(chat_titles, month):
    try:
        print(f"Starting processing for month {month} with {len(chat_titles)} chats")

        # Get embeddings
        print(f"Fetching embeddings for {len(chat_titles)} titles...")
        embeddings = get_embeddings(chat_titles)
        if embeddings is None:
            print("Embeddings retrieval failed.")
            return None
        print("Embeddings retrieved successfully.")

        embeddings_array = np.array(embeddings)

        # Perform t-SNE
        print("Performing UMAP...")
        reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, random_state=42)

        embeddings_2d = reducer.fit_transform(embeddings_array)
        # Calculate distances and perform clustering
        distances = pdist(embeddings_array, metric="cosine")
        distance_matrix = squareform(distances)

        clusters = perform_clustering(distance_matrix, len(chat_titles))

        # Generate topics and metadata
        cluster_metadata = generate_cluster_metadata(
            clusters, chat_titles, distance_matrix
        )

        return {
            "month_year": month,
            "points": embeddings_2d.tolist(),
            "clusters": clusters.tolist(),
            "titles": chat_titles,
            "topics": cluster_metadata,
            "total_conversations": len(chat_titles),
        }

    except Exception as e:
        print(f"Error processing single month: {str(e)}")
        return None


def analyze_branches(messages):
    """
    Enhanced branch detection that specifically looks for edited message branches
    """
    chats_with_branches = {}

    # First pass: Group messages and build relationships
    for msg in messages:
        chat_name = msg.get("chat_name")
        if not chat_name:
            continue

        if chat_name not in chats_with_branches:
            chats_with_branches[chat_name] = {
                "messages": [],
                "message_ids": set(),
                "parent_children": defaultdict(list),
                "edit_branches": [],  # New: Track specifically edited message branches
            }

        chat_data = chats_with_branches[chat_name]
        msg_id = msg.get("message_id")
        parent_id = msg.get("parent_message_id")
        timestamp = pd.to_datetime(msg.get("timestamp"))

        # Store message with additional metadata
        msg_data = {
            **msg,
            "timestamp_obj": timestamp,
            "children": [],
            "is_branch_point": False,
        }

        chat_data["messages"].append(msg_data)

        if msg_id:
            chat_data["message_ids"].add(msg_id)
            if parent_id:
                chat_data["parent_children"][parent_id].append(msg_data)

    # Second pass: Identify edit branches
    for chat_name, chat_data in chats_with_branches.items():
        for parent_id, children in chat_data["parent_children"].items():
            if len(children) > 1:
                # Sort children by timestamp
                children.sort(key=lambda x: x["timestamp_obj"])

                # Check for potential edit branches
                time_gaps = []
                for i in range(1, len(children)):
                    time_diff = (
                        children[i]["timestamp_obj"] - children[i - 1]["timestamp_obj"]
                    ).total_seconds()
                    time_gaps.append(time_diff)

                # If there are significant time gaps between children, likely edit branches
                for i, gap in enumerate(time_gaps):
                    if gap > 60:  # More than 1 minute gap suggests an edit
                        branch_data = {
                            "parent_message": parent_id,
                            "original_branch": children[i],
                            "edit_branch": children[i + 1],
                            "time_gap": gap,
                            "branch_messages": [],
                        }

                        # Collect all subsequent messages in this branch
                        def collect_branch_messages(msg):
                            branch_data["branch_messages"].append(msg)
                            msg_id = msg.get("message_id")
                            if msg_id in chat_data["parent_children"]:
                                for child in chat_data["parent_children"][msg_id]:
                                    collect_branch_messages(child)

                        collect_branch_messages(children[i + 1])
                        chat_data["edit_branches"].append(branch_data)

    return chats_with_branches
