const fs=require('fs');const vm=require('vm');const assert=require('assert');
const code=fs.readFileSync(require('path').join(__dirname,'../background.js'),'utf8');
let receiver=true;let injects=0;let runs=0;const commands={};const saved={};
const ext={
  storage:{local:{get:async defaults=>({...defaults}),set:async values=>Object.assign(saved,values)}},
  commands:{onCommand:{addListener:fn=>commands.onShortcut=fn}},
  runtime:{onMessage:{addListener:()=>{}}},
  tabs:{query:async()=>[{id:31,url:'https://docs.google.com/forms/d/e/example/viewform'}],
    get:async id=>({id,url:'https://docs.google.com/forms/d/e/example/viewform'}),
    sendMessage:async (id,msg)=>{
      assert.strictEqual(id,31);
      if(!receiver)throw Error('Could not establish connection. Receiving end does not exist.');
      if(msg.type==='GFA_PING')return {ready:true};
      if(msg.type==='GFA_RUN'){runs++;return {started:true,count:1};}
    }
  },
  scripting:{executeScript:async opts=>{assert.deepStrictEqual(Array.from(opts.files),['content.js']);injects++;receiver=true},
    insertCSS:async()=>{}}
};
const ctx=vm.createContext({browser:ext,fetch:async()=>{},setTimeout,clearTimeout,AbortController,console,Date,Promise,JSON,Math,String,Array,Number,Error,encodeURIComponent});
vm.runInContext(code,ctx);
(async()=>{
  await commands.onShortcut('fill-google-form',{id:31});
  assert.equal(runs,1);assert.equal(injects,0);
  receiver=false;
  await commands.onShortcut('fill-google-form',{id:31});
  assert.equal(runs,2);assert.equal(injects,1);
  receiver=false;
  await commands.onShortcut('fill-google-form',{id:31});
  assert.equal(runs,3);assert.equal(injects,2);
  assert(!saved.lastRun?.detail?.includes('Shortcut failed'));
  console.log('PASS: Safari tab without URL, repeated commands, missing receiver recovery');
})().catch(e=>{console.error(e);process.exit(1)});
