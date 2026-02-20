import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "llama-3.1-8b-instant"
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def generate_teacher_response(
    grade: str,
    subject: str,
    question: str,
    language: str = "English",
    teacher_context: str = ""
) -> str:


    if not os.getenv("GROQ_API_KEY"):
        return "Groq API key missing."

    # Normalize input
    user_input = question.strip().lower()

    # -----------------------------
    # FAST PATH: GREETINGS / PAUSE
    # -----------------------------
    if user_input in ["hi", "hello", "hey"]:
        return "Hi! What do you want help with right now?"

    if user_input in ["wait", "one sec", "hold on", "ok", "okay"]:
        return "No problem — take your time."

    # -----------------------------
    # SYSTEM PROMPT (DIRECT, HUMAN)
    # -----------------------------
    system_prompt = (
    f"You are a calm, experienced teaching assistant with 20 years of experience.\n"
    f"You MUST reply ONLY in {language} language.\n"
    f"Do NOT mix languages.\n"
    f"Speak directly to the teacher using 'you'.\n"
    f"Be supportive, brief, and practical."
)


    # -----------------------------
    # USER PROMPT (STRICT & GROUNDED)
    # -----------------------------
    user_prompt = f"""
Teaching context:
- Grade: {grade}
- Subject: {subject}
- Language: {language}

Question:
{question}

RULES:
- Answer ONLY in {language}
- Use simple language
- Be practical
- No extra explanation
"""


    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,   # 🔑 keeps it sane
            max_tokens=512,
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        return f"AI error: {str(e)}"
