from dataclasses import dataclass
from typing import Optional

@dataclass
class ProcessingTask:
    file_path: str
    status: str
    progress: float
    chat_type: str = ""
    data_dir: str = ""
    error: Optional[str] = None
    completed: bool = False