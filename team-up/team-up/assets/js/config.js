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

/* ---------- Conversation questions ----------
   One set of 3 questions for every card (interest_workingStyle).
   Each student sees the set for their PARTNER's card, so they ask
   questions that fit the person in front of them.
   Interest ids: research, creative, technology, management
   Style ids:    idea, collaborator, solver, planner
*/
TU.QUESTION_SETS = {
  research_idea: [
    'How are you today?',
    'What topics do you enjoy exploring or learning about?',
    'When you have a new idea, do you prefer exploring many possibilities first?'
  ],
  research_collaborator: [
    'How are you today?',
    'What topics do you enjoy exploring or learning about?',
    'Do you enjoy sharing your thoughts and exploring ideas with others?'
  ],
  research_solver: [
    'How are you today?',
    'What topics do you enjoy exploring or learning about?',
    'When solving a problem, do you enjoy researching it before trying solutions?'
  ],
  research_planner: [
    'How are you today?',
    'What topics do you enjoy exploring or learning about?',
    'Do you like planning your research before getting started?'
  ],

  creative_idea: [
    'How are you today?',
    'What do you enjoy creating or designing?',
    'When creating something, do you prefer exploring lots of different ideas?'
  ],
  creative_collaborator: [
    'How are you today?',
    'What do you enjoy creating or designing?',
    'Do you enjoy creating things together with other people?'
  ],
  creative_solver: [
    'How are you today?',
    'What do you enjoy creating or designing?',
    "When a design idea doesn't work, do you enjoy trying different solutions?"
  ],
  creative_planner: [
    'How are you today?',
    'What do you enjoy creating or designing?',
    'Do you like planning your design before you start creating?'
  ],

  technology_idea: [
    'How are you today?',
    'What kind of technology do you enjoy exploring?',
    'When exploring technology, do you enjoy imagining new ways to use it?'
  ],
  technology_collaborator: [
    'How are you today?',
    'What kind of technology do you enjoy exploring?',
    'Do you enjoy exploring new technology with other people?'
  ],
  technology_solver: [
    'How are you today?',
    'What kind of technology do you enjoy exploring?',
    "When technology doesn't work as expected, do you enjoy figuring out why?"
  ],
  technology_planner: [
    'How are you today?',
    'What kind of technology do you enjoy exploring?',
    'Do you like planning how to build something before you start?'
  ],

  management_idea: [
    'How are you today?',
    'What do you enjoy organising or planning?',
    'When organising a project, do you enjoy finding new ways to do things?'
  ],
  management_collaborator: [
    'How are you today?',
    'What do you enjoy organising or planning?',
    'Do you enjoy planning tasks together with other people?'
  ],
  management_solver: [
    'How are you today?',
    'What do you enjoy organising or planning?',
    'When a project gets complicated, do you enjoy finding ways to solve the problem?'
  ],
  management_planner: [
    'How are you today?',
    'What do you enjoy organising or planning?',
    'Do you prefer making a plan before starting a project?'
  ]
};
