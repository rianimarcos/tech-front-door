# Tech Front Door

Single intake form for technology product demand. Someone has an idea, a problem, or a request — they fill this in and it lands with the triage team.

## Run it

```bash
npm run dev
```

Opens on http://localhost:3000. No build step — just static HTML, CSS, and vanilla JS.

## What's inside

```
src/
├── index.html    # the form (all 31 questions + review + success step)
├── styles.css    # styles, responsive, keyboard-friendly
├── app.js        # step nav, validation, conditionals, review, submit
└── assets/       # logo
```

## Editing the form

The form is **fully DOM-driven**. Adding, removing, or renaming questions is done in [`src/index.html`](src/index.html) — the JavaScript never needs to change.

- New question → add a `<div class="field">` block in the right `<section class="step">`
- Required → put `required` on the control(s)
- Conditional field → `<div class="field conditional" data-show-when='{"otherName":"value"}'>`
- "At least one of these" → `data-require-any="name1 name2"` on the `.field`
- Custom error message → `data-error="…"` on the `.field`

Section C (AI risk triage) only appears when the requester ticks Yes / Not sure at Q21.

## Submitting

Right now, submissions log to the browser console. The Confluence endpoint isn't wired up yet — see the `// TODO` in [`src/app.js`](src/app.js).
