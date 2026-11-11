# Safari Gemini Form Assistant

A Safari Web Extension for Google Forms. Uses per-question Gemini API calls, with
clickable per-question processing indicators and ⌘ Command + Shift + U to process
the entire current page. It **never submits the form**.

## Install (Safari on macOS)

1. Safari → Settings → Developer → Add Temporary Extension → select the extracted
   `safari-gemini-forms` folder containing `manifest.json`.
2. Enable extension and grant website access to `docs.google.com/forms/*`,
   `generativelanguage.googleapis.com` and, for image questions, `*.googleusercontent.com`.
3. Open Safari Settings → Extensions → Safari Gemini Form Assistant → Settings.
4. Enter the Gemini API key from https://aistudio.google.com/apikey and save. It can
   stay set to `gemini-3.8-flash`. Use **Load available models** to query models that
   are actually available to your key.
5. Test Gemini connection. Reload open Google Form pages to activate new code.

On each question:

- ✦ = not processed; click to ask Gemini for that question.
- ⟳ = Gemini is currently processing; don't click repeatedly.
- ✓ = answered and DOM state verified; click to redo just this question.
- ! = failure; hover to see the error; click to retry.
- ↻ = answered before Gemini; click to overwrite using Gemini.
- − = no clear answer returned; click to retry.

On the form press **⌘ + Shift + U** to sequentially process supported unanswered
questions on the currently visible section. Press it after clicking **Next** for
another section. The shortcut does not display a popup or toast.
