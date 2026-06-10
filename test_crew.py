import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath("backend"))

from dotenv import load_dotenv
load_dotenv('backend/.env')

from agents.crew_definitions import get_hypothesis_generation_crew

crew = get_hypothesis_generation_crew('6577edb3-b38c-4bdb-a077-035ab89e70be', "Default Schema")
# Force verbose output
crew.verbose = True
for task in crew.tasks:
    task.agent.verbose = True

result = crew.kickoff()
print("\n=== FINAL RESULT ===")
print(result)
