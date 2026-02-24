"""
BIZOPS Assist chat: uses the provider chosen in the UI (Ollama, OpenAI, etc.).
For Ollama: no API key. For OpenAI/Anthropic: API key required. Never calls OpenAI without a key.
"""
from langchain_openai import ChatOpenAI
from langchain_classic.chains import create_sql_query_chain
from langchain_community.utilities import SQLDatabase
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
import os
from dotenv import load_dotenv

load_dotenv()


def get_chat_response(query: str, user_settings: dict = None):
    """Run the BIZOPS Assist pipeline. user_settings must come from the request (UI state)."""
    db_url = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")
    if not db_url:
        return "Database URL not configured."

    if not user_settings or not isinstance(user_settings, dict):
        return (
            "Go to Configurations → select Ollama, choose a model, click Deploy Configurations, then try again. "
            "No API key needed for Ollama."
        )

    provider = (user_settings.get("llm_provider") or "ollama")
    if hasattr(provider, "strip"):
        provider = str(provider).strip().lower()
    else:
        provider = str(provider).lower()

    model_name = (user_settings.get("llm_model") or "").strip()
    api_key = user_settings.get("api_key") or os.getenv("OPENAI_API_KEY")
    base_url = user_settings.get("api_base_url")
    if base_url is not None and isinstance(base_url, str):
        base_url = base_url.strip() or None

    if provider == "ollama" and not model_name:
        model_name = "llama3.2"
    if not model_name:
        model_name = "llama3.2" if provider == "ollama" else "gpt-4o"

    # Use Ollama when provider is ollama OR when base_url looks like Ollama (no key needed)
    use_ollama = (
        provider == "ollama"
        or (base_url and provider not in ("openai", "anthropic"))
    )
    if use_ollama:
        # Never use api_key for Ollama
        api_key = None
        llm = ChatOllama(
            model=model_name or "llama3.2",
            base_url=base_url or "http://localhost:11434",
        )
    else:
        key_val = (api_key or "").strip()
        if not key_val:
            return (
                "To use OpenAI/Anthropic, add an API key in Configurations. "
                "Or use Ollama: Configurations → select Ollama, pick a model, Deploy Configurations."
            )
        llm = ChatOpenAI(model=model_name, temperature=0, api_key=api_key)

    db = SQLDatabase.from_uri(db_url)
    chain = create_sql_query_chain(llm, db)
    sql_query = chain.invoke({"question": query})
    result = db.run(sql_query)

    summary_prompt = ChatPromptTemplate.from_template(
        """You are a business data analyst assistant.
The user asked: {question}
The SQL query generated was: {query}
The result of the query was: {result}

Provide a concise, professional, and data-backed answer to the user's question based on this result.
If there are anomalies or interesting trends, point them out."""
    )
    summary_chain = summary_prompt | llm
    response = summary_chain.invoke({
        "question": query,
        "query": sql_query,
        "result": result,
    })
    return response.content
