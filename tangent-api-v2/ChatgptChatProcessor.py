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

    def detect_chat_type(self, file_path: str) -> str:
        """
        Detect whether the file contains Claude or ChatGPT chats.
        """
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)

            # Check first item in the data
            if isinstance(data, list):
                first_item = data[0] if data else {}

                # ChatGPT format detection (has 'mapping' field)
                if isinstance(first_item, dict) and "mapping" in first_item:
                    return "chatgpt"

                # Claude format detection (has 'chat_messages' field)
                elif isinstance(first_item, dict) and "chat_messages" in first_item:
                    return "claude"

            raise ValueError("Unknown chat format")

        except Exception as e:
            raise Exception(f"Error detecting chat type: {str(e)}")
        

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

        chat_type = self.detect_chat_type(file_path)
        if chat_type != "chatgpt":
            raise ValueError(f"Expected ChatGPT data, but detected: {chat_type}")

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
                        "content": {"parts": ["How are you?"]},
                    },
                    "parent": "msg2",
                    "children": [],
                },
                 "msg4": {
                    "message": {
                        "id": "msg4",
                        "author": {"role": "user"},
                        "create_time": 1678886500,  # earlier timestamp! to test sorting
                        "content": {"parts": ["Branching question?"]},
                    },
                    "parent": "msg2",
                    "children": [],
                },
            },
        }
    ]

    with open("dummy_chatgpt.json", "w") as f:
        json.dump(dummy_data, f, indent=2)
    # --- End of creating dummy data

    processor = ChatGPTDataProcessor()
    try:
      processed_messages = processor.process_data("dummy_chatgpt.json")
      for msg in processed_messages:
        print(
            f"Chat: {msg['chat_name']}, Msg ID: {msg['message_id']}, Parent: {msg['parent_message_id']}, Branch: {msg['branch_id']}, Sender: {msg['sender']}, Time: {msg['timestamp']}, Text: {msg['text']}"
      )
    except ValueError as ve:
      print(ve)
    finally:
      os.remove("dummy_chatgpt.json")