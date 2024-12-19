import queue
import threading
import time
import json
import os
from typing import Dict, Optional, Tuple

import pandas as pd
from models import ProcessingTask
import traceback
from config import CHATGPT_DATA_DIR, CLAUDE_DATA_DIR
from services.data_processing import process_chatgpt_messages, process_claude_messages, save_state, save_latest_state, process_data_by_month


class BackgroundProcessor:
    def __init__(self):
        self.tasks: Dict[str, ProcessingTask] = {}
        self.task_queue = queue.Queue()
        self.processing_thread = threading.Thread(
            target=self._process_queue, daemon=True
        )
        self.processing_thread.start()

    def start_task(self, file_path: str) -> str:
        task_id = str(time.time())
        try:
            chat_type, data_dir = detect_chat_type(file_path)
            task = ProcessingTask(
                file_path=file_path,
                status="queued",
                progress=0.0,
                chat_type=chat_type,
                data_dir=data_dir,
            )
            self.tasks[task_id] = task
            self.task_queue.put((task_id, task))
            return task_id
        except Exception as e:
            raise Exception(f"Error starting task: {str(e)}")

    def get_task_status(self, task_id: str) -> Optional[ProcessingTask]:
        return self.tasks.get(task_id)

    def _process_queue(self):
        while True:
            try:
                task_id, task = self.task_queue.get()
                if task_id not in self.tasks:
                    continue

                task.status = "processing"
                try:
                    # Load and process the data based on chat type
                    with open(task.file_path, "r") as f:
                        data = json.load(f)

                    # Process messages based on chat type
                    messages = (
                        process_chatgpt_messages(data)
                        if task.chat_type == "chatgpt"
                        else process_claude_messages(data)
                    )

                    # Create DataFrame and process month by month
                    df = pd.DataFrame(messages)
                    df["month_year"] = df["timestamp"].dt.strftime("%Y-%m")

                    total_months = len(df["month_year"].unique())
                    current_month = 0

                    for update in process_data_by_month(df):
                        current_month += 1
                        task.progress = (current_month / total_months) * 100

                        # Save state and files
                        save_state(update, update["month_year"], task.data_dir)

                        # Save monthly messages
                        month_messages = df[df["month_year"] <= update["month_year"]]
                        messages_json = month_messages.to_json(
                            orient="records", date_format="iso"
                        )

                        # Save to appropriate directory
                        states_dir = os.path.join(task.data_dir, "states")
                        os.makedirs(states_dir, exist_ok=True)

                        with open(
                            os.path.join(
                                states_dir, f'messages_{update["month_year"]}.json'
                            ),
                            "w",
                        ) as f:
                            f.write(messages_json)

                        # Update latest state files
                        save_latest_state(update, task.data_dir)

                    task.completed = True
                    task.status = "completed"

                except Exception as e:
                    task.error = str(e)
                    task.status = "failed"
                    print(f"Processing error: {str(e)}")
                    traceback.print_exc()

            except Exception as e:
                print(f"Error in processing thread: {str(e)}")
                traceback.print_exc()
                continue

            finally:
                self.task_queue.task_done()

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
