import json
import os
import re
import time
import traceback
from typing import Dict, List, Tuple, Optional

import pandas as pd


class ChatGPTDataProcessor:
    def __init__(self):
        pass

    def process_chatgpt_messages(self, data: list) -> List[Dict]:
        """Process ChatGPT format messages and reconstruct conversation tree."""
        messages = []
        for conversation in data:
            conv_title = conversation.get('title', 'Untitled Chat')
            conv_id = conversation.get('id', '')

            if "mapping" in conversation:
                mapping = conversation["mapping"]
                for node_id, node_data in mapping.items():
                    message_data = node_data.get('message', {})
                    if not message_data:
                        continue

                    created_at = message_data.get("create_time")
                    try:
                        if isinstance(created_at, (int, float)):
                            timestamp = pd.to_datetime(created_at, unit='s')
                        else:
                            timestamp = pd.to_datetime(created_at)  # Let pandas try to parse

                        if pd.isna(timestamp):
                            continue
                    except (ValueError, TypeError):
                        continue #invalid timestamp


                    content = message_data.get("content", {})
                    if isinstance(content, dict) and "parts" in content:
                        text = " ".join(str(part) for part in content["parts"])
                    else:
                        text = str(content)

                    sender_role = message_data.get("author", {}).get("role")
                    sender = "human" if sender_role == "user" else "assistant"

                    messages.append({
                        "chat_name": conv_title,
                        "chat_id": conv_id,
                        "message_id": message_data.get("id", ""),
                        "parent_message_id": node_data.get('parent'),
                        "branch_id": "0",  # Default branch ID, updated later
                        "sender": sender,
                        "timestamp": timestamp.isoformat(),  # Store as ISO string
                        "text": text
                    })

        # Sort by timestamp *after* flattening
        if messages:
            messages.sort(key=lambda x: pd.to_datetime(x['timestamp']))

        return messages

    def establish_branching(self, messages: List[Dict]) -> List[Dict]:
        """
        Establishes the branching structure by identifying when a parent has multiple children
        and assigning appropriate branch IDs.
        """
        # Create a map of parent IDs to their child messages
        parent_children = {}
        for msg in messages:
            parent_id = msg.get('parent_message_id')
            if parent_id:
                if parent_id not in parent_children:
                    parent_children[parent_id] = []
                parent_children[parent_id].append(msg)
        
        # For each parent, if it has multiple children, assign branch IDs chronologically
        for parent_id, children in parent_children.items():
            if len(children) > 1:
                # Sort children by timestamp
                children.sort(key=lambda x: pd.to_datetime(x['timestamp']))
                # Assign branch IDs starting from 1
                for i, child in enumerate(children):
                    child['branch_id'] = str(i + 1)
            else:
                # Single child gets branch_id 0
                children[0]['branch_id'] = "0"
                
        # Messages without parents get branch_id 0
        for msg in messages:
            if 'branch_id' not in msg:
                msg['branch_id'] = "0"
                
        return messages

    def process_data(self, file_path: str):
        """
        Load, detect, and process data, handling branching. This is the main entry point.
        """

        with open(file_path, 'r') as f:
            data = json.load(f)

        messages = self.process_chatgpt_messages(data)
        messages_with_branches = self.establish_branching(messages)
        
        return messages_with_branches


# Example Usage (assuming this class is in a file called data_processor.py)
if __name__ == '__main__':
    # ---  Create a dummy chatgpt.json file for testing ---
    dummy_data = [
        {
            "title": "Conversation 1",
            "id": "conv1",
            "mapping": {
                "msg1": {
                    "message": {
                        "id": "msg1",
                        "author": {"role": "user"},
                        "create_time": 1678886400,  # Example UNIX timestamp
                        "content": {"parts": ["Hello"]},
                    },
                    "parent": None,
                    "children": ["msg2"],
                },
                "msg2": {
                    "message": {
                        "id": "msg2",
                        "author": {"role": "assistant"},
                        "create_time": 1678886460,
                        "content": {"parts": ["Hi there!"]},
                    },
                    "parent": "msg1",
                    "children": ["msg3", "msg4"],
                },
                "msg3": {
                    "message": {
                        "id": "msg3",
                        "author": {"role": "user"},
                        "create_time": 1678886520,
                        "content": {"parts": ["Can you help me with Python?"]},
                    },
                    "parent": "msg2",
                    "children": ["msg5"],
                },
                "msg4": {
                    "message": {
                        "id": "msg4",
                        "author": {"role": "user"},
                        "create_time": 1678886580,
                        "content": {"parts": ["Actually, tell me about JavaScript instead."]},
                    },
                    "parent": "msg2",
                    "children": ["msg6"],
                },
                "msg5": {
                    "message": {
                        "id": "msg5",
                        "author": {"role": "assistant"},
                        "create_time": 1678886640,
                        "content": {"parts": ["Sure! Python is a versatile programming language..."]},
                    },
                    "parent": "msg3",
                    "children": [],
                },
                "msg6": {
                    "message": {
                        "id": "msg6",
                        "author": {"role": "assistant"},
                        "create_time": 1678886700,
                        "content": {"parts": ["JavaScript is great for web development..."]},
                    },
                    "parent": "msg4",
                    "children": [],
                },
            },
        }
    ]

    with open("chatgpt_conversations.json", "w") as f:
        json.dump(dummy_data, f, indent=2)

    # Initialize processor and process data
    processor = ChatGPTDataProcessor()
    result = processor.process_data("chatgpt_conversations.json")

    print("Processing Results:")
    for msg in result:
        print(f"Branch {msg['branch_id']}: {msg['sender']} - {msg['text'][:50]}...")

    print("\nBranching Structure:")
    # Group by branch for better visualization
    branches = {}
    for msg in result:
        branch_id = msg['branch_id']
        if branch_id not in branches:
            branches[branch_id] = []
        branches[branch_id].append(msg)

    for branch_id, msgs in branches.items():
        print(f"\nBranch {branch_id}:")
        for msg in msgs:
            print(f"  {msg['sender']}: {msg['text']}")