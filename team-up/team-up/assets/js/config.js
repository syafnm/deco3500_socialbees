/* ==========================================================
   Team Up — content config
   Everything a tutor or the team might want to tweak lives here:
   interests (= card colour), working styles (= card icon),
   and the conversation prompt banks.
   ========================================================== */
window.TU = window.TU || {};

/* Question 1 — Interest → card colour */
TU.INTERESTS = [
  { id: 'research',   label: 'Research',   color: '#2E5BDA', ink: '#FFFFFF', colorName: 'Blue',
    blurb: 'Digging into questions, reading and finding evidence' },
  { id: 'creative',   label: 'Creative',   color: '#F0A202', ink: '#2A1520', colorName: 'Yellow',
    blurb: 'Making, designing and telling stories' },
  { id: 'technology', label: 'Technology', color: '#0B8576', ink: '#FFFFFF', colorName: 'Green',
    blurb: 'Building, coding and tinkering with tools' },
  { id: 'management', label: 'Management', color: '#7B4FD6', ink: '#FFFFFF', colorName: 'Purple',
    blurb: 'Organising people, plans and deadlines' }
];

/* Question 2 — Working style → card icon (SVG paths, 24x24, stroke-based) */
TU.STYLES = [
  { id: 'idea', label: 'Idea Generator', iconName: 'Lightbulb',
    blurb: 'I throw out lots of ideas and love starting things',
    icon: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>' },
  { id: 'planner', label: 'Planner', iconName: 'Calendar',
    blurb: 'I like a clear plan, a timeline and who does what',
    icon: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>' },
  { id: 'solver', label: 'Problem Solver', iconName: 'Puzzle piece',
    blurb: 'I like cracking the tricky bits and fixing what is broken',
    icon: '<path d="M10 3H5a2 2 0 0 0-2 2v5h1.5a2 2 0 1 1 0 4H3v5a2 2 0 0 0 2 2h5v-1.5a2 2 0 1 1 4 0V21h5a2 2 0 0 0 2-2v-5h-1.5a2 2 0 1 1 0-4H21V5a2 2 0 0 0-2-2h-5v1.5a2 2 0 1 1-4 0z"/>' },
  { id: 'collaborator', label: 'Collaborator', iconName: 'People',
    blurb: 'I keep the group talking and make sure everyone is in',
    icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 4.8"/>' }
];

TU.QUESTIONS = {
  q1: { title: 'What kind of work pulls you in most?',
        hint: 'This sets your card colour. It stays the same for the whole session.' },
  q2: { title: 'How do you usually work in a team?',
        hint: 'This sets your card icon. You can pick again each round.' }
};

TU.DEFAULTS = {
  roundMinutes: 8,
  minMinutes: 5,
  maxMinutes: 15,
  maxGroupSize: 3,
  teamSize: 4,          // students per project team (tutor sets this in setup)
  minTeamSize: 2,
  maxTeamSize: 8,      // a pair, or a trio when someone joins an existing pair (odd numbers)
  allowRepeats: false   // can the same two people pair again in a later round?
};

/* ---------- Conversation prompts ----------
   Each pair gets 3 prompts:
   1. an interest prompt   (same interest → that bank, different → "bridge" bank)
   2. a working-style prompt (same style → that bank, different → "contrast" bank)
   3. a match prompt based on what they share (both / colour only / icon only)
   {a} and {b} are swapped for the two labels where used.
*/
TU.PROMPTS = {
  interest: {
    research: [
      "What's something you've gone down a rabbit hole researching lately?",
      'How do you decide whether a source is worth trusting?',
      'If you could investigate any question for a whole semester, what would it be?'
    ],
    creative: [
      "What's something you made that you're proud of, even if no one else saw it?",
      'Where do you go for inspiration when you get stuck?',
      "What's your favourite tool or medium to make things with?"
    ],
    technology: [
      "What's a piece of tech you use every day that you'd redesign?",
      "What's the last thing you built, coded or tinkered with?",
      'Which tool or language do you want to get better at this semester?'
    ],
    management: [
      'How do you keep a group project on track when everyone gets busy?',
      'What makes a team meeting actually worth having?',
      "Tell each other about a deadline you saved at the last minute. How?"
    ]
  },
  interestBridge: [
    'One of you is into {a}, the other {b}. How could those two help each other on a project?',
    "Explain what you love about your area like your partner has never heard of it. What surprised you about theirs?",
    "What's one thing from your partner's area you'd actually like to learn?"
  ],
  style: {
    idea: [
      'Pitch each other a wild project idea in 30 seconds each.',
      'How do you decide which of your ideas is worth chasing?'
    ],
    planner: [
      'Show each other how you plan a week. App, paper, or vibes?',
      'What do you do when a plan falls apart halfway through?'
    ],
    solver: [
      "What's a problem you cracked recently that felt great?",
      'When you get stuck, do you push through or step away for a bit?'
    ],
    collaborator: [
      "What's the best team you've been part of, and why did it work?",
      'How do you bring a quiet teammate into the conversation?'
    ]
  },
  styleContrast: [
    "One of you is the {a}, the other the {b}. Where might you clash on a project, and how would you sort it out?",
    'What could the {a} learn from the {b}, and the other way round? Swap one habit each.',
    'Split a pretend project: what would the {a} take on first, and what would the {b}?'
  ],
  match: {
    both: [
      "You matched on everything. Find one way you're actually different.",
      "Same interest, same style. What would you two need from a third teammate?"
    ],
    color: [
      'Same interest, different style. Sketch a mini project where you each lead a part.',
      'You like the same kind of work. What would you want to make together this semester?'
    ],
    none: [
      "Different interests and different styles. What's one thing about how your partner works that surprised you?",
      "You see things from different angles. What's one thing you'd want a teammate to know about how you work?",
      "What would you each need from the other to work well together?"
    ],
    icon: [
      'Same working style, different interests. What project would use both your interests?',
      "You work the same way. What's one team habit you both can't stand?"
    ]
  }
};
