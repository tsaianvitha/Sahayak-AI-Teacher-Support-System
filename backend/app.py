import os
import base64
from io import BytesIO
from service import generate_teacher_response, generate_quiz
from service import generate_teacher_response, generate_quiz, generate_action_plan
from flask import Flask, request, jsonify
from collections import defaultdict
from datetime import datetime, timedelta
from models import db, User, Conversation, ChatSession, SuggestionFeedback, SavedResource
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
from models import db, User, Conversation, ChatSession, SuggestionFeedback
from service import generate_teacher_response

load_dotenv()

app = Flask(__name__)

# ----------------------------------------
# CORS
# ----------------------------------------
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "DELETE", "OPTIONS"],
)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response

# ----------------------------------------
# DATABASE CONFIG
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
# HEALTH CHECK
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
        user.password_hash,
        data.get("password")
    ):
        return jsonify({"msg": "Invalid credentials"}), 401

    token = create_access_token(identity=str(user.user_id))

    return jsonify({"access_token": token})

# ----------------------------------------
# CHAT SESSIONS
# ----------------------------------------
@app.route("/chats", methods=["POST"])
@jwt_required()
def create_chat():

    user_id = int(get_jwt_identity())

    chat = ChatSession(
        user_id=user_id,
        title="New Chat"
    )

    db.session.add(chat)
    db.session.commit()

    return jsonify({"id": chat.id})


@app.route("/chats", methods=["GET"])
@jwt_required()
def get_chats():

    user_id = int(get_jwt_identity())

    chats = ChatSession.query.filter_by(
        user_id=user_id
    ).order_by(ChatSession.created_at.desc()).all()

    return jsonify([
        {
            "id": c.id,
            "title": c.title
        }
        for c in chats
    ])

# ----------------------------------------
# SAVED RESOURCES
# ----------------------------------------

@app.route("/resources", methods=["POST"])
@jwt_required()
def save_resource():
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    title   = data.get("title", "").strip()
    content = data.get("content", "").strip()
    tag     = data.get("tag", "other").strip()
    subject = data.get("subject", "General").strip()
    grade   = data.get("grade", "").strip()
    source  = data.get("source", "assistant").strip()

    if not title or not content:
        return jsonify({"msg": "Title and content are required"}), 400

    # Prevent exact duplicates
    existing = SavedResource.query.filter_by(
        user_id=user_id, content=content
    ).first()
    if existing:
        return jsonify({"msg": "Already saved", "id": existing.id}), 200

    resource = SavedResource(
        user_id=user_id, title=title, content=content,
        tag=tag, subject=subject, grade=grade, source=source
    )
    db.session.add(resource)
    db.session.commit()

    return jsonify({"msg": "Saved", "id": resource.id}), 201


@app.route("/resources", methods=["GET"])
@jwt_required()
def get_resources():
    user_id = int(get_jwt_identity())

    tag     = request.args.get("tag")
    subject = request.args.get("subject")
    search  = request.args.get("search", "").strip().lower()

    query = SavedResource.query.filter_by(user_id=user_id)

    if tag and tag != "all":
        query = query.filter_by(tag=tag)
    if subject and subject != "all":
        query = query.filter_by(subject=subject)
    if search:
        query = query.filter(
            db.or_(
                SavedResource.title.ilike(f"%{search}%"),
                SavedResource.content.ilike(f"%{search}%"),
            )
        )

    resources = query.order_by(SavedResource.created_at.desc()).all()

    return jsonify([
        {
            "id":         r.id,
            "title":      r.title,
            "content":    r.content,
            "tag":        r.tag,
            "subject":    r.subject,
            "grade":      r.grade,
            "source":     r.source,
            "created_at": r.created_at.isoformat(),
        }
        for r in resources
    ])


@app.route("/resources/<int:resource_id>", methods=["DELETE"])
@jwt_required()
def delete_resource(resource_id):
    user_id  = int(get_jwt_identity())
    resource = SavedResource.query.filter_by(
        id=resource_id, user_id=user_id
    ).first()

    if not resource:
        return jsonify({"msg": "Not found"}), 404

    db.session.delete(resource)
    db.session.commit()
    return jsonify({"msg": "Deleted"})


@app.route("/resources/subjects", methods=["GET"])
@jwt_required()
def get_resource_subjects():
    user_id = int(get_jwt_identity())
    rows = (
        db.session.query(SavedResource.subject)
        .filter_by(user_id=user_id)
        .distinct()
        .all()
    )
    return jsonify([r.subject for r in rows if r.subject])
@app.route("/chats/<int:chat_id>", methods=["DELETE"])
@jwt_required()
def delete_chat(chat_id):

    user_id = int(get_jwt_identity())

    chat = ChatSession.query.filter_by(
        id=chat_id,
        user_id=user_id
    ).first()

    if not chat:
        return jsonify({"msg": "Not found"}), 404

    db.session.delete(chat)
    db.session.commit()

    return jsonify({"msg": "Deleted"})

# ----------------------------------------
# ASK AI
# ----------------------------------------
@app.route("/ask", methods=["POST"])
@jwt_required()
def ask_ai():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    question    = data.get("question")
    chat_id     = data.get("chat_id")
    grade       = data.get("grade", "General")
    subject     = data.get("subject", "Teaching")
    language    = data.get("language", "English")
    experience  = data.get("experience", "")
    challenges  = data.get("challenges", "")
    location    = data.get("location", "")

    if not question or not chat_id:
        return jsonify({"msg": "Missing question or chat_id"}), 400

    # Auto-title the chat
    chat = db.session.get(ChatSession, chat_id)
    if chat and chat.title == "New Chat":
        chat.title = question[:40]

    # Fetch last 3 questions this user has asked (for context awareness)
    recent = (
        db.session.query(Conversation.question)
        .join(ChatSession, Conversation.chat_id == ChatSession.id)
        .filter(ChatSession.user_id == user_id)
        .order_by(Conversation.timestamp.desc())
        .limit(3)
        .all()
    )
    recent_questions = [r.question for r in recent]

    result = generate_teacher_response(
        grade=grade,
        subject=subject,
        question=question,
        language=language,
        experience=experience,
        challenges=challenges,
        location=location,
        recent_questions=recent_questions,
    )
    ai_response  = result["response"]
    suggestions  = result.get("suggestions", [])

    conversation = Conversation(
        chat_id=chat_id,
        question=question,
        ai_response=ai_response,
        grade=grade,
        subject=subject,
    )
    db.session.add(conversation)
    db.session.commit()

    return jsonify({
        "response": ai_response,
        "suggestions":suggestions,      
        "conversation_id": conversation.id,
    })

# ----------------------------------------
# TEXT TO SPEECH
# ----------------------------------------
@app.route("/tts", methods=["POST"])
def text_to_speech():

    data = request.get_json()

    text = data.get("text", "").strip()
    language = data.get("language", "en")

    if not text:
        return jsonify({"msg": "Text required"}), 400

    try:

        lang_map = {
            "en-US": "en",
            "hi-IN": "hi",
            "ta-IN": "ta",
            "te-IN": "te",
            "kn-IN": "kn",
            "ml-IN": "ml"
        }

        gtts_lang = lang_map.get(language, language.split("-")[0])

        tts = gTTS(text=text, lang=gtts_lang, slow=False)

        audio_buffer = BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)

        audio_base64 = base64.b64encode(
            audio_buffer.read()
        ).decode("utf-8")

        return jsonify({
            "audio": audio_base64,
            "format": "mp3"
        })

    except Exception as e:
        return jsonify({"msg": f"TTS error: {str(e)}"}), 500

#quiz generation
@app.route("/quiz", methods=["POST"])
@jwt_required()
def create_quiz():

    data         = request.get_json()
    grade        = data.get("grade", "")
    subject      = data.get("subject", "")
    topic        = data.get("topic", "")
    language     = data.get("language", "English")
    num_questions = int(data.get("num_questions", 5))

    if not topic:
        return jsonify({"msg": "Topic is required"}), 400

    # Clamp between 1 and 20
    num_questions = max(1, min(20, num_questions))

    result = generate_quiz(
        grade=grade,
        subject=subject,
        topic=topic,
        num_questions=num_questions,
        language=language,
    )

    if "error" in result:
        return jsonify({"msg": result["error"]}), 500

    return jsonify(result)

#behaviour coach
@app.route("/behaviour-coach", methods=["POST"])
@jwt_required()
def behaviour_coach():

    data       = request.get_json()
    problem    = data.get("problem", "").strip()
    grade      = data.get("grade", "General")
    subject    = data.get("subject", "General")
    experience = data.get("experience", "")
    language   = data.get("language", "English")

    if not problem:
        return jsonify({"msg": "Problem description is required"}), 400

    if len(problem) < 10:
        return jsonify({"msg": "Please describe the problem in more detail"}), 400

    result = generate_action_plan(
        problem=problem,
        grade=grade,
        subject=subject,
        experience=experience,
        language=language,
    )

    if "error" in result:
        return jsonify({"msg": result["error"]}), 500

    return jsonify(result)
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
            "id": c.id,
            "question": c.question,
            "response": c.ai_response,
            "time": c.timestamp.isoformat()
        }
        for c in conversations
    ])

# ----------------------------------------
# USER STATS
# ----------------------------------------
@app.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():

    user_id = int(get_jwt_identity())

    questions_asked = (
        db.session.query(Conversation)
        .join(ChatSession, Conversation.chat_id == ChatSession.id)
        .filter(ChatSession.user_id == user_id)
        .count()
    )

    return jsonify({
        "questions_asked": questions_asked
    })

# ----------------------------------------
# UPDATE CHAT TITLE
# ----------------------------------------
@app.route("/chats/<int:chat_id>/title", methods=["POST"])
@jwt_required()
def update_chat_title(chat_id):

    user_id = int(get_jwt_identity())

    chat = ChatSession.query.filter_by(
        id=chat_id,
        user_id=user_id
    ).first()

    if not chat:
        return jsonify({"msg": "Not found"}), 404

    data = request.get_json()

    title = data.get("title", "").strip()

    if title:
        chat.title = title[:200]
        db.session.commit()

    return jsonify({
        "msg": "Updated",
        "title": chat.title
    })


# ----------------------------------------
# FEEDBACK
# ----------------------------------------

@app.route("/feedback/<int:conversation_id>", methods=["POST"])
@jwt_required()
def submit_feedback(conversation_id):
    user_id = int(get_jwt_identity())

    conversation = Conversation.query.get(conversation_id)
    if not conversation:
        return jsonify({"msg": "Conversation not found"}), 404

    data = request.get_json()

    feedback = SuggestionFeedback(
        user_id=user_id,
        conversation_id=conversation_id,
        worked=data["worked"],
        rating=data.get("rating"),
        feedback_text=data.get("feedback_text")
    )

    db.session.add(feedback)
    db.session.commit()

    return jsonify({"msg": "Feedback stored"}), 201

# ----------------------------------------
# FEEDBACK
# ----------------------------------------
@app.route("/feedback/<int:conversation_id>", methods=["POST"])
@jwt_required()
def submit_feedback(conversation_id):

    user_id = int(get_jwt_identity())

    conversation = db.session.get(Conversation, conversation_id)

    if not conversation:
        return jsonify({"msg": "Conversation not found"}), 404

    data = request.get_json()

    feedback = SuggestionFeedback(
        user_id=user_id,
        conversation_id=conversation_id,
        worked=data["worked"],
        rating=data.get("rating"),
        feedback_text=data.get("feedback_text")
    )

    db.session.add(feedback)
    db.session.commit()

    return jsonify({"msg": "Feedback stored"}), 201

#statistics of feedback ratings over time
@app.route("/stats/ratings", methods=["GET"])
@jwt_required()
def get_rating_trends():

    user_id = int(get_jwt_identity())

    # Fetch all feedback for this user with its timestamp
    feedbacks = (
        db.session.query(
            SuggestionFeedback.rating,
            SuggestionFeedback.created_at
        )
        .filter(
            SuggestionFeedback.user_id == user_id,
            SuggestionFeedback.rating.isnot(None)
        )
        .order_by(SuggestionFeedback.created_at.asc())
        .all()
    )

    if not feedbacks:
        return jsonify({"weeks": [], "averages": [], "counts": []})

    # Group by ISO week (e.g. "2026-W10")
    week_buckets = defaultdict(list)
    for rating, created_at in feedbacks:
        iso = created_at.isocalendar()          # (year, week, weekday)
        key = f"{iso[0]}-W{iso[1]:02d}"
        week_buckets[key].append(rating)

    # Sort weeks chronologically and build output arrays
    sorted_weeks = sorted(week_buckets.keys())
    averages = [
        round(sum(week_buckets[w]) / len(week_buckets[w]), 2)
        for w in sorted_weeks
    ]
    counts = [len(week_buckets[w]) for w in sorted_weeks]

    # Human-readable week labels  e.g. "Mar 10"
    labels = []
    for w in sorted_weeks:
        year, week_num = w.split("-W")
        # Monday of that ISO week
        monday = datetime.strptime(f"{year} {week_num} 1", "%G %V %u")
        labels.append(monday.strftime("%b %-d"))

    return jsonify({
        "weeks":     sorted_weeks,
        "labels":    labels,
        "averages":  averages,
        "counts":    counts,
    })

# ----------------------------------------
# RUN SERVER
# ----------------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5001)