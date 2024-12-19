import time
from typing import Optional
from services.background_processor import BackgroundProcessor


class TaskManager:
    def __init__(self):
        self.background_processor = BackgroundProcessor()

    def start_task(self, file_path: str) -> str:
        task_id = str(time.time())
        try:
            self.background_processor.start_task(file_path)
            return task_id
        except Exception as e:
            print(f"Error starting task: {str(e)}")
            return ""

    def get_task_status(self, task_id: str) -> Optional[dict]:
        return self.background_processor.get_task_status(task_id)

    def process_queue(self):
        self.background_processor._process_queue()
