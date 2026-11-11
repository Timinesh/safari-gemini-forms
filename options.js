"use strict";
const ext = globalThis.browser ?? globalThis.chrome;
const $ = id => document.getElementById(id);
const defaultModel = "gemini-3.8-flash";
async function lastRun() {
  try {
    const {lastRun} = await ext.storage.local.get({lastRun:null});
    $("lastRun").textContent = lastRun ?
      `Last run (${new Date(lastRun.when).toLocaleString()}): ${lastRun.detail}` :
      "No previous run recorded.";
  } catch(error) {$("lastRun").textContent=error.message;}
}
async function readOptions() {
  const c=await ext.storage.local.get({apiKey:"",model:defaultModel,
    checkboxMode:"all",fillText:false,overwrite:false,fallbackOnOverload:false,gfaMigrated16:false});
  if (!c.gfaMigrated16) {
    if (c.model === "gemini-3.6-flash") c.model=defaultModel;
    await ext.storage.local.set({model:c.model,gfaMigrated16:true});
  }
  $("key").value=c.apiKey;
  $("model").value=c.model;
  $("checkboxMode").value=c.checkboxMode;
  $("fillText").checked=c.fillText;
  $("overwrite").checked=c.overwrite;
  $("fallbackOnOverload").checked=c.fallbackOnOverload;
  $("activeModel").textContent=`Selected model: ${c.model}`;
  await lastRun();
}
readOptions().catch(e=>{$("result").textContent=e.message;});
$("settings").addEventListener("submit",async e=>{
  e.preventDefault();
  const model=$("model").value.trim() || defaultModel;
  const apiKey=$("key").value.trim();
  if(!apiKey||!/^[a-zA-Z0-9._-]+$/.test(model)){
    $("result").textContent="Enter an API key and valid Gemini model ID.";return;
  }
  try {
    await ext.storage.local.set({apiKey,model,
      checkboxMode:$("checkboxMode").value,fillText:$("fillText").checked,
      overwrite:$("overwrite").checked,fallbackOnOverload:$("fallbackOnOverload").checked});
    $("result").textContent="Saved. Refresh your Google Form if you just upgraded the extension.";
    $("activeModel").textContent=`Selected model: ${model}`;
  } catch(error) {$("result").textContent=`Save failed: ${error.message}`;}
});
$("models").addEventListener("click",async()=>{
  $("result").textContent="Loading models available to your API key…";
  try {
    const response=await ext.runtime.sendMessage({type:"GFA_MODELS"});
    if(!response?.ok)throw new Error(response?.error || "Model request failed");
    const list=$("modelChoices");list.replaceChildren();
    for(const m of response.models){
      const option=document.createElement("option");option.value=m.id;option.textContent=m.id;
      list.appendChild(option);
    }
    list.hidden=false;
    list.value=$("model").value;
    $("result").textContent=`${response.models.length} compatible models found. Choose one below and click Save settings.`;
  } catch(error) {$("result").textContent=error.message;}
});
$("modelChoices").addEventListener("change",()=>{$("model").value=$("modelChoices").value;});
$("test").addEventListener("click",async()=>{
  $("result").textContent="Testing Gemini API connection…";
  try {
    const response=await ext.runtime.sendMessage({type:"GFA_TEST"});
    $("result").textContent=response?.ok ? response.message : (response?.error || "No response");
  } catch(error) {$("result").textContent=error.message;}
  await lastRun();
});
