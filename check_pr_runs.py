import json
d = json.load(open(r'C:\Users\23116\AppData\Local\Temp\actions_pr.json'))
runs = d['workflow_runs']
for r in runs[:5]:
    rid = r['id']
    name = r['name']
    status = r['status']
    conclusion = r.get('conclusion', 'N/A')
    sha = r['head_sha'][:8]
    event = r['event']
    print(f'{name:35s} | id={rid:12d} | status={status:15s} | conclusion={str(conclusion):10s} | event={event:15s} | sha={sha}')