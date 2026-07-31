import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-key")
DATABASE = os.environ.get("DATABASE", os.path.join(BASE_DIR, "chatbot.db"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL = os.environ.get("OLLAMA_MODEL", "gemma:2b")
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "90"))
