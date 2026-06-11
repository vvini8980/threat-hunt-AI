import os
import json
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from groq import AsyncGroq
from services.supabase_client import supabase
from routers.hunt import execute_hunt, IOCHuntRequest, hunt_ioc

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = AsyncGroq(api_key=GROQ_API_KEY)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    client_id: Optional[str] = None

# --- TOOLS ---

def search_hypotheses(query: str, client_id: str = None) -> str:
    """Searches the Supabase hypotheses table for relevant threat hunts."""
    if not supabase:
        return "Database not connected."
    try:
        # A simple text search across title and description
        # We'll fetch all and do a simple filter, or use ILIKE. 
        # For simplicity since this is a quick demo tool, let's fetch hypotheses for this client
        res = supabase.table("hypotheses").select("id, title, mitre_id, status, description, tactic").execute()
        data = res.data or []
        
        # Simple client side filtering
        query_words = query.lower().split()
        results = []
        for row in data:
            if client_id and row.get("client_id") and row.get("client_id") != client_id:
                continue
            text = f"{row.get('title','')} {row.get('description','')} {row.get('tactic','')} {row.get('mitre_id','')}".lower()
            if any(word in text for word in query_words):
                results.append(row)
                
        if not results:
            return "No matching hypotheses found in the database."
            
        formatted = []
        for r in results[:5]: # Return top 5
            formatted.append(f"ID: {r['id']} | Title: {r['title']} | MITRE: {r['mitre_id']} | Status: {r['status']}")
            
        return "Found Hypotheses:\n" + "\n".join(formatted)
    except Exception as e:
        return f"Error searching hypotheses: {str(e)}"

def search_iocs(query: str, client_id: str = None) -> str:
    """Searches the Supabase ioc table for relevant Indicators of Compromise."""
    if not supabase:
        return "Database not connected."
    try:
        res = supabase.table("ioc").select("id, value, type, status, risk_level").execute()
        data = res.data or []
        
        query_words = query.lower().split()
        results = []
        for row in data:
            if client_id and row.get("client_id") and row.get("client_id") != client_id:
                continue
            text = f"{row.get('value','')} {row.get('type','')} {row.get('status','')}".lower()
            if any(word in text for word in query_words):
                results.append(row)
                
        if not results:
            return "No matching IOCs found in the database."
            
        formatted = []
        for r in results[:5]:
            formatted.append(f"ID: {r['id']} | Value: {r['value']} | Type: {r['type']} | Status: {r['status']} | Risk: {r.get('risk_level')}")
            
        return "Found IOCs:\n" + "\n".join(formatted)
    except Exception as e:
        return f"Error searching IOCs: {str(e)}"

def execute_hypothesis_tool(hypothesis_id: str, client_id: str = None) -> str:
    """Executes a specific hypothesis using the hunt logic (Splunk/Sentinel)."""
    try:
        # Call the existing execution logic
        result = execute_hunt(
            hypothesis_id=hypothesis_id,
            client_id=client_id,
            earliest="-30d",
            latest="now",
            platform="auto"
        )
        base_msg = f"Successfully executed hunt! Found {result.get('total_events', 0)} events. Hunt Result ID: {result.get('hunt_result_id')}."
        
        # Inject real events so the LLM doesn't hallucinate
        events = result.get("events", [])
        if events and isinstance(events, list):
            import json
            # Provide up to 3 events to the LLM to give it real data to talk about
            sample_events = json.dumps(events[:3], indent=2)
            base_msg += f"\n\nHere is a sample of the ACTUAL REAL raw events returned from the SIEM:\n{sample_events}\n\nDo NOT make up any fake events. ONLY summarize these real events."
            
        return base_msg
    except Exception as e:
        return f"Failed to execute hypothesis: {str(e)}"

def update_hypothesis_status(hypothesis_id: str, status: str) -> str:
    """Updates the status of a hypothesis on the Kanban board (e.g. 'draft', 'approved', 'in_progress', 'completed')."""
    if not supabase:
        return "Database not connected."
    try:
        valid_statuses = ["draft", "ready_for_review", "approved", "in_progress", "completed", "rejected"]
        if status not in valid_statuses:
            status = "in_progress" # safe fallback
        supabase.table("hypotheses").update({"status": status}).eq("id", hypothesis_id).execute()
        return f"Successfully updated hypothesis {hypothesis_id} status to '{status}'."
    except Exception as e:
        return f"Failed to update status: {str(e)}"


# Define tools for Groq
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_hypotheses",
            "description": "Search the user's database for existing threat hunt hypotheses. Use this when the user asks what hunts they have for a certain topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search keyword (e.g. 'exfiltration', 'T1021')"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_iocs",
            "description": "Search the user's database for existing Indicators of Compromise (IOCs).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search keyword (e.g. 'malicious', '1.1.1.1')"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_hypothesis_tool",
            "description": "Execute a specific hypothesis. Use this when the user asks to run, execute, or trigger a hunt. You must pass the UUID of the hypothesis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hypothesis_id": {"type": "string", "description": "The UUID of the hypothesis to execute"},
                },
                "required": ["hypothesis_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_hypothesis_status",
            "description": "Update the Kanban board status of a hypothesis. Do this automatically after executing a hunt to mark it as 'in_progress' or 'completed'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hypothesis_id": {"type": "string", "description": "The UUID of the hypothesis"},
                    "status": {"type": "string", "description": "The new status: 'in_progress', 'completed', 'approved', 'draft'"},
                },
                "required": ["hypothesis_id", "status"],
            },
        },
    }
]

import re

@router.post("/chat")
async def agent_chat(req: ChatRequest):
    """Agentic chat endpoint that uses Tool Calling."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY missing")

    # Format history for Groq
    messages = [
        {"role": "system", "content": "You are a senior SOC AI Assistant with direct access to the user's database and SIEM. You must answer concisely. You MUST use the native tool calling API to search hypotheses, search IOCs, and execute hunts. DO NOT output raw function tags like <function=...> in your text. Always use the native tool structures provided. CRITICAL: NEVER hallucinate, fabricate, or make up dummy SIEM logs or dummy events. If a tool returns actual events, summarize ONLY those real events. If no events are returned, state that 0 events were found and do not invent scenarios."}
    ]
    for msg in req.messages:
        messages.append({"role": msg.role, "content": msg.content})

    try:
        # First LLM call
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.0
        )
        
        response_message = response.choices[0].message
        
        # Native tool calls
        tool_calls = response_message.tool_calls
        
        # Fallback: parse <function=name>{"json": "args"}</function> from content
        content_text = response_message.content or ""
        fallback_tools = []
        if not tool_calls and "<function=" in content_text:
            import uuid
            pattern = r'<function=([^>]+)>(.*?)</function>'
            matches = re.finditer(pattern, content_text, re.DOTALL)
            for m in matches:
                func_name = m.group(1).strip()
                args_str = m.group(2).strip()
                fallback_tools.append({
                    "id": f"call_{uuid.uuid4().hex[:8]}",
                    "function": {"name": func_name, "arguments": args_str}
                })

        if tool_calls or fallback_tools:
            messages.append(response_message)
            
            # Combine native and fallback tools
            iterable_tools = tool_calls if tool_calls else fallback_tools
            
            # Execute all tools
            for tool_call in iterable_tools:
                # Handle both native object and fallback dict
                if isinstance(tool_call, dict):
                    tool_id = tool_call["id"]
                    function_name = tool_call["function"]["name"]
                    args_str = tool_call["function"]["arguments"]
                else:
                    tool_id = tool_call.id
                    function_name = tool_call.function.name
                    args_str = tool_call.function.arguments

                try:
                    function_args = json.loads(args_str)
                except Exception:
                    function_args = {}
                
                print(f"Agent invoking tool: {function_name}({function_args})")
                
                tool_result = ""
                # Fuzzy match function names to handle hallucinations
                if "search" in function_name and "ioc" in function_name.lower():
                    tool_result = search_iocs(function_args.get("query", ""), req.client_id)
                elif "search" in function_name:
                    tool_result = search_hypotheses(function_args.get("query", ""), req.client_id)
                elif "execute" in function_name:
                    h_id = function_args.get("hypothesis_id") or function_args.get("hunt_id") or function_args.get("id")
                    if h_id:
                        # Auto-resolve hallucinated text IDs to real UUIDs
                        if len(h_id) < 32 or "-" not in h_id:
                            # It's probably a hallucinated name instead of a UUID, let's search for the real UUID!
                            res = supabase.table("hypotheses").select("id").ilike("title", f"%{h_id.replace('_', ' ').split('hunt')[0].strip()}%").execute()
                            if res.data:
                                h_id = res.data[0]["id"]
                            else:
                                # Fallback broader search
                                res = supabase.table("hypotheses").select("id").execute()
                                # Just try to find a partial match in python
                                for r in res.data:
                                    if h_id.lower().replace('_', ' ').split('hunt')[0].strip() in r.get('title', '').lower():
                                        h_id = r["id"]
                                        break
                        
                        tool_result = execute_hypothesis_tool(h_id, req.client_id)
                        # Also automatically update the status to in_progress!
                        update_hypothesis_status(h_id, "in_progress")
                        tool_result += "\n(I have also automatically updated this hunt's status to 'In Progress' on your Kanban board!)"
                    else:
                        tool_result = "Error: Missing hypothesis_id to execute."
                elif "update" in function_name:
                    h_id = function_args.get("hypothesis_id") or function_args.get("hunt_id")
                    tool_result = update_hypothesis_status(h_id, function_args.get("status", "in_progress"))
                else:
                    tool_result = f"Error: Unknown tool {function_name}"

                messages.append({
                    "tool_call_id": tool_id,
                    "role": "tool",
                    "name": function_name,
                    "content": tool_result,
                })

            # Second LLM call to summarize tool results
            second_response = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.0
            )
            return {"role": "assistant", "content": second_response.choices[0].message.content}
            
        else:
            return {"role": "assistant", "content": response_message.content}

    except Exception as e:
        print(f"Agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
