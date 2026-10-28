const fs = require('node:fs');
const base = '/Users/zeke/.nvm/versions/node/v20.12.1/lib/node_modules/firebase-tools/lib/';
(async () => {
  const project = process.argv[2];
  if (!['docketstamp','docketstamp-staging'].includes(project)) throw Error('Unexpected project');
  const auth = require(base + 'auth');
  const opts = {project, nonInteractive:true};
  auth.setActiveAccount(opts, auth.getProjectDefaultAccount('/Users/zeke/code/DocketStamp') || auth.getGlobalDefaultAccount());
  await require(base + 'requireAuth').requireAuth(opts);
  const api = require(base + 'gcp/apphosting');
  const {Client} = require(base + 'apiv2');
  const run = new Client({urlPrefix:'https://run.googleapis.com',auth:true,apiVersion:'v2'});
  const root = `projects/${project}/locations/us-central1/backends/docketstamp`;
  const [builds,rollouts,traffic,runtime] = await Promise.all([
    api.listBuilds(project,'us-central1','docketstamp'),
    api.listRollouts(project,'us-central1','docketstamp'),
    api.client.get(root+'/traffic').then(r=>r.body),
    run.get(`projects/${project}/locations/us-central1/services/docketstamp`).then(r=>r.body),
  ]);
  const select = (items,fields) => items.sort((a,b)=>b.createTime.localeCompare(a.createTime)).slice(0,3).map(x=>Object.fromEntries(fields.map(f=>[f,x[f]])));
  const result = {checkedAt:new Date().toISOString(),project,traffic,
    builds:select(builds.builds,['name','state','errors','createTime','source']),
    rollouts:select(rollouts.rollouts,['name','state','build','createTime','updateTime','error']),
    readyRevision:runtime.latestReadyRevision,condition:runtime.terminalCondition,
    publicEnvironment:(runtime.template?.containers||[]).flatMap(c=>c.env||[]).filter(e=>['ENVIRONMENT','NEXT_PUBLIC_APP_URL','LOB_ENV'].includes(e.name)).map(e=>({name:e.name,value:e.value})),
  };
  if(process.argv[3]) fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({project,build:result.builds[0]?.name,buildState:result.builds[0]?.state,sourceHash:result.builds[0]?.source?.codebase?.hash,rollout:result.rollouts[0]?.name,rolloutState:result.rollouts[0]?.state,readyRevision:result.readyRevision,publicEnvironment:result.publicEnvironment},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
