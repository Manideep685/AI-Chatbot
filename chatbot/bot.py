import requests

from config import MODEL, OLLAMA_URL, REQUEST_TIMEOUT


SYSTEM_PROMPT = """
You are a professional AI assistant.
Answer clearly, correctly, and helpfully.
When the user sends code or a full program, inspect it carefully, fix errors, and return the complete corrected code in one fenced code block when possible.
If the fixed code is long, keep the explanation short and put the full corrected code first.
If the user asks for code, return clean, runnable code and a short explanation when useful.
If the user asks a normal question, answer normally. Do not force every answer to be Python code.
""".strip()


def get_bot_response(message):
    message = (message or "").strip()
    if not message:
        return "Please type a message so I can help."

    prompt = f"{SYSTEM_PROMPT}\n\nUser: {message}\nAssistant:"

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.25,
                    "top_p": 0.9,
                    "num_ctx": 8192,
                    "num_predict": 1800,
                },
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()

        data = response.json()
        answer = (data.get("response") or "").strip()

        if not answer:
            return "I did not receive a response from the model. Please try again."

        return answer

    except requests.exceptions.ConnectionError:
        return (
            f"I cannot connect to Ollama. Start Ollama and run: "
            f"ollama run {MODEL}"
        )
    except requests.exceptions.Timeout:
        return "The model took too long to respond. Try a shorter question or a smaller model."
    except requests.exceptions.HTTPError as exc:
        return f"Ollama returned an error: {exc.response.status_code} {exc.response.text}"
    except ValueError:
        return "Ollama returned invalid JSON. Please restart Ollama and try again."
    except Exception as exc:
        return f"Unexpected bot error: {exc}"
