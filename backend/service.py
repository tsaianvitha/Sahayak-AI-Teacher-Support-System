import os
import json
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "llama-3.1-8b-instant"
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# ----------------------------------------
# JSON SAFETY HELPERS
# ----------------------------------------

def clean_json_string(raw: str) -> str:
    """
    Clean raw model output before json.loads().
    Handles:
    - Markdown fences  ```json ... ```
    - Invisible control characters (cause of 'Invalid control character' error)
    - Literal unescaped newlines inside JSON string values
    """
    # Strip markdown fences
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]

    raw = raw.strip()

    # Remove invisible control characters (0x00-0x1F) EXCEPT \t (09) \n (0a) \r (0d)
    raw = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', raw)

    # Replace literal newlines that appear inside JSON string values with \\n
    # Strategy: replace all \n inside a quoted string region
    def escape_newlines_in_strings(text: str) -> str:
        result = []
        in_string = False
        i = 0
        while i < len(text):
            ch = text[i]
            if ch == '\\' and in_string:
                # Keep escape sequences intact
                result.append(ch)
                if i + 1 < len(text):
                    result.append(text[i + 1])
                    i += 2
                continue
            if ch == '"':
                in_string = not in_string
                result.append(ch)
            elif ch == '\n' and in_string:
                result.append('\\n')   # escape it
            elif ch == '\r' and in_string:
                result.append('\\r')
            elif ch == '\t' and in_string:
                result.append('\\t')
            else:
                result.append(ch)
            i += 1
        return ''.join(result)

    raw = escape_newlines_in_strings(raw)
    return raw


def extract_response_text(raw: str) -> str:
    """
    Last-resort extractor when json.loads() fails completely.
    Tries to pull just the 'response' value from the raw string.
    Falls back to returning the raw text stripped of JSON syntax.
    """
    # Try regex extraction of "response": "..."
    match = re.search(r'"response"\s*:\s*"(.*?)(?<!\\)"', raw, re.DOTALL)
    if match:
        text = match.group(1)
        # Unescape common sequences so the text renders cleanly in the UI
        text = (text
                .replace('\\n', '\n')
                .replace('\\t', '\t')
                .replace('\\"', '"')
                .replace('\\\\', '\\'))
        return text.strip()

    # If there are no JSON braces it's probably plain text already
    if not raw.strip().startswith('{'):
        return raw.strip()

    # Nothing worked
    return "I had trouble formatting my response. Please try asking again."


# ----------------------------------------
# EXPERIENCE → TONE MAP (shared)
# ----------------------------------------

EXP_MAP = {
    "New Teacher (0-2 years)":   "Use very clear, step-by-step explanations with examples. Be encouraging.",
    "Intermediate (3-5 years)":  "Be practical and direct. Assume basic classroom familiarity.",
    "Experienced (6-10 years)":  "Be concise. Focus on efficiency and nuance.",
    "Senior (10+ years)":        "Be peer-level. Skip basics, offer advanced or research-backed insights.",
}


# ----------------------------------------
# 1. TEACHER ASSISTANT — generate_teacher_response
# ----------------------------------------

def generate_teacher_response(
    grade: str,
    subject: str,
    question: str,
    language: str = "English",
    experience: str = "",
    challenges: str = "",
    location: str = "",
    recent_questions: list = None
) -> dict:
    """
    Returns: { "response": str, "suggestions": [str, str, str] }
    """

    if not os.getenv("GROQ_API_KEY"):
        return {"response": "Groq API key missing.", "suggestions": []}

    user_input = question.strip().lower()

    # Fast path — greetings / filler words
    if user_input in ["hi", "hello", "hey"]:
        return {"response": "Hi! What do you want help with right now?", "suggestions": []}

    if user_input in ["wait", "one sec", "hold on", "ok", "okay"]:
        return {"response": "No problem — take your time.", "suggestions": []}

    tone_hint = EXP_MAP.get(experience, "Be practical and supportive.")

    context_snippet = ""
    if recent_questions:
        recent = "\n".join(f"- {q}" for q in recent_questions[-3:])
        context_snippet = (
            f"\nThe teacher has recently asked about:\n{recent}\n"
            f"Avoid repeating the same advice."
        )

    system_prompt = (
        f"You are an experienced teaching coach with 20 years in Indian classrooms.\n"
        f"Reply ONLY in {language}. Do NOT mix languages.\n"
        f"Speak directly to the teacher using 'you'.\n"
        f"{tone_hint}\n\n"
        f"You MUST respond with valid JSON only. No markdown, no extra text.\n"
        f'Format: {{"response": "your answer here", '
        f'"suggestions": ["follow-up 1", "follow-up 2", "follow-up 3"]}}'
    )

    user_prompt = f"""Teacher profile:
- Grade they teach: {grade}
- Subject: {subject}
- Experience: {experience}
- Location/context: {location}
- Main challenges: {challenges}
{context_snippet}

Their question:
{question}

Rules:
- Answer ONLY in {language}
- Keep the "response" value under 100 words — be concise and direct
- Use examples relevant to grade {grade} {subject} class
- Acknowledge their challenge context if relevant: {challenges}
- Be practical, no filler, no preamble
- suggestions: exactly 3 short follow-up questions, each under 10 words, in {language}
"""

    raw = ""
    try:
        raw = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=512,
        ).choices[0].message.content.strip()

        raw = clean_json_string(raw)
        parsed = json.loads(raw)

        return {
            "response":    str(parsed.get("response", "")).strip(),
            "suggestions": [str(s) for s in parsed.get("suggestions", [])[:3]],
        }

    except json.JSONDecodeError:
        # JSON parse failed — extract just the response text intelligently
        return {
            "response":    extract_response_text(raw),
            "suggestions": []
        }

    except Exception as e:
        return {"response": f"AI error: {str(e)}", "suggestions": []}


# ----------------------------------------
# 2. QUIZ GENERATOR — generate_quiz
# ----------------------------------------

def generate_quiz(
    grade: str,
    subject: str,
    topic: str,
    num_questions: int,
    language: str = "English"
) -> dict:
    """
    Returns: { "questions": [ { "question", "options": [4], "answer": "A"|"B"|"C"|"D" } ] }
    On error: { "error": str, "questions": [] }
    """

    if not os.getenv("GROQ_API_KEY"):
        return {"error": "Groq API key missing.", "questions": []}

    system_prompt = (
        f"You are an expert quiz maker for school teachers.\n"
        f"Reply ONLY in {language}. Do NOT mix languages.\n"
        f"You MUST respond with valid JSON only. No markdown, no extra text.\n"
        f"Format exactly:\n"
        f'{{"questions": ['
        f'{{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A"}}'
        f', ...]}}'
    )

    user_prompt = f"""Generate {num_questions} multiple choice questions.

Topic: {topic}
Grade: {grade}
Subject: {subject}
Language: {language}

Rules:
- Each question must have exactly 4 options labeled A, B, C, D
- "answer" must be just the letter: "A", "B", "C", or "D"
- Questions must be appropriate for Grade {grade} students
- Vary difficulty: mix easy, medium, and hard questions
- No repeated questions
- All text in {language} only
"""

    raw = ""
    try:
        raw = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=200 * num_questions,
        ).choices[0].message.content.strip()

        raw = clean_json_string(raw)
        parsed = json.loads(raw)
        questions = parsed.get("questions", [])[:num_questions]

        # Validate each question
        valid = []
        for q in questions:
            if (
                q.get("question")
                and isinstance(q.get("options"), list)
                and len(q["options"]) == 4
                and q.get("answer") in ["A", "B", "C", "D"]
            ):
                valid.append(q)

        return {"questions": valid}

    except json.JSONDecodeError:
        return {
            "error": "Could not parse quiz response. Please try again.",
            "questions": []
        }
    except Exception as e:
        return {"error": str(e), "questions": []}


# ----------------------------------------
# 3. BEHAVIOUR COACH — generate_action_plan
# ----------------------------------------

def generate_action_plan(
    problem: str,
    grade: str,
    subject: str,
    experience: str,
    language: str = "English"
) -> dict:
    """
    Returns:
    {
      "title": str,
      "severity": "low"|"medium"|"high",
      "steps": [
        { "step": 1, "title": str, "action": str, "why": str, "script": str },
        ...
      ],
      "quick_tip": str,
      "when_to_escalate": str
    }
    On error: { "error": str, "steps": [] }
    """

    if not os.getenv("GROQ_API_KEY"):
        return {"error": "Groq API key missing.", "steps": []}

    tone = EXP_MAP.get(experience, "Be practical and supportive.")

    system_prompt = (
        f"You are an expert school counsellor and classroom management coach "
        f"with 20 years of experience in Indian schools.\n"
        f"Reply ONLY in {language}. Do NOT mix languages.\n"
        f"{tone}\n\n"
        f"You MUST respond with valid JSON only. No markdown, no extra text.\n"
        f"Format exactly:\n"
        f'{{"title": "short plan title", "severity": "low|medium|high", '
        f'"steps": ['
        f'{{"step": 1, "title": "...", "action": "...", "why": "...", "script": "..."}},'
        f'{{"step": 2, "title": "...", "action": "...", "why": "...", "script": "..."}},'
        f'{{"step": 3, "title": "...", "action": "...", "why": "...", "script": "..."}}'
        f'], '
        f'"quick_tip": "one sentence the teacher can act on right now", '
        f'"when_to_escalate": "one sentence on when to involve school leadership"}}'
    )

    user_prompt = f"""Classroom problem reported by a teacher:

Problem: {problem}
Grade level: {grade}
Subject: {subject}
Teacher experience: {experience}

Generate a structured 3-step action plan.

Rules:
- All text in {language} only
- Steps must be specific to Grade {grade} students (age-appropriate)
- Each step must include:
  * title: short action name (5 words max)
  * action: exactly what the teacher should DO (2-3 sentences)
  * why: why this works for this age group (1 sentence)
  * script: a word-for-word example of what the teacher could SAY to the class
- severity: judge as "low", "medium", or "high" based on the problem description
- quick_tip: something the teacher can do in the next 60 seconds
- when_to_escalate: when this needs to go to the principal or counsellor
"""

    raw = ""
    try:
        raw = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=900,
        ).choices[0].message.content.strip()

        raw = clean_json_string(raw)
        parsed = json.loads(raw)

        # Validate steps
        steps = parsed.get("steps", [])
        valid_steps = [
            s for s in steps
            if s.get("title") and s.get("action") and s.get("why") and s.get("script")
        ]

        return {
            "title":            str(parsed.get("title", "Action Plan")),
            "severity":         parsed.get("severity", "medium"),
            "steps":            valid_steps[:3],
            "quick_tip":        str(parsed.get("quick_tip", "")),
            "when_to_escalate": str(parsed.get("when_to_escalate", "")),
        }

    except json.JSONDecodeError:
        return {
            "error": "Could not parse action plan. Please try again.",
            "steps": []
        }
    except Exception as e:
        return {"error": str(e), "steps": []}