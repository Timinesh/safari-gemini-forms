import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
content = (ROOT / "content.js").read_text()
css = (ROOT / "content.css").read_text()


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"]
        )
        page = await browser.new_page()
        await page.goto("about:blank")
        await page.set_content("""<!doctype html><html><body>
        <div class="o3Dpx">
        <div class="Qr7Oae" id="harry"><div class="z12JJ"><div class="M7eMe">How did Harry get his scar?</div></div>
         <div class="options">
           <div class="opt"><div role="radio" data-value="Basilisk" aria-checked="false"></div></div>
           <div class="opt"><div role="radio" data-value="Quidditch" aria-checked="false"></div></div>
           <div class="opt"><div role="radio" data-value="Voldemort" aria-checked="false"></div></div>
         </div></div>
        <div class="Qr7Oae" id="colors"><div class="z12JJ"><div class="M7eMe">Choose all primary colors here</div></div>
         <div class="options">
           <div class="opt"><div role="checkbox" data-answer-value="Red" aria-checked="false"></div></div>
           <div class="opt"><div role="checkbox" data-answer-value="Yellow" aria-checked="false"></div></div>
           <div class="opt"><div role="checkbox" data-answer-value="Blue" aria-checked="false"></div></div>
         </div></div>
        </div></body></html>""")
        await page.evaluate("""() => {
            window.browser={
              storage:{local:{get:async d=>({...d,apiKey:'KEY',model:'gemini-3.8-flash'}),set:async d=>{window.lastRun=d.lastRun}}},
              runtime:{onMessage:{addListener:fn=>window._listener=fn},sendMessage:async msg=>{
                window.calls=(window.calls||[]).concat(msg);
                if(window.failNext){window.failNext=false;return {ok:false,error:'HTTP 503 high demand'}}
                return {ok:true,model:'gemini-3.8-flash',attempts:1,answer:{choices:msg.question.type==='radio'?[2]:[0,2],text:'',grid:[]}};
              }}
            };
            document.addEventListener('click',e=>{
              if(!e.target.classList.contains('opt'))return;
              const control=e.target.firstElementChild;
              if(control.getAttribute('role')==='radio'){
                control.closest('.options').querySelectorAll('[role=radio]').forEach(r=>r.setAttribute('aria-checked','false'));
                control.setAttribute('aria-checked','true');
              }else control.setAttribute('aria-checked',control.getAttribute('aria-checked')==='true'?'false':'true');
            });
            window.start =()=>new Promise(resolve=>window._listener({type:'GFA_RUN'},{},resolve));
        }""")
        await page.add_style_tag(content=css)
        await page.add_script_tag(content=content)
        await page.wait_for_selector("#harry button.sgfa-status")
        assert await page.locator(".sgfa-status").count() == 2
        assert await page.locator(".sgfa-status[data-state=ready]").count() == 2

        result = await page.evaluate("start()")
        assert result["started"]
        await page.wait_for_function(
            """() => document.querySelectorAll('.sgfa-status[data-state=success]').length===2"""
        )
        assert (
            await page.locator("#harry [role=radio][aria-checked=true]").get_attribute(
                "data-value"
            )
            == "Voldemort"
        )
        checks = await page.locator(
            "#colors [role=checkbox][aria-checked=true]"
        ).evaluate_all('(list)=>list.map(x=>x.getAttribute("data-answer-value"))')
        assert checks == ["Red", "Blue"], checks
        assert await page.locator("#gfa-notification,#gff-toast-host").count() == 0
        assert len(await page.evaluate("window.calls")) == 2

        await page.evaluate("start()")
        await page.wait_for_timeout(250)
        assert len(await page.evaluate("window.calls")) == 2

        await page.locator("#harry button.sgfa-status").click()
        await page.wait_for_timeout(250)
        assert len(await page.evaluate("window.calls")) == 3

        await page.evaluate("window.failNext=true")
        await page.locator("#colors button.sgfa-status").click()
        await page.wait_for_function(
            """() => document.querySelector('#colors .sgfa-status').dataset.state==='failure' """
        )
        title = await page.locator("#colors button.sgfa-status").get_attribute("title")
        assert "503" in title, title

        await page.locator("#colors button.sgfa-status").click()
        await page.wait_for_function(
            """() => document.querySelector('#colors .sgfa-status').dataset.state==='success' """
        )

        await page.evaluate("""() => {
          document.querySelector('.o3Dpx').innerHTML='<div class="Qr7Oae" id="next"><div class="z12JJ"><div class="M7eMe">Second page question</div></div><div class="options"><div class="opt"><div role="radio" data-value="a" aria-checked="false"></div></div><div class="opt"><div role="radio" data-value="b" aria-checked="false"></div></div><div class="opt"><div role="radio" data-value="c" aria-checked="false"></div></div></div></div>';
        }""")
        await page.wait_for_selector("#next .sgfa-status")
        await page.evaluate("start()")
        await page.wait_for_function(
            """()=>document.querySelector('#next .sgfa-status').dataset.state==='success' """
        )
        assert (
            await page.locator("#next [role=radio][aria-checked=true]").get_attribute(
                "data-value"
            )
            == "c"
        )
        print(
            "PASS: per-question icons, hover error, click retry, keyboard run, multi-checkbox, next page observer, no toast"
        )
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
