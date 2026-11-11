const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const code=fs.readFileSync(require('path').join(__dirname,'../background.js'),'utf8');
const fakeSettings={apiKey:'TEST_KEY',model:'gemini-3.6-flash',fallbackOnOverload:false};
const callbacks={};
let attempts=0;
const fetch=async(url,opts)=>{
  if(url.includes('?pageSize=')) return {
    ok:true,headers:{get:()=>null},json:async()=>({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]})
  };
  attempts++;
  if(attempts===1) return {ok:false,status:503,statusText:'Busy',headers:{get:()=>null},json:async()=>({error:{message:'High demand'}})};
  return {ok:true,status:200,headers:{get:()=>null},json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({choices:[0,2],text:'',grid:[]})}]}}]})};
};
const ext={
 storage:{local:{get:async defaults=>({...defaults,...fakeSettings}),set:async values=>Object.assign(fakeSettings,values)}},
 commands:{onCommand:{addListener:fn=>callbacks.command=fn}},
 runtime:{onMessage:{addListener:fn=>callbacks.message=fn}},
 tabs:{query:async()=>[],sendMessage:async()=>({started:true})}
};
const context=vm.createContext({browser:ext,fetch,setTimeout,clearTimeout,AbortController,console,Date,Promise,JSON,Math,String,Array,Number,Error,encodeURIComponent});
vm.runInContext(code,context);
const send=type=>new Promise(resolve=>callbacks.message({type,question:{type:'checkbox',question:'Choose colors',options:['red','green','blue']}},{},resolve));
(async()=>{
 const result=await send('GFA_ASK_ONE');
 assert(result.ok,JSON.stringify(result));
 assert.equal(result.model,'gemini-3.8-flash');
 assert.deepEqual(Array.from(result.answer.choices),[0,2]);
 assert.equal(result.attempts,2);
 assert.equal(attempts,2);
 const list=await send('GFA_MODELS');
 assert(list.ok&&list.models.length===1);
 const test=await send('GFA_TEST');
 assert(test.ok);
 assert.equal(fakeSettings.gfaMigrated16,true);
 console.log('PASS: Gemini 503 retry, stored model migration 3.6->3.8, choices, dynamic models, test connection');
})().catch(e=>{console.error(e);process.exit(1)});
