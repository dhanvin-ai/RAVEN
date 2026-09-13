from app.llm.gemini import ask_gemini


def generate_response(
    user_input: str,
    system_prompt: str = ""
):

    prompt = f"""
System instructions:

{system_prompt}

User:

{user_input}

Respond according to the system instructions.
"""

    return ask_gemini(prompt)
