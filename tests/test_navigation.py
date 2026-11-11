import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / "content.js").read_text()
CSS = (ROOT / "content.css").read_text()

HTML = """<div class="Qr7Oae" id="{id}"><div class="z12JJ"><div class="M7eMe">{q}</div></div>
<div class="options"><div class="opt"><div role="radio" data-value="wrong" aria-checked="false"></div></div>
<div class="opt"><div role="radio" data-value="correct" aria-checked="false"></div></div></div></div>"""


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"]
        )
        page = await browser.new_page()
        await page.goto("about:blank")
        await page.set_content(
            '<div class="o3Dpx">' + HTML.format(id="one", q="Question 1") + "</div>"
        )
        await page.evaluate("""() => {
          window.calls=[];
          window.browser={
            storage:{local:{get:async d=>({...d,apiKey:'KEY'}),set:async()=>{}}},
            runtime:{onMessage:{addListener:fn=>window._listener=fn},sendMessage:async m=>{
              window.calls.push(m.question.question);
              if(m.question.question==='Question 1') {
                return await new Promise(resolve=>window.finishFirst=()=>resolve({ok:true,model:'mock',attempts:1,answer:{choices:[1],text:'',grid:[]}}));
              }
              return {ok:true,model:'mock',attempts:1,answer:{choices:[1],text:'',grid:[]}};
            }}
          };
          document.addEventListener('click',e=>{
            if(!e.target.classList.contains('opt'))return;
            const item=e.target.firstElementChild;
            item.closest('.options').querySelectorAll('[role="radio"]').forEach(el=>el.setAttribute('aria-checked','false'));
            item.setAttribute('aria-checked','true');
          });
          window.shortcut=()=>new Promise(resolve=>window._listener({type:'GFA_RUN'},{},resolve));
        }""")
        await page.add_style_tag(content=CSS)
        await page.add_script_tag(content=JS)
        assert (await page.evaluate("window.shortcut()"))["started"]
        await page.wait_for_function('window.calls.includes("Question 1")')

        await page.evaluate(
            """() => {document.querySelector('.o3Dpx').innerHTML=`"""
            + HTML.format(id="two", q="Question 2")
            + """`; }"""
        )
        await page.wait_for_selector("#two button.sgfa-status")
        assert (await page.evaluate("window.shortcut()"))["started"]
        await page.wait_for_function(
            """() => document.querySelector('#two .sgfa-status').dataset.state === 'success' """,
            timeout=6000,
        )
        assert (
            await page.locator("#two [role=radio][aria-checked=true]").get_attribute(
                "data-value"
            )
            == "correct"
        )
        assert await page.evaluate('window.calls.includes("Question 2")')

        await page.evaluate("window.finishFirst()")
        await page.evaluate(
            """() => {document.querySelector('.o3Dpx').innerHTML=`"""
            + HTML.format(id="previous", q="Question 3")
            + """`; }"""
        )
        await page.wait_for_selector("#previous button.sgfa-status")
        assert (await page.evaluate("window.shortcut()"))["started"]
        await page.wait_for_function(
            """() => document.querySelector('#previous .sgfa-status').dataset.state === 'success' """,
            timeout=6000,
        )

        await page.evaluate(
            '(html) => {document.body.innerHTML=`<div class="o3Dpx">${html}</div>`;}',
            HTML.format(id="replaced", q="Question 4"),
        )
        await page.wait_for_selector("#replaced button.sgfa-status")
        assert (await page.evaluate("window.shortcut()"))["started"]
        await page.wait_for_function(
            """() => document.querySelector('#replaced .sgfa-status').dataset.state === 'success' """,
            timeout=6000,
        )

        await page.evaluate(
            """() => {document.body.innerHTML='<div class="o3Dpx"></div>'; }"""
        )
        assert (await page.evaluate("window.shortcut()"))["started"]
        await page.wait_for_timeout(350)
        await page.evaluate(
            """() => {document.querySelector('.o3Dpx').innerHTML=`"""
            + HTML.format(id="delayed", q="Question 5")
            + """`; }"""
        )
        await page.wait_for_function(
            """() => document.querySelector('#delayed .sgfa-status')?.dataset.state === 'success' """,
            timeout=6000,
        )
        assert (
            await page.locator(
                "#delayed [role=radio][aria-checked=true]"
            ).get_attribute("data-value")
            == "correct"
        )
        print(
            "PASS: forward/back, in-flight request navigation, body replacement, shortcut before section loads"
        )
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
