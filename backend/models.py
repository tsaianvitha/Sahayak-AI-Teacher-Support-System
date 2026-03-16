from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


# ----------------------------------------
# USER TABLE
# ----------------------------------------
class User(db.Model):
    __tablename__ = "user"

    user_id      = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(80))
    email        = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    chats = db.relationship(
        "ChatSession", backref="user", lazy=True, cascade="all, delete"
    )


# ----------------------------------------
# CHAT SESSION TABLE
# ----------------------------------------
class ChatSession(db.Model):
    __tablename__ = "chat_session"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("user.user_id"), nullable=False)
    title      = db.Column(db.String(200), default="New Chat")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    conversations = db.relationship(
        "Conversation", backref="chat", lazy=True, cascade="all, delete"
    )


# ----------------------------------------
# CONVERSATION TABLE
# ✅ No user_id here — user is tracked via chat_session.user_id
# ----------------------------------------
class Conversation(db.Model):
    __tablename__ = "conversation"

    id          = db.Column(db.Integer, primary_key=True)
    chat_id     = db.Column(db.Integer, db.ForeignKey("chat_session.id"), nullable=False)
    question    = db.Column(db.Text, nullable=False)
    ai_response = db.Column(db.Text, nullable=False)
    grade       = db.Column(db.String(20))
    subject     = db.Column(db.String(50))
    timestamp   = db.Column(db.DateTime, default=datetime.utcnow)

# ----------------------------------------
# FEEDBACK TABLE
# ----------------------------------------

class SuggestionFeedback(db.Model):
    __tablename__ = "suggestion_feedback"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.user_id"),
        nullable=False,
    )

    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey("conversation.id"),
        nullable=False
    )

    worked = db.Column(db.Boolean, nullable=False)

    rating = db.Column(db.Integer)  # 1–5 scale

    feedback_text = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=db.func.now()
    )

class SavedResource(db.Model):
    __tablename__ = "saved_resource"

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("user.user_id"), nullable=False)
    title           = db.Column(db.String(200), nullable=False)
    content         = db.Column(db.Text, nullable=False)
    tag             = db.Column(db.String(50), nullable=False)   # lesson-plan, quiz, worksheet, tip, other
    subject         = db.Column(db.String(100), default="General")
    grade           = db.Column(db.String(50),  default="")
    source          = db.Column(db.String(50),  default="assistant")  # assistant | quiz | behaviour | worksheet
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("saved_resources", lazy=True))
