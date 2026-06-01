import { useState, useCallback, useEffect } from 'react';
import { generateThreatIntel } from '../services/geminiService';

export const useAIHub = () => {
  const [attacks, setAttacks] = useState(() => {
    try {
      const saved = localStorage.getItem('thboard_live_attacks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isFetching, setIsFetching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [savedLibrary, setSavedLibrary] = useState(() => {
    try {
      const saved = localStorage.getItem('thboard_saved_library');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  const saveHypothesis = useCallback((hypo) => {
    setSavedLibrary(prev => {
      const next = new Set([...prev, hypo.hypoName]);
      localStorage.setItem('thboard_saved_library', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const generateLiveAttack = useCallback(async (rawText) => {
    const apiKey = localStorage.getItem('ai_gemini_key');
    if (!apiKey) throw new Error('Please configure your Gemini API Key in AI Settings first.');
    
    setIsGenerating(true);
    try {
      const newAttack = await generateThreatIntel(apiKey, rawText);
      setAttacks(prev => {
        const existingIndex = prev.findIndex(a => a.name === newAttack.name);
        let newAttacks;
        if (existingIndex >= 0) {
          newAttacks = [...prev];
          newAttacks[existingIndex] = newAttack;
        } else {
          newAttacks = [newAttack, ...prev];
        }
        localStorage.setItem('thboard_live_attacks', JSON.stringify(newAttacks));
        return newAttacks;
      });
      setLastUpdated(new Date().toLocaleTimeString());
      return newAttack;
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const fetchRecentAttacks = useCallback(async () => {
    setIsFetching(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const dummyAttacks = [
        {
          id: 'atk-001',
          name: 'Volt Typhoon: Living off the Land (LotL) targeting Critical Infrastructure',
          date: '2026-05-24',
          metadata: {
            actor: 'Volt Typhoon',
            aliases: 'Bronze Silhouette, DEV-0391, VANGUARD PANDA',
            origin: 'China (PRC sponsored)',
            activeSince: '2021 (confirmed 2023)',
            targetSector: 'Critical Infrastructure (Energy/Water/Comms/OT)',
            dwellTime: '300+ days average',
            sophistication: 'Nation State',
            cisaAlert: 'AA23-144A (May 2023)',
            confidence: 'HIGH 94%'
          },
          poc: {
            hypothesis: `Volt Typhoon maintains persistent access to US critical infrastructure using a UNIQUE behavioral pattern:

PHASE 1 — Initial Access (Specific):
Exploits Fortinet FortiGuard SSL VPN vulnerability CVE-2022-40684 OR Zoho ManageEngine ADSelfService Plus CVE-2021-40539 for initial foothold. NOT phishing. NOT email. Always edge device exploitation.

PHASE 2 — Discovery (Specific):
Runs THIS EXACT sequence of commands:
net group /domain
net user /domain  
netstat -ano
ipconfig /all
systeminfo
wmic computersystem get
Uses cmd.exe NOT PowerShell (unique!)

PHASE 3 — Credential Access (Specific):
Uses ntdsutil.exe snapshot feature NOT vssadmin (other actors use vssadmin)
Command specifically: ntdsutil 'ac i ntds' 'ifm' 'create full c:\\temp' q q
This exact command = Volt Typhoon TTP

PHASE 4 — C2 (Specific):
Proxies ALL traffic through compromised SOHO routers. Specific brands targeted: Cisco RV320/RV325, Netgear ProSafe, Asus RT series, FatPipe WARP/IPVPN/MPVPN.
Traffic has NO SNI headers = unique

PHASE 5 — Persistence (Specific):
Uses netsh portproxy commands:
netsh interface portproxy add v4tov4 listenport=50100 connectaddress=[C2] connectport=443
This specific portproxy config = Volt Typhoon signature behavior`,
            logSources: [
              { 
                source: 'Sysmon EID 1', 
                indicator: 'ntdsutil.exe with\n\'ifm\' argument\n(Volt Typhoon specific)', 
                query: 'ProcessName=ntdsutil.exe\nCommandLine=*ifm*\nCommandLine=*create full*' 
              },
              { 
                source: 'Sysmon EID 1', 
                indicator: 'netsh portproxy\nadd v4tov4 command\n(Their C2 tunnel)', 
                query: 'ProcessName=netsh.exe\nCommandLine=*portproxy*\nCommandLine=*v4tov4*' 
              },
              { 
                source: 'Sysmon EID 3', 
                indicator: 'Outbound to SOHO\nrouter IP ranges\nwithout SNI', 
                query: 'dest_ip IN [SOHO ranges]\nNOT tls.server_name=*\ndest_port=443' 
              },
              { 
                source: 'Windows EID\n4688', 
                indicator: 'net commands in\nspecific sequence\nwithin 5 min window', 
                query: 'EventCode=4688\nsequence detection\nwithin 300 seconds' 
              },
              { 
                source: 'Fortinet Logs', 
                indicator: 'CVE-2022-40684\nauth bypass attempt\non SSL VPN', 
                query: 'action=ssl-vpn-login\nanomaly=true\nuri=*/api/v2/*' 
              },
              { 
                source: 'NTDS/AD Logs', 
                indicator: 'ntdsutil snapshot\nVSS shadow access\nto NTDS.dit', 
                query: 'EventCode=4769\nServiceName=ntds*' 
              }
            ],
            huntingSteps: [
              { step: 'Identify IFM shadow copy extraction', description: 'Look for ntdsutil.exe executing the "ifm create full" command which dumps the AD database.' },
              { step: 'Search for unauthorized port proxies', description: 'Hunt for netsh.exe configuring v4tov4 port proxies to bypass internal network segmentation.' },
              { step: 'Analyze network telemetry for SOHO C2 proxying', description: 'Look for outbound TLS connections to residential IP space that lack standard Server Name Indication (SNI) headers.' },
              { step: 'Correlate with initial access vectors', description: 'Check perimeter logs for exploitation of Fortinet CVE-2022-40684 around the time of the initial LotL activity.' }
            ],
            triageQuery: `| Comment: VOLT TYPHOON HUNTER v2.0
| Comment: Detects specific LotL sequence
| Comment: ntdsutil + netsh + net commands

index=windows sourcetype=sysmon
earliest=-7d
(
  (EventCode=1 
   ProcessName="*\\\\ntdsutil.exe"
   CommandLine="*ifm*" 
   CommandLine="*create full*")
  OR
  (EventCode=1
   ProcessName="*\\\\netsh.exe"
   CommandLine="*portproxy*"
   CommandLine="*v4tov4*")
  OR
  (EventCode=1
   ProcessName IN (
     "*\\\\net.exe",
     "*\\\\net1.exe")
   CommandLine IN (
     "*group /domain*",
     "*user /domain*"))
)

| eval technique=case(
    ProcessName="*ntdsutil*","T1003.003-NTDS",
    ProcessName="*netsh*" AND 
    CommandLine="*portproxy*","T1090.001-Proxy",
    ProcessName="*net*" AND 
    CommandLine="*/domain*","T1069-Discovery",
    true(),"Unknown")

| eval severity=case(
    technique="T1003.003-NTDS","CRITICAL",
    technique="T1090.001-Proxy","HIGH",
    true(),"MEDIUM")

| eval volt_typhoon_confidence=case(
    ProcessName="*ntdsutil*" AND
    CommandLine="*ifm*","95%",
    ProcessName="*netsh*" AND
    CommandLine="*portproxy*","87%",
    true(),"60%")

| stats 
    count as event_count,
    values(technique) as techniques,
    values(CommandLine) as commands,
    dc(host) as affected_hosts,
    max(severity) as max_severity,
    first(volt_typhoon_confidence) 
      as vt_confidence
    by host, user, ParentProcessName

| where event_count > 0

| eval risk_score=case(
    max_severity="CRITICAL" AND 
    event_count > 3, 100,
    max_severity="HIGH", 75,
    true(), 50)

| sort -risk_score

| table 
    host, user, 
    affected_hosts,
    techniques,
    commands,
    event_count,
    max_severity,
    vt_confidence,
    risk_score

| rename 
    host as "Affected Host",
    user as "User Account",
    techniques as "MITRE Techniques",
    max_severity as "Severity",
    vt_confidence as "VT Confidence %",
    risk_score as "Risk Score"`,
            falsePositives: 'ntdsutil ifm = almost never FP (highly suspicious if run outside of standard backup scripts/servers). netsh portproxy = verify against IT tickets (sometimes used for legacy app routing). Net commands = verify against ITSM (domain admins performing normal enumeration).'
          },
          references: ['https://www.cisa.gov/news-events/cybersecurity-advisories/aa24-038a', 'https://www.microsoft.com/en-us/security/blog/2023/05/24/volt-typhoon/'],
          iocs: [
            { type: 'IP', value: '192.168.1.5', context: 'Known compromised SOHO router used as proxy' },
            { type: 'Command', value: 'netsh interface portproxy add v4tov4', context: 'LotL execution method' }
          ],
          hypotheses: [
            {
              hypoName: 'Detect ntdsutil.exe AD Extraction',
              description: 'Volt Typhoon extracts NTDS.dit using ntdsutil.exe. This is rarely used by legitimate admins outside of Domain Controllers and scheduled backup tasks.',
              mitreId: 'T1003.003',
              tactic: 'Credential Access (TA0006)',
              platform: 'Windows',
              dataSource: 'Process Creation',
              actorContext: 'This technique is used in Phase 3 of Volt Typhoon attack chain. SPECIFICALLY they use ntdsutil.exe NOT vssadmin (other actors use this). If you find ntdsutil with ifm args = HIGH CONFIDENCE Volt Typhoon.',
              confidence: 'HIGH 94%',
              source: 'CISA AA23-144A + NSA Advisory',
              lastSeen: 'Active as of May 2026',
              huntingLogic: '1. Run query in last 90 days\n2. Focus on non-IT user accounts\n3. Check ParentProcess (should NOT be backup software)\n4. Correlate with VPN auth logs ±48 hours of this event\n5. If found → CRITICAL escalation',
              falsePositiveRisk: 'LOW: ntdsutil ifm is rarely used legitimately. If seen = investigate.',
              truePositiveAction: '🚨 Escalate to IR immediately\n🚨 Assume full AD compromise\n🚨 Reset ALL domain admin passwords',
              splunkSPL: 'index=windows sourcetype="WinEventLog:Security" EventCode=4688 ProcessName="*\\\\ntdsutil.exe" CommandLine="*ifm create full*"'
            },
            {
              hypoName: 'Detect netsh.exe PortProxy Configuration',
              description: 'Attackers use netsh.exe to configure port proxies (v4tov4) to pivot through internal network segments.',
              mitreId: 'T1090',
              tactic: 'Command and Control',
              huntingLogic: 'Look for process creation events for netsh.exe with command line arguments containing "interface portproxy add v4tov4".',
              splunkSPL: 'index=windows (sourcetype="WinEventLog:Security" EventCode=4688 OR sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1) ProcessName="*\\\\netsh.exe" CommandLine="*interface portproxy add v4tov4*"'
            },
            {
              hypoName: 'Detect Anomalous Network Discovery via net.exe',
              description: 'Volt Typhoon uses native net.exe commands in rapid succession to map users, groups, and network shares.',
              mitreId: 'T1087.002',
              tactic: 'Discovery',
              huntingLogic: 'Identify instances of net.exe or net1.exe executing commands like "user", "group", or "use" rapidly from a single host.',
              splunkSPL: 'index=windows sourcetype="WinEventLog:Security" EventCode=4688 (ProcessName="*\\\\net.exe" OR ProcessName="*\\\\net1.exe") | stats count by host, user, _time | where count > 5'
            },
            {
              hypoName: 'Detect Outbound TLS Without SNI',
              description: 'C2 traffic proxied through SOHO routers often lacks the Server Name Indication (SNI) header in the TLS handshake.',
              mitreId: 'T1071.001',
              tactic: 'Command and Control',
              huntingLogic: 'Query Zeek, Suricata, or advanced firewall logs for outbound port 443 traffic where the SNI field is empty or malformed.',
              splunkSPL: 'index=network sourcetype="zeek_ssl" dest_port=443 server_name="-" OR server_name="" | stats count by src_ip, dest_ip'
            }
          ]
        },
        {
          id: 'atk-002',
          name: 'Ivanti Connect Secure Zero-Day (CVE-2023-46805 & CVE-2024-21887)',
          date: '2026-05-25',
          metadata: {
            actor: 'UNC5221 (Suspected)',
            aliases: 'Unknown / Emerging',
            origin: 'Unknown (Suspected PRC nexus)',
            activeSince: 'December 2023',
            targetSector: 'Government, Defense, Aerospace, Tech',
            dwellTime: 'Rapid exploitation & persistence',
            sophistication: 'Advanced / Zero-Day capability',
            cisaAlert: 'ED 24-01 (Jan 2024)',
            confidence: 'HIGH 90%'
          },
          poc: {
            hypothesis: `Ivanti Connect Secure Zero-Day (CVE-2023-46805 & CVE-2024-21887) exploitation follows a HIGHLY SPECIFIC sequence targeting unpatched edge appliances:

PHASE 1 — Initial Access (Specific):
Exploits CVE-2023-46805 (Authentication Bypass via Path Traversal).
The attacker sends a specific URI path traversal request:
GET /api/v1/totp/user-backup/../../system/system-information
This exact string bypasses the authentication filter on the REST API.

PHASE 2 — Execution (Specific):
Chains with CVE-2024-21887 (Command Injection).
The attacker injects a python or bash payload into the vulnerable \`license/keys-status/\` endpoint.
Uses the internal Node.js web service to spawn the payload:
node.js spawns python -c "import pty;pty.spawn('/bin/bash')"

PHASE 3 — Persistence (Specific):
Drops customized web shells (e.g. GLASSTOKEN or GIFTEDVISITOR).
Specifically written to: /api/v1/cav/client/status OR modifies internal perl files like /home/perl/DSUpgrade.pm.
This survives standard reboots and partial system upgrades.

PHASE 4 — C2 & Post-Exploitation (Specific):
The compromised VPN appliance initiates anomalous OUTBOUND traffic over port 80/443 to download secondary payloads.
Typically uses internal curl or wget binaries to pull rust-based payloads from attacker infrastructure.`,
            logSources: [
              { 
                source: 'Web Server\nAccess Logs', 
                indicator: 'URI Path Traversal\ntargeting TOTP\nand License APIs', 
                query: 'status=200\nuri_path=*/api/v1/totp/user-backup*\nuri_path=*keys-status*' 
              },
              { 
                source: 'Sysmon EID 1\n(Process Creation)', 
                indicator: 'Node.js spawning\nPython, bash, or\ncurl processes', 
                query: 'ParentProcess=node\nProcessName IN (python, bash, curl, wget)' 
              },
              { 
                source: 'File Integrity\nMonitoring (FIM)', 
                indicator: 'Webshell dropped\nin appliance\nwebroot', 
                query: 'action="created"\nfile_path="*/api/v1/cav/client/status"\nOR file_path="*/home/perl/DSUpgrade.pm"' 
              }
            ],
            huntingSteps: [
              { step: 'Search for authentication bypass attempts', description: 'Look for HTTP GET/POST requests containing path traversal sequences (e.g., /../) directed at the /api/v1/totp/user-backup endpoint.' },
              { step: 'Identify execution of command injection payload', description: 'Hunt for Node.js or internal web processes spawning unexpected interactive shells, network utilities (curl/wget), or python socket scripts.' },
              { step: 'Analyze FIM for webshell persistence', description: 'Check appliance filesystem alerts for newly created or modified files specifically targeting /api/v1/cav/client/status or patched perl files like /home/perl/DSUpgrade.pm.' },
              { step: 'Correlate with anomalous VPN connections', description: 'Review VPN gateway logs for unauthorized administrative configuration changes immediately following the suspicious web requests.' }
            ],
            triageQuery: `| Comment: IVANTI ZERO-DAY HUNTER v2.0
| Comment: Detects CVE-2023-46805 & CVE-2024-21887
| Comment: Path traversal + webshell drops

index=* (sourcetype="access_combined" OR sourcetype="sysmon" OR sourcetype="fim")
earliest=-7d
(
  (uri_path="*/api/v1/totp/user-backup*" OR uri_path="*keys-status*")
  OR
  (EventCode=1 ParentProcess="node" ProcessName IN ("python", "bash", "curl", "wget"))
  OR
  (action="created" (file_path="*/api/v1/cav/client/status" OR file_path="*/home/perl/DSUpgrade.pm"))
)

| eval technique=case(
    uri_path="*/api/v1/totp/user-backup*","T1190-Exploit_Public_App",
    ParentProcess="node","T1059.004-Unix_Shell",
    action="created","T1505.003-Web_Shell",
    true(),"Unknown")

| eval severity=case(
    technique="T1505.003-Web_Shell","CRITICAL",
    technique="T1059.004-Unix_Shell","HIGH",
    true(),"MEDIUM")

| eval ivanti_confidence=case(
    file_path="*/api/v1/cav/client/status","99%",
    uri_path="*/api/v1/totp/user-backup*","85%",
    true(),"65%")

| stats 
    count as event_count,
    values(technique) as techniques,
    values(uri_path) as uris,
    values(file_path) as dropped_files,
    max(severity) as max_severity,
    first(ivanti_confidence) as ivanti_confidence
    by host, src_ip

| where event_count > 0

| eval risk_score=case(
    max_severity="CRITICAL", 100,
    max_severity="HIGH" AND event_count > 2, 85,
    true(), 50)

| sort -risk_score

| table 
    host, src_ip, 
    techniques,
    uris,
    dropped_files,
    event_count,
    max_severity,
    ivanti_confidence,
    risk_score

| rename 
    host as "Affected VPN Appliance",
    src_ip as "Attacker IP",
    techniques as "MITRE Techniques",
    max_severity as "Severity",
    ivanti_confidence as "Ivanti Confidence %",
    risk_score as "Risk Score"`,
            falsePositives: 'Authorized Ivanti system updates, patch installations, or administrative diagnostic scripts initiated by authorized network administrators. Internal vulnerability scanners may also generate path traversal signatures. Legitimate perl upgrades applied by Ivanti patch management.'
          },
          references: ['https://forums.ivanti.com/s/article/Security-Update'],
          iocs: [
            { type: 'Hash', value: '3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', context: 'Web shell payload (GLASSTOKEN)' },
            { type: 'Domain', value: 'api.threat-actor-c2.net', context: 'C2 beaconing domain' }
          ],
          hypotheses: [
            {
              hypoName: 'Detect Node.js Spawning Suspicious Shells',
              description: 'The Ivanti command injection payload causes the internal Node.js service to spawn bash or python scripts for reverse shells.',
              mitreId: 'T1059.004',
              tactic: 'Execution',
              huntingLogic: 'Query EDR or process logs for node or httpd processes acting as the parent process to shell interpreters or download utilities.',
              splunkSPL: 'index=edr (parent_process="node" OR parent_process="httpd") process_name IN ("bash", "sh", "python", "curl", "wget")'
            },
            {
              hypoName: 'Detect Malicious Web Shell File Creation',
              description: 'Look for new files created or modified in specific known web shell paths used in the Ivanti zero-day exploit chain.',
              mitreId: 'T1505.003',
              tactic: 'Persistence',
              huntingLogic: 'Utilize FIM logs to monitor the appliance directory structure for file creation events matching known actor web shell drop locations.',
              splunkSPL: 'index=fim action="created" (file_path="*/api/v1/cav/client/status*" OR file_path="*/home/perl/DSUpgrade.pm*")'
            },
            {
              hypoName: 'Detect ICS TOTP Path Traversal',
              description: 'Identify the CVE-2023-46805 authentication bypass via path traversal targeting the TOTP and License backup APIs.',
              mitreId: 'T1190',
              tactic: 'Initial Access',
              huntingLogic: 'Scan web server access logs for URI paths containing the specific traversal sequences paired with the vulnerable endpoints.',
              splunkSPL: 'index=web sourcetype="access_combined" uri_path="*/api/v1/totp/user-backup*" (uri_path="*/../*" OR uri_path="*keys-status*") status=200'
            },
            {
              hypoName: 'Detect Unusual Outbound Connectivity from Appliance',
              description: 'Post-exploitation, the compromised VPN appliance initiates outbound network connections to attacker infrastructure to download secondary payloads.',
              mitreId: 'T1105',
              tactic: 'Command and Control',
              huntingLogic: 'Analyze firewall logs for unexpected outbound traffic from the VPN appliance IP to non-standard, external IP addresses over HTTP/HTTPS.',
              splunkSPL: 'index=firewall src_ip="<VPN_APPLIANCE_IP>" dest_ip!="<INTERNAL_SUBNETS>" (dest_port=80 OR dest_port=443) NOT dest_ip IN (<KNOWN_IVANTI_UPDATE_SERVERS>)'
            }
          ]
        }
      ];

      setAttacks(prev => {
        // Only add dummy attacks if they don't already exist to avoid cluttering local storage
        const newAttacks = [...prev];
        dummyAttacks.forEach(dummy => {
          if (!newAttacks.some(a => a.id === dummy.id)) {
            newAttacks.push(dummy);
          }
        });
        localStorage.setItem('thboard_live_attacks', JSON.stringify(newAttacks));
        return newAttacks;
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentAttacks();
  }, [fetchRecentAttacks]);

  return {
    attacks,
    isFetching,
    isGenerating,
    lastUpdated,
    fetchRecentAttacks,
    generateLiveAttack,
    savedLibrary,
    saveHypothesis
  };
};
