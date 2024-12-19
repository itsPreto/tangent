# Function to start background tasks
import re
import threading
import traceback

import requests

from shared_data import models_data

_background_tasks_started = False


def start_background_tasks():
    global _background_tasks_started
    if not _background_tasks_started:
        try:
            _background_tasks_started = True
            threading.Thread(target=fetch_and_store_models, daemon=True).start()
        except Exception as e:
            print(f"Failed to start background tasks: {e}")
            traceback.print_exc()


def fetch_and_store_models():
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
        }

        print("Fetching models from ollama.com/library...")
        try:
            models_response = requests.get(
                "https://ollama.com/library", headers=headers, timeout=10
            )
            print(f"Initial response status: {models_response.status_code}")
        except (requests.ConnectionError, requests.Timeout) as e:
            print(f"Connection error or timeout occurred: {str(e)}")
            return
        except requests.RequestException as e:
            print(f"An error occurred during the request: {str(e)}")
            return

        if models_response.status_code != 200:
            print(f"Failed to fetch models: Status {models_response.status_code}")
            return

        try:
            model_links = re.findall(r'href="/library/([^"]+)', models_response.text)
            print(f"Found {len(model_links)} model links")
        except re.error as e:
            print(f"Regex error: {str(e)}")
            return

        if not model_links:
            print("No models found")
            return

        model_names = [link for link in model_links if link]
        print(f"Processing models: {model_names}")

        for name in model_names:
            try:
                print(f"Fetching tags for {name}...")
                try:
                    tags_response = requests.get(
                        f"https://ollama.com/library/{name}/tags",
                        headers=headers,
                        timeout=10,
                    )
                    print(
                        f"Tags response status for {name}: {tags_response.status_code}"
                    )
                except (requests.ConnectionError, requests.Timeout) as e:
                    print(f"Connection error or timeout occurred for {name}: {str(e)}")
                    continue
                except requests.RequestException as e:
                    print(f"An error occurred during the request for {name}: {str(e)}")
                    continue

                if tags_response.status_code == 200:
                    try:
                        tags = re.findall(f'{name}:[^"\\s]*', tags_response.text)
                        filtered_tags = [
                            tag
                            for tag in tags
                            if not any(x in tag for x in ["text", "base", "fp"])
                            and not re.match(r".*q[45]_[01]", tag)
                        ]

                        model_type = (
                            "vision"
                            if "vision" in name
                            else "embedding"
                            if "minilm" in name
                            else "text"
                        )

                        models_data.append(
                            {"name": name, "tags": filtered_tags, "type": model_type}
                        )
                        print(f"Successfully processed {name}")
                    except re.error as e:
                        print(f"Regex error while processing tags for {name}: {str(e)}")
                        continue
                else:
                    print(f"Failed to get tags for {name}")
            except Exception as e:
                print(f"Error processing {name}: {str(e)}")
                continue

        print(f"Fetched and stored {len(models_data)} models")
    except Exception as e:
        print(f"Error fetching library models: {str(e)}")
        traceback.print_exc()
