import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
export function verifiedMainCommit(sha,runs){return /^[a-f0-9]{40}$/.test(sha)&&Array.isArray(runs?.workflow_runs)&&runs.workflow_runs.some(r=>r.head_sha===sha&&r.head_branch==='main'&&r.event==='push'&&r.status==='completed'&&r.conclusion==='success'&&r.head_repository?.full_name==='axxes-club/developer.axxes.club')}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(!verifiedMainCommit(process.argv[2],JSON.parse(readFileSync(process.argv[3],'utf8')))){console.error('Cloud release requires successful exact-commit main CI');process.exitCode=1}}
