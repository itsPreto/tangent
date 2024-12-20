# code_interpreter.py
import docker
import re
from typing import Dict, List
import tempfile
import time
import json
import traceback
from pathlib import Path

class CodeInterpreter:
    def __init__(
        self,
        image_name: str = "python:3.9-slim",
        timeout: int = 30,
        max_memory: str = "512m",
        cpu_quota: int = 50000,
    ):
        self.client = docker.from_env()
        self.image_name = image_name
        self.timeout = timeout
        self.max_memory = max_memory
        self.cpu_quota = cpu_quota
        
        try:
            self.client.images.get(image_name)
        except docker.errors.ImageNotFound:
            print(f"Pulling {image_name} image...")
            self.client.images.pull(image_name)

    def extract_code_blocks(self, text: str) -> List[str]:
        pattern = r"```(?:python)?\n(.*?)```"
        matches = re.finditer(pattern, text, re.DOTALL)
        return [match.group(1).strip() for match in matches]

    def execute_code(self, code: str) -> Dict[str, str]:
        with tempfile.TemporaryDirectory() as temp_dir:
            script_path = Path(temp_dir) / "script.py"
            script_path.write_text(f"""
import sys
import io
import traceback
import json
from contextlib import redirect_stdout, redirect_stderr

output_buffer = io.StringIO()
error_buffer = io.StringIO()

try:
    with redirect_stdout(output_buffer), redirect_stderr(error_buffer):
        exec({repr(code)})
except Exception as e:
    print(traceback.format_exc(), file=error_buffer)

result = {{
    'stdout': output_buffer.getvalue(),
    'stderr': error_buffer.getvalue()
}}

print(json.dumps(result))
""")
            
            container = self.client.containers.create(
                self.image_name,
                command=["python", "/code/script.py"],
                volumes={
                    str(temp_dir): {
                        'bind': '/code',
                        'mode': 'ro'
                    }
                },
                mem_limit=self.max_memory,
                cpu_period=100000,
                cpu_quota=self.cpu_quota,
                network_mode="none",
                detach=True,
                security_opt=["no-new-privileges"],
                cap_drop=["ALL"],
            )
            
            try:
                start_time = time.time()
                container.start()
                
                while container.status != "exited":
                    container.reload()
                    if time.time() - start_time > self.timeout:
                        raise TimeoutError(f"Code execution timed out after {self.timeout} seconds")
                    time.sleep(0.1)
                
                logs = container.logs(stdout=True, stderr=True).decode('utf-8')
                
                try:
                    result = json.loads(logs)
                    return result
                except json.JSONDecodeError:
                    return {
                        'stdout': '',
                        'stderr': f'Failed to parse output: {logs}'
                    }
                    
            finally:
                try:
                    container.remove(force=True)
                except docker.errors.APIError:
                    pass

    def handle_response(self, response_text: str) -> List[Dict[str, str]]:
        code_blocks = self.extract_code_blocks(response_text)
        results = []
        
        for code in code_blocks:
            try:
                result = self.execute_code(code)
                results.append({
                    'code': code,
                    **result
                })
            except Exception as e:
                results.append({
                    'code': code,
                    'stdout': '',
                    'stderr': f'Execution error: {str(e)}\n{traceback.format_exc()}'
                })
                
        return results