export const generateHypothesis = async (topic, iocs) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        hypoName: `AI Gen: ${topic} Hunt`,
        description: `This hypothesis was automatically generated based on the topic: ${topic}. It looks for related malicious behaviors.`,
        mitreId: 'T1543',
        subTechnique: '003',
        tactic: 'persistence',
        huntingLogic: 'Look for unusual processes starting with these IOCs...',
        splunkSPL: 'index=main sourcetype=WinEventLog:Security EventCode=4688 | search "malicious"',
        qradarAQL: 'SELECT * FROM events WHERE devicetype=Windows AND eventID=4688',
        sentinelKQL: 'SecurityEvent | where EventID == 4688 | where CommandLine contains "malicious"',
        socDetectionRule: 'IF process_name IN iocs THEN Alert()'
      });
    }, 1500);
  });
};
