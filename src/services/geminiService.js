export const generateThreatIntel = async (apiKey, rawIntel, existingContext = []) => {
  if (!apiKey) throw new Error('Gemini API key is required');

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const existingHypothesesSection = existingContext.length > 0 
    ? `\nEXISTING HYPOTHESES (DO NOT DUPLICATE):\nThe following hypotheses already exist in the user's library. Your newly generated attack and sub-hypotheses MUST be distinctly different and cover new ground. Do not repeat the same specific detection logics or hypothesis names.\n\n${existingContext.join('\n')}\n` 
    : '';

  const prompt = `You are an elite, senior Threat Intelligence Analyst and Detection Engineer working in a Tier 3 SOC.
I will provide you with a THREAT THEME.
Your task is to autonomously select a real-world, highly-relevant Advanced Persistent Threat (APT), ransomware group, or major vulnerability that matches this theme. 
Once selected, generate a comprehensive, highly realistic, and structured threat hunting payload matching the EXACT JSON schema requested.
${existingHypothesesSection}
CRITICAL INSTRUCTIONS FOR ALL FIELDS (STRICT COMPLIANCE REQUIRED):

1. REALISM & ACCURACY: Do NOT use generic placeholders like "1.1.1.1" or "example.com". Generate highly realistic (or historically accurate) IP addresses, file hashes, domains, and commands specific to the chosen threat actor.
2. THE HYPOTHESIS FIELD (STRICT PHASES & NEWLINES):
Break down the attack chain into highly specific, numbered phases (e.g., Initial Access, Discovery, C2).
CRITICAL: You MUST use literal '\\n\\n' escape sequences in the JSON string to separate each phase so they render properly in the UI. 
3. ALL SPLUNK SPL FIELDS (triageQuery, logSources.query, hypotheses.splunkSPL):
Your Splunk queries MUST be highly advanced, realistic, and use multi-line formatting.
CRITICAL: You MUST use literal '\\n' characters in the JSON string for line breaks inside the SPL so they render nicely. 'eval', 'stats', and 'table' commands MUST be on their own lines.
4. IOCs ARRAY:
Provide at least 4 distinct IOCs (IP, DOMAIN, HASH, FILE) with deep context explaining exactly how the actor uses them.
5. LOG SOURCES ARRAY:
Provide exactly 3 log sources (e.g., Sysmon, Firewall, Windows Security). The indicators must be specific, and the query must use literal '\\n' formatting.
6. HYPOTHESES ARRAY:
Generate exactly 3 sub-hypotheses focusing on different tactics (e.g., Persistence, Lateral Movement, Exfiltration). Each must have a robust SPL query with literal '\\n' formatting.

JSON COMPLIANCE:
Keep the output STRICTLY within the required JSON schema. Do NOT wrap the output in markdown (no \`\`\`json blocks). Just return the raw JSON object.

THREAT THEME TO GENERATE FROM:
${rawIntel}`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      name: { type: "STRING" },
      date: { type: "STRING" },
      metadata: {
        type: "OBJECT",
        properties: {
          actor: { type: "STRING" },
          aliases: { type: "STRING" },
          origin: { type: "STRING" },
          activeSince: { type: "STRING" },
          targetSector: { type: "STRING" },
          dwellTime: { type: "STRING" },
          sophistication: { type: "STRING" },
          cisaAlert: { type: "STRING" },
          confidence: { type: "STRING" }
        },
        required: ["actor", "aliases", "origin", "activeSince", "targetSector", "dwellTime", "sophistication", "cisaAlert", "confidence"]
      },
      poc: {
        type: "OBJECT",
        properties: {
          hypothesis: { type: "STRING" },
          triageQuery: { type: "STRING" },
          huntingSteps: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                step: { type: "STRING" },
                description: { type: "STRING" }
              },
              required: ["step", "description"]
            }
          },
          falsePositives: { type: "STRING" },
          logSources: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                source: { type: "STRING" },
                indicator: { type: "STRING" },
                query: { type: "STRING" }
              },
              required: ["source", "indicator", "query"]
            }
          }
        },
        required: ["hypothesis", "triageQuery", "huntingSteps", "falsePositives", "logSources"]
      },
      references: {
        type: "ARRAY",
        items: { type: "STRING" }
      },
      iocs: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING" },
            value: { type: "STRING" },
            context: { type: "STRING" }
          },
          required: ["type", "value", "context"]
        }
      },
      hypotheses: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            hypoName: { type: "STRING" },
            description: { type: "STRING" },
            mitreId: { type: "STRING" },
            tactic: { type: "STRING" },
            platform: { type: "STRING" },
            dataSource: { type: "STRING" },
            actorContext: { type: "STRING" },
            confidence: { type: "STRING" },
            source: { type: "STRING" },
            lastSeen: { type: "STRING" },
            huntingLogic: { type: "STRING" },
            falsePositiveRisk: { type: "STRING" },
            truePositiveAction: { type: "STRING" },
            splunkSPL: { type: "STRING" }
          },
          required: ["hypoName", "description", "mitreId", "tactic", "platform", "dataSource", "actorContext", "confidence", "source", "lastSeen", "huntingLogic", "falsePositiveRisk", "truePositiveAction", "splunkSPL"]
        }
      }
    },
    required: ["id", "name", "date", "metadata", "poc", "references", "iocs", "hypotheses"]
  };

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: responseSchema
    }
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || 'Failed to fetch from Gemini API');
    }

    const data = await res.json();
    const resultText = data.candidates[0].content.parts[0].text;
    return JSON.parse(resultText);
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};
