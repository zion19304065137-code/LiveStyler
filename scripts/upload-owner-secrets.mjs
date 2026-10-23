import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const values={};for(const line of fs.readFileSync('.dev.vars','utf8').split(/\r?\n/)){if(!line.trim()||line.trim().startsWith('#'))continue;const i=line.indexOf('=');if(i>0)values[line.slice(0,i).trim()]=line.slice(i+1).trim();}
for(const k of ['TEXT_AI_API_KEY','IMAGE_AI_API_KEY','TEXT_AI_BASE_URL','IMAGE_AI_BASE_URL','TEXT_AI_MODEL','IMAGE_AI_MODEL','POLYV_VAULT_KEY','SESSION_SECRET'])if(!values[k])throw Error('Missing '+k);
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config','wrangler.jsonc'],{input:JSON.stringify(values),stdio:['pipe','inherit','inherit']});process.exit(result.status??1);
