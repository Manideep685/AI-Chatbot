# AI-Powered Chatbot (Generative AI)

## Project Overview

An AI-powered chatbot developed using Python and Generative AI. The application integrates a locally hosted Large Language Model (LLM) through Ollama to generate responses to user queries.

The chatbot provides an interactive interface where users can communicate with an AI assistant, receive responses, and maintain conversation history.

## Features

- **Generative AI Integration:** Uses a locally hosted LLM through Ollama.
- **AI Conversations:** Generates responses based on user prompts.
- **User Sessions:** Supports user sessions through Flask.
- **Chat History:** Stores user messages and AI responses in SQLite.
- **New Chat:** Allows users to clear their existing conversation history.
- **File Upload:** Supports uploading files through the application.
- **Interactive Interface:** Provides a web-based chatbot interface.

## Technologies Used

| Category | Technologies |
|---|---|
| Programming Language | Python |
| Backend Framework | Flask |
| Generative AI | Large Language Models (LLM) |
| LLM Runtime | Ollama |
| AI Model | Gemma 2B (default configuration) |
| Database | SQLite |
| Frontend | HTML, CSS, JavaScript |

## Project Structure

```text
AI-Chatbot/
│
├── api/
├── auth/
├── chatbot/
│   ├── bot.py
│   └── memory.py
│
├── client/
├── database/
├── server/
├── static/
├── templates/
├── uploads/
│
├── app.py
├── config.py
├── requirements.txt
└── README.md
```

## How It Works

1. The user enters a question through the chatbot interface.
2. Flask receives the user's message through the chat endpoint.
3. The Python backend passes the prompt to the chatbot module.
4. The chatbot sends a request to the locally running Ollama service.
5. The LLM processes the prompt and generates a response.
6. The generated response is returned to the Flask application.
7. The conversation is stored in the SQLite database.
8. The response is displayed to the user.

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Manideep685/AI-Chatbot.git

cd AI-Chatbot
```

### 2. Create a Virtual Environment

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Install Ollama

Download and install Ollama:

https://ollama.com/

### 5. Download the AI Model

```bash
ollama pull gemma:2b
```

The application uses Gemma 2B by default. The model can be changed through the `OLLAMA_MODEL` environment variable.

### 6. Run the Application

```bash
python app.py
```

Open the application in your browser:

```text
http://127.0.0.1:5000
```

Make sure Ollama is running before sending messages to the chatbot.

## Learning Outcomes

- Understanding Generative AI and Large Language Models.
- Integrating a locally hosted LLM with a Python application.
- Understanding prompt-based AI response generation.
- Working with Flask routes and backend logic.
- Storing and retrieving conversation history using SQLite.

## Author

**Manideep Gopishetti**

GitHub: https://github.com/Manideep685
