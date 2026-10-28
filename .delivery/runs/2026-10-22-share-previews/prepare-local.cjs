const fs = require('node:fs');
const base = '/Users/zeke/.nvm/versions/node/v20.12.1/lib/node_modules/firebase-tools/lib/';
(async()=>{
 const project='docketstamp-staging';
 const auth=require(base+'auth');const opts={project,nonInteractive:true};
 auth.setActiveAccount(opts,auth.getProjectDefaultAccount('/Users/zeke/code/DocketStamp')||auth.getGlobalDefaultAccount());
 await require(base+'requireAuth').requireAuth(opts);
 const response=await require(base+'gcp/secretManager').accessSecretVersion(project,'firebase-web-api-key','latest');
 const apiKey=typeof response==='string'?response:Buffer.from(response.payload.data,'base64').toString();
 const crypto=require('node:crypto');
 if(crypto.createHash('sha256').update(apiKey).digest('hex')!=='13911b0cd2a264c0f632b0f9a56417811a8e02cba25eb21167bbec1d212c2eb6')throw Error('Unexpected public web key identity');
 const env=['NEXT_PUBLIC_FIREBASE_API_KEY='+apiKey,'NEXT_PUBLIC_FIREBASE_PROJECT_ID=docketstamp-staging','FIREBASE_PROJECT_ID=docketstamp-staging','ENVIRONMENT=staging','NEXT_PUBLIC_APP_URL=http://127.0.0.1:3124','NEXT_TELEMETRY_DISABLED=1'].join('\n')+'\n';
 fs.writeFileSync('/private/tmp/docketstamp-share-release-20261022/.env.local',env,{mode:0o600});
 console.log('Prepared ignored local build environment with the existing public staging web identity. No server secrets loaded.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
