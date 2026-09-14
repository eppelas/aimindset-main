"""Send exact-save receipts using a short-lived GitHub Actions identity token."""
import json
import os
import urllib.parse
import urllib.request

ORIGIN = 'https://aimindset-wild.web.app'
AUDIENCE = ORIGIN + '/editor-sync'


def oidc_token():
    endpoint = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL')
    token = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    if not endpoint or not token:
        if os.environ.get('GITHUB_ACTIONS') == 'true':
            raise RuntimeError('This workflow needs id-token: write for sync receipts')
        return None
    endpoint += ('&' if '?' in endpoint else '?') + urllib.parse.urlencode({'audience': AUDIENCE})
    request = urllib.request.Request(endpoint, headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(request, timeout=20) as response:
        value = json.load(response).get('value')
    if not isinstance(value, str) or len(value.split('.')) != 3:
        raise RuntimeError('GitHub did not return an identity token')
    return value


def report(snapshot, state, commit=None, error=None):
    token = oidc_token()
    if not token:
        return
    if isinstance(snapshot, (list, tuple)):
        snapshot = snapshot[0]
    payload = {key: snapshot[key] for key in ('object', 'rev', 'sha')}
    payload['state'] = 'error' if state == 'failed' else state
    if commit:
        payload['commit'] = commit
    # Detailed failure output stays in the workflow log, never the public API.
    request = urllib.request.Request(ORIGIN + '/__sync-report', method='POST', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=25) as response:
        result = json.load(response)
    if result.get('ok') is not True:
        raise RuntimeError('Publisher did not acknowledge the sync receipt')
