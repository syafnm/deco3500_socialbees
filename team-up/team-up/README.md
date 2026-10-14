# Team Up — DECO3500 (Social Bees)

A tutor-run, in-class matchmaking activity. Students get a card (colour = interest, icon = working style), walk around to find someone who shares their colour, icon or both, pair up by typing that person's PIN, talk through three prompts, and say whether they'd team up. The tutor runs the rounds and sees who wants to work with whom.

Plain HTML, CSS and JavaScript. No build step, no framework.

## Folder structure

```
team-up/
├── index.html                  Landing: join with a code, or set up a session
├── tutor/
│   ├── setup.html              Create a session (course, name, round length, repeat partners)
│   └── dashboard.html          Live control: QR code, phases, timer, people, pairs, team-up interest, projector view
├── student/
│   ├── join.html               Enter name + student ID (opened from the QR code)
│   └── app.html                The whole student flow, one screen per phase
└── assets/
    ├── css/
    │   ├── base.css            Colour tokens, type, buttons, inputs, the card component
    │   ├── landing.css
    │   ├── tutor.css           Desktop-first, collapses to one column on phones
    │   └── student.css         Mobile-first, phone-width column on desktop
    ├── js/
    │   ├── config.js           Interests, working styles, icons, question text, all prompts  ← edit content here
    │   ├── firebase-config.js  Paste Firebase config here for real multi-device use
    │   ├── store.js            Data layer (localStorage or Firebase, same API)
    │   ├── logic.js            Rules: joining, PINs, pairing checks, prompts, results, CSV
    │   ├── ui.js               Shared helpers: card rendering, QR, toasts, timer format
    │   ├── tutor-setup.js
    │   ├── tutor-dashboard.js
    │   ├── student-join.js
    │   └── student-app.js
    └── vendor/
        └── qrcode-generator.js QR code library (MIT, Kazuhiko Arase), bundled so it works offline
```

## How the flow maps to the code

| Phase | Tutor does | Student sees |
|---|---|---|
| Join (`lobby`) | Shares QR / code, presses **Open questions** | Name + student ID, then their PIN while waiting |
| Questions | Watches cards come in, presses **Start matching** | Q1 Interest → colour, Q2 Working style → icon, then their card |
| Matching | Sets 5–15 min, presses **Start conversations** | Big card + PIN, "Look for" hint, PIN entry. A pair forms once both have entered each other's PIN, then they see prompts |
| Conversations (`talking`) | Timer, **Add 1 minute**, **End round now** | Partner cards, timer, 3 tailored prompts |
| Wrap-up (`roundEnd`) | Sees answers come in, **Start round N** or **Finish session** | "Would you team up?" (Keen / Maybe / Not this time) |
| Next round | — | Keeps interest colour, only re-picks working style |
| Finished | Team-up interest table, **Download CSV** | People they met |

Pairing rules (in `logic.js → pairWithPin`):
- Anyone can pair with anyone. Colour and icon only decide which prompts the pair gets.
- Both people type each other's PIN. The first entry is a request ("Waiting for Ben to enter yours"); the conversation starts when the second person enters the first person's PIN. A student can cancel a request or send a new one (one request at a time).
- The PIN box is on screen from the moment a student joins, but it only unlocks once they have a card and matching is open.
- PINs are 4 digits, unique, and stay the same all session.
- Odd numbers: a third student can enter the PIN of someone already in a pair; that person sees "Someone wants to join you" and enters the third student's PIN to let them in (max 3).
- Late joiners can join, answer and pair during matching or conversations.
- With "Allow repeat partners" off, the same two students can't pair again in later rounds.
- The tutor can split a pair or remove a student from the dashboard.

Prompts (in `config.js → TU.PROMPTS`): each pair gets one interest prompt (shared interest, or a "bridge" prompt for different interests), one working-style prompt (shared style, or a "contrast" prompt), and one prompt based on what they have in common (both / colour / icon / nothing).

## Forming project teams

- **Setup:** the tutor sets **Students per team** (2–8, default 4). It can be changed later in the Teams tab until teams are confirmed.
- **Mutual matches:** after each round, students answer "Would you team up?". When two students both pick "Keen to team up", they appear in the Teams tab under **Mutual matches**, with a tag showing whether they're in the same draft team.
- **Build teams from matches:** drafts teams of the chosen size (sizes are balanced, e.g. 10 students in teams of 4 gives 4, 3, 3).
  1. Mutual matches are kept together, and chains (A–B and B–C) end up in the same team.
  2. Anyone who said "Not this time" about someone is kept apart from them.
  3. Everyone else goes where they have the most "Keen" and "Maybe" answers, with a small nudge towards mixing interests.
- **Edit:** move anyone with the "Move to…" menu, add or delete teams. Each team card shows "Ana and Ben both keen" and warns in red if someone said "Not this time" to a teammate.
- **Confirm all teams:** locks the teams. Every student's phone then shows "You're in Team 2" with their teammates. "Unlock to edit" reopens editing.
- The CSV export includes each student's team.

## Run it

Any static server works. From the `team-up` folder:

```
npx serve .
# or
python3 -m http.server 8000
```

Or use VS Code's Live Server extension. Then open `http://localhost:8000`.

### Demo mode (default)
With `TU.FIREBASE_CONFIG = null`, everything is saved in the browser's localStorage. Open the tutor dashboard in one tab and use **Open as student** to open as many student tabs as you like. Each tab is a separate student. Great for testing and presenting the prototype.

Phones and laptops will **not** see each other in demo mode.

### Real class (phones + laptop)
1. Create a Firebase project at console.firebase.google.com and add a Web app.
2. Build → Realtime Database → Create database (pick the Australia region).
3. Paste the web app config into `assets/js/firebase-config.js`.
4. Set these database rules (fine for a class prototype; anyone with a session code can read and write it):
   ```json
   {
     "rules": {
       "sessions": {
         "$code": { ".read": true, ".write": true }
       }
     }
   }
   ```
5. Host the folder anywhere with HTTPS (GitHub Pages from the team repo works). The QR code points at `student/join.html` on whatever address the dashboard is open on, so open the dashboard from the hosted URL, not localhost.

No other code changes: `store.js` switches to Firebase automatically when a config is present.

## Changing content

- Interest names, colours, blurbs: `TU.INTERESTS` in `config.js`
- Working styles, icons (24×24 SVG paths), blurbs: `TU.STYLES`
- Question wording: `TU.QUESTIONS`
- Round length limits, trio size, repeat-partner default: `TU.DEFAULTS`
- Conversation prompts: `TU.PROMPTS`

## Notes for the prototype write-up
- No logins. Tutors are identified by the session they created on their device; students by student ID within a session (rejoining with the same ID restores their card).
- Colour is never the only signal: every card prints the interest name and working style, which helps colour-blind students.
- Student answers about who they'd team up with are only shown on the tutor dashboard.
