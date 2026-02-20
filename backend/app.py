import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from gtts import gTTS
import os
import base64
from io import BytesIO
from models import db, User, Conversation, ChatSession
from service import generate_teacher_response

load_dotenv()

app = Flask(__name__)

# ✅ CORS — allow Authorization header, all origins
CORS(app,
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     expose_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "DELETE", "OPTIONS"],
     supports_credentials=False)

# ✅ Force CORS headers onto EVERY response (including 500 errors)
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response

# ----------------------------------------
# DATABASE
# ----------------------------------------
app.config["SQLALCHEMY_DATABASE_URI"] = \
    "mysql+pymysql://root:ASt14%4020@localhost:3306/sahayak_ai"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False

db.init_app(app)
jwt = JWTManager(app)

with app.app_context():
    db.create_all()

# ----------------------------------------
# HEALTH
# ----------------------------------------
@app.route("/health")
def health():
    return "OK", 200

# ----------------------------------------
# AUTH
# ----------------------------------------
@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"msg": "Email and password required"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"msg": "Email already exists"}), 400

    user = User(
        name=data.get("name", ""),
        email=data["email"],
        password_hash=generate_password_hash(data["password"])
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"msg": "User created"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get("email")).first()

    if not user or not check_password_hash(
            user.password_hash, data.get("password")):
        return jsonify({"msg": "Invalid credentials"}), 401

    token = create_access_token(identity=str(user.user_id))
    return jsonify({"access_token": token})

# ----------------------------------------
# CHATS
# ----------------------------------------
@app.route("/chats", methods=["POST"])
@jwt_required()
def create_chat():
    user_id = int(get_jwt_identity())
    chat = ChatSession(user_id=user_id, title="New Chat")
    db.session.add(chat)
    db.session.commit()
    return jsonify({"id": chat.id})


@app.route("/chats", methods=["GET"])
@jwt_required()
def get_chats():
    user_id = int(get_jwt_identity())
    chats = ChatSession.query.filter_by(user_id=user_id) \
        .order_by(ChatSession.created_at.desc()).all()
    return jsonify([{"id": c.id, "title": c.title} for c in chats])


@app.route("/chats/<int:chat_id>", methods=["DELETE"])
@jwt_required()
def delete_chat(chat_id):
    user_id = int(get_jwt_identity())
    chat = ChatSession.query.filter_by(id=chat_id, user_id=user_id).first()
    if not chat:
        return jsonify({"msg": "Not found"}), 404
    db.session.delete(chat)
    db.session.commit()
    return jsonify({"msg": "Deleted"})

# ----------------------------------------
# ASK AI ✅ Conversation has NO user_id
# ----------------------------------------
@app.route("/ask", methods=["POST"])
@jwt_required()
def ask_ai():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    question = data.get("question", "").strip()
    chat_id  = data.get("chat_id")
    grade    = data.get("grade", "General")
    subject  = data.get("subject", "Teaching")
    language = data.get("language", "English")

    if not question:
        return jsonify({"msg": "Question required"}), 400

    # Auto-create chat if none provided
    if not chat_id:
        chat = ChatSession(user_id=user_id, title=question[:40])
        db.session.add(chat)
        db.session.commit()
        chat_id = chat.id

    # Generate AI response
    ai_response = generate_teacher_response(
        grade=grade,
        subject=subject,
        question=question,
        language=language,
        teacher_context="Prefers practical strategies."
    )

    # ✅ Only insert columns that exist in the DB table
    conversation = Conversation(
        chat_id=chat_id,
        question=question,
        ai_response=ai_response,
        grade=grade,
        subject=subject
    )
    db.session.add(conversation)
    db.session.commit()

    return jsonify({
        "response": ai_response,
        "chat_id": chat_id
    })

@app.route("/tts", methods=["POST"])
def text_to_speech():
    """
    Generate speech audio from text in multiple languages
    Uses Google Text-to-Speech (gTTS) - FREE and works great for Indian languages
    """
    data = request.get_json()
    
    text = data.get("text", "").strip()
    language = data.get("language", "en")
    
    if not text:
        return jsonify({"msg": "Text required"}), 400
    
    try:
        # Map frontend language codes to gTTS codes
        lang_map = {
            "en-US": "en",
            "hi-IN": "hi",
            "ta-IN": "ta",
            "te-IN": "te",
            "kn-IN": "kn",
            "ml-IN": "ml"
        }
        
        gtts_lang = lang_map.get(language, language.split('-')[0])
        
        # Generate speech
        tts = gTTS(text=text, lang=gtts_lang, slow=False)
        
        # Save to BytesIO instead of file
        audio_buffer = BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
        
        return jsonify({
            "audio": audio_base64,
            "format": "mp3"
        })
        
    except Exception as e:
        return jsonify({"msg": f"TTS error: {str(e)}"}), 500

# ----------------------------------------
# GET CONVERSATIONS
# ----------------------------------------
@app.route("/conversations/<int:chat_id>", methods=["GET"])
@jwt_required()
def get_conversations(chat_id):
    conversations = Conversation.query.filter_by(
        chat_id=chat_id
    ).order_by(Conversation.timestamp.asc()).all()

    return jsonify([
        {
            "question": c.question,
            "response": c.ai_response,
            "time": c.timestamp.isoformat()
        }
        for c in conversations
    ])

# ----------------------------------------
# STATS
# ----------------------------------------
@app.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    """Return real-time stats for the logged-in user's profile page."""
    user_id = int(get_jwt_identity())

    # Count all conversations across all of this user's chat sessions
    questions_asked = (
        db.session.query(Conversation)
        .join(ChatSession, Conversation.chat_id == ChatSession.id)
        .filter(ChatSession.user_id == user_id)
        .count()
    )

    return jsonify({
        "questions_asked": questions_asked,
    })

# ----------------------------------------
# CHAT TITLE UPDATE
# ----------------------------------------
@app.route("/chats/<int:chat_id>/title", methods=["POST"])
@jwt_required()
def update_chat_title(chat_id):
    user_id = int(get_jwt_identity())
    chat = ChatSession.query.filter_by(id=chat_id, user_id=user_id).first()
    if not chat:
        return jsonify({"msg": "Not found"}), 404
    data = request.get_json()
    title = data.get("title", "").strip()
    if title:
        chat.title = title[:200]
        db.session.commit()
    return jsonify({"msg": "Updated", "title": chat.title})

# ----------------------------------------
# RUN
# ----------------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5001)