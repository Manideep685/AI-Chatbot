from flask import Blueprint, request, jsonify
from chatbot.bot import get_bot_response  # your AI function

chat_api = Blueprint("chat_api", __name__)

@chat_api.route("/api/get_response", methods=["POST"])
def get_response():
    data = request.get_json()
    message = data.get("message", "")

    # Call TinyLLaMA
    response_text = get_bot_response(message)

    return jsonify({"response": response_text})