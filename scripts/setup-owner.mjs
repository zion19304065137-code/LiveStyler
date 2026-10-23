import fs from 'node:fs';import {randomBytes} from 'node:crypto';
const path='.dev.vars';if(fs.existsSync(path)){console.log('.dev.vars already exists; kept unchanged.');process.exit(0);}
let text=fs.readFileSync('.dev.vars.example','utf8').replace('POLYV_VAULT_KEY=','POLYV_VAULT_KEY='+randomBytes(32).toString('hex')).replace('SESSION_SECRET=','SESSION_SECRET='+randomBytes(32).toString('hex'));fs.writeFileSync(path,text,{mode:0o600});console.log('Created private .dev.vars. Owner: fill the two API keys, then upload secrets. Visitors do not configure AI.');
