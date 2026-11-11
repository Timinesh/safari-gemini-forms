"use strict";

(() => {
  if (globalThis.__safariGeminiV17) return;
  globalThis.__safariGeminiV17 = true;
  const ext = globalThis.browser ?? globalThis.chrome;
  const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
  const text = el => String(el?.innerText || el?.textContent || "").replace(/\s+/g," ").trim();
  const stateOf = new WeakMap();
  const buttons = new WeakMap();
  const MAX = 45;
  let timer = null;
  let tasks = Promise.resolve();
  let activeRun = null;
  let sectionKey = null;
  let sectionGeneration = 0;
  let blockCounter = 0;
  const blockIds = new WeakMap();

  function visible(el) {
    if (!el?.isConnected) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none" &&
      (el.getClientRects().length>0 || style.position === "fixed");
  }

  function title(block) {
    for (const sel of [".M7eMe", ".HoXoMd", "[role='heading']", "h2", "h3"]) {
      for (const el of block.querySelectorAll(sel)) {
        if (visible(el) && text(el)) return text(el).replace(/\s*\*\s*$/," ").trim().slice(0,1500);
      }
    }
    return (block.innerText || "").split("\n").map(s=>s.trim()).find(Boolean)?.slice(0,1500) || "";
  }

  function optionText(el) {
    for (const attr of ["data-answer-value","data-value","aria-label"]) {
      const v = el.getAttribute(attr)?.trim();
      if (v && !/^(other|__other_option__|option \d+ of \d+)$/i.test(v)) return v.slice(0,700);
    }
    for (const sel of [".aDTYNe",".docssharedWizToggleLabeledLabelText","label"]) {
      const holder = el.closest(sel) || el.parentElement?.querySelector(sel);
      if (holder && text(holder)) return text(holder).slice(0,700);
    }
    let p=el.parentElement;
    for(let i=0;p&&i<5;i++,p=p.parentElement) {
      const c = p.querySelectorAll('[role="radio"], [role="checkbox"]');
      if(c.length === 1 && text(p)) return text(p).slice(0,700);
      if(c.length>1) break;
    }
    return "";
  }

  function controls(el,kind) {
    const all = [...el.querySelectorAll(`[role="${kind}"],input[type="${kind}"]`)].filter(visible);
    return all.filter(x=>!all.some(a=>a!==x&&a.contains(x)));
  }

  function typeFromMetadata(block) {
    const raw = block.querySelector('[jsmodel="CP1oW"]')?.getAttribute("data-params") || "";
    const code = raw.match(/^%\.@\.\[\d+,"[^"]*",null,(\d+),/);
    const t = Number(code?.[1]);
    if (!code) return null;
    if (t===0) return "text";
    if (t===1) return "text";
    if (t===2) return "radio";
    if (t===3) return "dropdown";
    if (t===4) return "checkbox";
    if (t===5) return "scale";
    if (t===7) return /,\[true\]/.test(raw) ? "checkbox_grid":"radio_grid";
    if (t===9) return "date";
    if (t===10) return "time";
    if (t===13) return "unsupported";
    if (t===18) return "rating";
    return null;
  }

  function readQuestion(block) {
    if (!visible(block)) return null;
    const question = title(block);
    if(!question) return null;
    const radio=controls(block,"radio"), checks=controls(block,"checkbox");
    let type=typeFromMetadata(block), arr=[], options=[];
    if(type === "unsupported") return null;
    if(!type) {
      if(radio.length>=2&&!checks.length)type="radio";
      else if(checks.length>=2&&!radio.length)type="checkbox";
      else if(block.querySelector('[role="listbox"]'))type="dropdown";
      else if(!radio.length&&!checks.length&&block.querySelector('input[type="text"],textarea'))type="text";
      else return null;
    }
    if (["radio","scale","rating"].includes(type)) {
      arr=type==="rating" ? [...block.querySelectorAll('label[data-ratingscale]')] : radio;
      if(type==="rating")options=arr.map(e=>e.getAttribute('data-ratingscale'));
      else options=arr.map(optionText);
    } else if(type==="checkbox") {arr=checks; options=arr.map(optionText);}
    else if(type==="dropdown") {
      arr=[...block.querySelectorAll('[role="option"][data-value]')].filter(x=>x.getAttribute('data-value'));
      options=arr.map(e=>e.getAttribute('data-value'));
    } else if(type==="text") {
      arr=[...block.querySelectorAll('textarea,input[type="text"]')].filter(e=>visible(e)&&!e.disabled&&!e.readOnly);
      if(arr.length!==1) return null;
    } else if(type==="radio_grid"||type==="checkbox_grid") {
      const groups=[...block.querySelectorAll(type==="radio_grid" ? '[role="radiogroup"]':'[role="group"]')];
      const rowLabels=groups.map(g=>g.getAttribute("aria-label") || text(g.querySelector('.V4d7Ke.wzWPxe')));
      const header=block.querySelector(".KZt9Tc");
      const cols=header ? [...header.querySelectorAll(".V4d7Ke.OIC90c")].map(text).filter(Boolean) : [];
      if(!rowLabels.length||!cols.length)return null;
      arr=groups;options={rows:rowLabels,columns:cols};
    } else if(type==="date") {
      arr=[...block.querySelectorAll('input[type="date"]')];
      if(!arr.length) return null;
    } else if(type==="time") {
      arr=[...block.querySelectorAll('input')].filter(e=>e.type!=="hidden"&&visible(e));
      if(arr.length<2)return null;
    }
    if(["radio","checkbox","scale","rating","dropdown"].includes(type) && (!arr.length || options.some(x=>!x))) return null;
    const imageUrl=block.querySelector('.gCouxf img')?.src || null;
    return {block,question,type,options,arr,imageUrl};
  }

  function findQuestions() {
    const candidates=[...document.querySelectorAll('.o3Dpx .Qr7Oae, .Qr7Oae, .freebirdFormviewerComponentsQuestionBaseRoot')].filter(visible);
    const roots=candidates.filter(el=>!candidates.some(parent=>parent!==el&&parent.contains(el)));
    return roots.map(readQuestion).filter(Boolean).slice(0,MAX);
  }

  function answered(q) {
    if(["radio","checkbox","scale"].includes(q.type))return q.arr.some(isChecked);
    if(q.type==="rating")return q.arr.some(el=>[...el.querySelectorAll('[role="radio"]')].some(isChecked));
    if(q.type==="text"||q.type==="date"||q.type==="time")return q.arr.every(el=>!!el.value?.trim());
    if(q.type==="dropdown") return q.arr.some(el=>el.getAttribute("aria-selected")==="true"&&el.getAttribute("data-value"));
    if(q.type.endsWith("grid"))return q.arr.every(g=>!!g.querySelector('[aria-checked="true"]'));
    return false;
  }

  function isChecked(control) {
    if(control.matches?.('input[type="radio"],input[type="checkbox"]'))return !!control.checked;
    return control.getAttribute("aria-checked")==="true";
  }

  const states={
    ready:["✦","Ready — click to ask Gemini for this question"],
    prefilled:["↻","Already answered — click to ask Gemini and replace this answer"],
    working:["⟳","Gemini is processing this question"],
    success:["✓","Gemini answered and the form selection was verified — click to regenerate"],
    failure:["!","Answer failed — click to retry"],
    skipped:["−","Gemini could not determine an answer — click to retry"]
  };

  function status(q,state,detail="") {
    stateOf.set(q.block,{state,detail});
    const button=buttons.get(q.block);
    if (!button)return;
    button.dataset.state=state;
    button.textContent=states[state][0];
    button.title=detail ? `${states[state][1]}\n${detail}` : states[state][1];
    button.setAttribute("aria-label",button.title);
  }

  function mount(q) {
    if(buttons.get(q.block)?.isConnected)return;
    const host=q.block.querySelector('.z12JJ') || q.block.querySelector('.M7eMe')?.parentElement || q.block;
    if(!host)return;
    const button=document.createElement("button");
    button.className="sgfa-status";
    button.type="button";
    button.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();
      queueOne(q,true);
    });
    host.appendChild(button);
    buttons.set(q.block,button);
    const remembered=stateOf.get(q.block);
    status(q,remembered?.state || (answered(q)?"prefilled":"ready"),remembered?.detail || "");
  }

  function fingerprint(questions) {
    return questions.map(q => {
      if (!blockIds.has(q.block)) blockIds.set(q.block,++blockCounter);
      return `${blockIds.get(q.block)}:${q.type}:${q.question}`;
    }).join("|");
  }

  function syncSection() {
    const questions = findQuestions();
    const key = fingerprint(questions);
    // Forms may replace a section without navigating the tab. Cancel the old
    // section's queue so a 503/backoff on that section cannot block Next/Back.
    if (key !== sectionKey) {
      sectionKey = key;
      sectionGeneration++;
      tasks = Promise.resolve();
      activeRun = null;
    }
    return questions;
  }

  function refresh() {
    const questions = syncSection();
    questions.forEach(mount);
    return questions;
  }

  async function waitForQuestions() {
    let questions = refresh();
    for (let i = 0; !questions.length && i < 18; i++) {
      await sleep(200);
      questions = refresh();
    }
    return questions;
  }

  function findTargets(el) {
    const items=[el];
    let node=el.parentElement;
    for(let i=0;node&&i<6;i++,node=node.parentElement) {
      const number=node.querySelectorAll('[role="radio"],[role="checkbox"],input[type="radio"],input[type="checkbox"]').length;
      if(number===1)items.push(node);else break;
    }
    const label=el.closest('label');if(label)items.push(label);
    return [...new Set(items.filter(e=>typeof e.click==="function"))];
  }

  async function clickUntil(el,shouldBeChecked) {
    if(isChecked(el)===shouldBeChecked)return true;
    for(const target of findTargets(el)) {
      target.click();
      await sleep(85);
      if(isChecked(el)===shouldBeChecked)return true;
    }
    return false;
  }

  function indices(raw,max,multi=false) {
    if(!Array.isArray(raw))throw new Error("Gemini supplied no choice indices");
    const unique=[...new Set(raw)];
    if(!unique.length||!unique.every(i=>Number.isInteger(i)&&i>=0&&i<max))throw new Error("No valid answer choice returned");
    return multi ? unique : unique.slice(0,1);
  }

  function setText(el,value) {
    el.focus();
    // The source repo's native setter + input/change fallback is retained for
    // React-like controlled inputs in Google Forms; never manipulate ARIA only.
    const proto=el.tagName==="TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
    if(setter)setter.call(el,value);else el.value=value;
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
    el.blur();
    if(el.value!==value)throw new Error("Google Forms did not retain text value");
  }

  async function apply(q,answer,overwrite,mode) {
    if(!q.block.isConnected)throw new Error("Form page changed before the answer arrived");
    const fresh=readQuestion(q.block);
    if(!fresh || fresh.question!==q.question || fresh.type!==q.type)throw new Error("Question changed while Gemini was processing it");
    q=fresh;
    if(answered(q)&&!overwrite)return "prefilled";
    if(["radio","checkbox","scale","rating"].includes(q.type)) {
      const selected=indices(answer.choices,q.arr.length,q.type==="checkbox"&&mode!=="one");
      if(q.type==="checkbox") {
        for(let i=0;i<q.arr.length;i++){
          const desired=selected.includes(i);
          if(overwrite||desired) {
            if(!await clickUntil(q.arr[i],desired))throw new Error(`Checkbox ${i+1} was not set`);
          }
        }
        if(!q.arr.every((el,i)=>isChecked(el)===selected.includes(i)))throw new Error("Checkbox state did not match Gemini output");
      } else {
        const target=q.type==="rating" ? q.arr[selected[0]].querySelector('[role="radio"]') : q.arr[selected[0]];
        if(!target || !await clickUntil(target,true))throw new Error("Google Forms did not accept radio selection");
      }
      return "success";
    }
    if(q.type==="dropdown") {
      const [index]=indices(answer.choices,q.arr.length);
      const target=q.arr[index];
      const listbox=q.block.querySelector('[role="listbox"]');
      listbox?.click();await sleep(70);
      target.click();await sleep(100);
      const hiddenEntries=[...q.block.querySelectorAll('input[name^="entry."]')];
      const selected=q.arr[index].getAttribute("aria-selected")==="true" ||
        hiddenEntries.some(el=>el.value===q.options[index]);
      if(!selected)throw new Error("Dropdown may not have saved selection — verify manually");
      return "success";
    }
    if(q.type==="text"||q.type==="date"||q.type==="time") {
      const value=String(answer.text||"").trim();
      if(!value)throw new Error("Gemini did not provide a text answer");
      if(q.type==="time") {
        if(!/^\d{1,2}:\d{2}$/.test(value))throw new Error("Invalid time answer");
        const [h,m]=value.split(":");
        setText(q.arr[0],h.padStart(2,"0"));setText(q.arr[1],m);
      } else setText(q.arr[0],value);
      return "success";
    }
    if(q.type.endsWith("grid")) {
      const grid=answer.grid;
      if(!Array.isArray(grid) || !grid.length)throw new Error("Gemini did not provide grid selections");
      const columns=q.options.columns;
      for(let i=0;i<q.arr.length;i++){
        const row=q.options.rows[i], picked=grid.find(v=>v.row===row);
        if(!picked)throw new Error(`No answer for grid row ${row}`);
        const controls=[...q.arr[i].querySelectorAll(q.type==="radio_grid"?'[role="radio"]':'[role="checkbox"]')];
        const ids=indices(picked.choices,columns.length,q.type==="checkbox_grid"&&mode!=="one");
        for(let j=0;j<controls.length;j++){
          const desired=ids.includes(j);
          if(q.type==="checkbox_grid"&&(overwrite||desired)){
            if(!await clickUntil(controls[j],desired))throw new Error(`Could not set row ${row}`);
          }
        }
        if(q.type==="radio_grid"){
          if(!controls[ids[0]] || !await clickUntil(controls[ids[0]],true))throw new Error(`Could not set row ${row}`);
        }
      }
      return "success";
    }
    throw new Error(`Unsupported question type: ${q.type}`);
  }

  async function record(detail,ok) {
    try {await ext.storage.local.set({lastRun:{ok,detail,when:new Date().toISOString()}});}catch(_){}
  }

  async function config() {
    return await ext.storage.local.get({fillText:false,overwrite:false,checkboxMode:"all",apiKey:""});
  }

  async function processOne(q,force=false,generation=sectionGeneration) {
    mount(q);
    const old=stateOf.get(q.block)?.state;
    if(old==="working")return "skipped";
    try {
      const cfg=await config();
      if(!cfg.apiKey)throw new Error("Save your Gemini API key in extension Settings");
      if(q.type==="text"&&!cfg.fillText&&!force) return "skipped";
      if(answered(q)&&!cfg.overwrite&&!force) {status(q,"prefilled");return "prefilled";}
      status(q,"working");
      const answer=await ext.runtime.sendMessage({type:"GFA_ASK_ONE",question:{
        question:q.question,type:q.type,options:q.options,imageUrl:q.imageUrl
      }});
      if (generation !== sectionGeneration || !q.block.isConnected) return "stale";
      if(!answer?.ok)throw new Error(answer?.error || "No response from Gemini service worker");
      const state=await apply(q,answer.answer,force||cfg.overwrite,cfg.checkboxMode);
      status(q,state,`Model: ${answer.model}; attempts: ${answer.attempts}`);
      return state;
    } catch(error) {
      if (generation !== sectionGeneration || !q.block.isConnected) return "stale";
      status(q,"failure",String(error.message||error).slice(0,350));
      await record(`Question: ${q.question.slice(0,90)}. ${String(error.message||error).slice(0,300)}`,false);
      return "failure";
    }
  }

  function queueOne(q,force=false) {
    const generation = sectionGeneration;
    tasks = tasks.then(() => {
      if (generation !== sectionGeneration || !q.block.isConnected) return "stale";
      return processOne(q,force,generation);
    }).catch(error => {
      console.warn("[Safari Gemini]",error);
      return "failure";
    });
    return tasks;
  }

  async function runAll() {
    // A shortcut during page transition is not lost: wait briefly for the
    // next section to populate, then process the NEW visible questions.
    const questions = await waitForQuestions();
    const generation = sectionGeneration;
    if (!questions.length) {
      await record("No supported questions found on this section",false);
      return;
    }
    if (activeRun?.generation === generation) {
      activeRun.rerun = true;
      return;
    }
    const run = {generation,rerun:false};
    activeRun = run;
    questions.forEach(mount);
    try {
      let filled=0,failed=0,unchanged=0;
      for (const question of questions) {
        if (run.generation !== sectionGeneration || !question.block.isConnected) return;
        const result = await queueOne(question,false);
        if (result === "success") filled++;
        else if (result === "failure") failed++;
        else unchanged++;
      }
      if (run.generation === sectionGeneration) {
        await record(`Processed ${questions.length} questions: ${filled} filled, ${failed} failed, ${unchanged} prefilled or skipped.`,failed===0);
      }
    } catch(error) {
      if (run.generation === sectionGeneration) await record(String(error.message||error),false);
    } finally {
      if (activeRun === run) {
        activeRun = null;
        if (run.rerun) void runAll();
      }
    }
  }

  ext.runtime.onMessage.addListener((msg,_sender,respond)=>{
    if (msg?.type === "GFA_PING") {
      respond({ready:true,version:"1.7",count:refresh().length});
      return false;
    }
    if(msg?.type !== "GFA_RUN") return false;
    const found=refresh();
    void runAll();
    respond({started:true,count:found.length,version:"1.7"});
    return false;
  });

  function init() {
    refresh();
    if(!document.body)return;
    const observer=new MutationObserver(mutations=>{
      // Ignore the extension's own badge insertions.
      if(mutations.every(m=>[...m.addedNodes].every(n=>n.nodeType===1 &&
        n.classList?.contains('sgfa-status'))))return;
      clearTimeout(timer);timer=setTimeout(refresh,180);
    });
    // Observe the document root: Google Forms can replace the entire body
    // while navigating between sections in the same tab.
    observer.observe(document.documentElement,{childList:true,subtree:true});
    addEventListener("pageshow",refresh);
    addEventListener("popstate",refresh);
    addEventListener("hashchange",refresh);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
