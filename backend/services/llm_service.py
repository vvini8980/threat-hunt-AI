import os
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def analyze_hunt_results_with_llm(hunt_context: str, raw_results: str) -> str:
    """
    Sends the hunt hypothesis context and raw splunk results to the Gemini LLM
    to determine whether the result is a True Positive (TP) or False Positive (FP),
    and to generate analyst notes.
    """
    if not GEMINI_API_KEY:
        return "Mocked Analysis: Based on the provided context, this appears to be a False Positive (FP) as the activity aligns with known administrative behavior."

    prompt = f"""
    You are an expert Security Operations Center (SOC) analyst.
    Please review the following threat hunt hypothesis and context, along with the raw search results from the SIEM.
    Determine if this is a True Positive (TP) indicating malicious activity, a False Positive (FP) indicating benign activity, or Clean.
    Provide a brief explanation of your reasoning (Analyst Notes).
    
    Format your response exactly like this:
    VERDICT: [TP/FP/clean]
    NOTES: [Your detailed reasoning]
    
    HUNT CONTEXT:
    {hunt_context}
    
    RAW RESULTS:
    {raw_results}
    """
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"LLM Analysis failed: {e}")
        return f"VERDICT: Error\nNOTES: LLM analysis failed: {e}"
