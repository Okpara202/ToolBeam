import { Category } from '@/constants/category';

export interface SeedTool {
  name: string;
  description: string;
  category: Category;
  link: string;
  tags: string[];
  /** How long ago the tool was submitted. Drives the age term in the decay. */
  ageDays: number;
  /** How many real Upvote documents to generate for it. */
  upvotes: number;
}

/**
 * The seeded directory.
 *
 * `ageDays` and `upvotes` are chosen together on purpose, so the ranking is
 * visibly doing something rather than just listing whatever has the biggest
 * number. The block at the bottom — young tools with modest counts — should
 * outrank the decade-old giants at the top on /tools/popular, while those
 * giants still win a raw upvote-count sort. That contrast is the whole point.
 */
export const SEED_TOOLS: SeedTool[] = [
  // --- Text generation ---
  {
    name: 'ChatGPT',
    description:
      'Conversational assistant for drafting, editing, brainstorming and reasoning through problems, with browsing and file analysis built in.',
    category: Category.TEXT_GENERATION,
    link: 'https://chat.openai.com',
    tags: ['chat', 'writing', 'assistant', 'reasoning'],
    ageDays: 900,
    upvotes: 320,
  },
  {
    name: 'Claude',
    description:
      'Assistant built for long documents and careful reasoning, handling very large context windows for analysis, drafting and coding.',
    category: Category.TEXT_GENERATION,
    link: 'https://claude.ai',
    tags: ['chat', 'writing', 'long-context', 'assistant'],
    ageDays: 700,
    upvotes: 295,
  },
  {
    name: 'Jasper',
    description:
      'Marketing copy generator that learns a company brand voice and produces on-brand campaign, blog and ad copy at scale.',
    category: Category.TEXT_GENERATION,
    link: 'https://www.jasper.ai',
    tags: ['copywriting', 'marketing', 'brand-voice'],
    ageDays: 820,
    upvotes: 118,
  },
  {
    name: 'Sudowrite',
    description:
      'Writing partner aimed at novelists, suggesting descriptions, plot turns and rewrites while keeping a consistent narrative voice.',
    category: Category.TEXT_GENERATION,
    link: 'https://www.sudowrite.com',
    tags: ['fiction', 'writing', 'storytelling'],
    ageDays: 610,
    upvotes: 58,
  },

  // --- Image generation ---
  {
    name: 'Midjourney',
    description:
      'Image generator known for highly stylised, art-directed renders, driven by prompts and reference images for concept and design work.',
    category: Category.IMAGE_GENERATION,
    link: 'https://www.midjourney.com',
    tags: ['image', 'art', 'diffusion', 'design-assets'],
    ageDays: 880,
    upvotes: 340,
  },
  {
    name: 'DALL-E',
    description:
      'Prompt-driven image generator with inpainting and outpainting, useful for illustration, mockups and quick visual concepts.',
    category: Category.IMAGE_GENERATION,
    link: 'https://openai.com/dall-e',
    tags: ['image', 'art', 'diffusion', 'inpainting'],
    ageDays: 950,
    upvotes: 248,
  },
  {
    name: 'Stable Diffusion',
    description:
      'Open-weights image model that runs locally or in the cloud, with a deep ecosystem of fine-tunes, LoRAs and control networks.',
    category: Category.IMAGE_GENERATION,
    link: 'https://stability.ai',
    tags: ['image', 'open-source', 'diffusion', 'art'],
    ageDays: 900,
    upvotes: 302,
  },
  {
    name: 'Leonardo AI',
    description:
      'Image generation workspace tuned for game and product asset pipelines, with trained styles and consistent character rendering.',
    category: Category.IMAGE_GENERATION,
    link: 'https://leonardo.ai',
    tags: ['image', 'game-assets', 'art', 'diffusion'],
    ageDays: 500,
    upvotes: 112,
  },
  {
    name: 'Ideogram',
    description:
      'Image generator that renders readable text inside images reliably, making it useful for posters, logos and typographic layouts.',
    category: Category.IMAGE_GENERATION,
    link: 'https://ideogram.ai',
    tags: ['image', 'typography', 'art', 'posters'],
    ageDays: 300,
    upvotes: 88,
  },

  // --- Video generation ---
  {
    name: 'Runway',
    description:
      'Generative video suite covering text-to-video, motion brush, background removal and frame interpolation for editors and VFX artists.',
    category: Category.VIDEO_GENERATION,
    link: 'https://runwayml.com',
    tags: ['video', 'editing', 'generative', 'vfx'],
    ageDays: 700,
    upvotes: 205,
  },
  {
    name: 'Synthesia',
    description:
      'Turns a script into a presenter-led video with a synthetic avatar, widely used for training material and product walkthroughs.',
    category: Category.VIDEO_GENERATION,
    link: 'https://www.synthesia.io',
    tags: ['video', 'avatars', 'training', 'localization'],
    ageDays: 800,
    upvotes: 142,
  },
  {
    name: 'HeyGen',
    description:
      'Avatar video generator with voice cloning and translation, producing localised versions of a recording with matched lip sync.',
    category: Category.VIDEO_GENERATION,
    link: 'https://www.heygen.com',
    tags: ['video', 'avatars', 'localization', 'dubbing'],
    ageDays: 350,
    upvotes: 124,
  },
  {
    name: 'Pika',
    description:
      'Text and image to video generator focused on short animated clips, camera motion control and quick social-format output.',
    category: Category.VIDEO_GENERATION,
    link: 'https://pika.art',
    tags: ['video', 'animation', 'generative', 'social'],
    ageDays: 400,
    upvotes: 131,
  },

  // --- Audio and voice ---
  {
    name: 'ElevenLabs',
    description:
      'Speech synthesis and voice cloning with expressive delivery, used for audiobooks, dubbing and product voiceover in many languages.',
    category: Category.AUDIO_AND_VOICE,
    link: 'https://elevenlabs.io',
    tags: ['voice', 'text-to-speech', 'dubbing', 'audio'],
    ageDays: 600,
    upvotes: 262,
  },
  {
    name: 'Suno',
    description:
      'Generates complete songs with vocals and instrumentation from a text prompt, covering lyrics, melody and arrangement.',
    category: Category.AUDIO_AND_VOICE,
    link: 'https://suno.com',
    tags: ['music', 'audio', 'generative', 'songwriting'],
    ageDays: 250,
    upvotes: 182,
  },
  {
    name: 'Descript',
    description:
      'Edits podcasts and video by editing the transcript, with filler-word removal, studio sound and synthetic voice correction.',
    category: Category.AUDIO_AND_VOICE,
    link: 'https://www.descript.com',
    tags: ['audio', 'editing', 'transcription', 'podcast'],
    ageDays: 750,
    upvotes: 148,
  },
  {
    name: 'Murf',
    description:
      'Voiceover studio with a library of synthetic voices, timing controls and background tracks for presentations and e-learning.',
    category: Category.AUDIO_AND_VOICE,
    link: 'https://murf.ai',
    tags: ['voice', 'text-to-speech', 'voiceover', 'elearning'],
    ageDays: 700,
    upvotes: 68,
  },

  // --- Code assistants ---
  {
    name: 'GitHub Copilot',
    description:
      'Inline code completion and chat inside the editor, suggesting whole functions and tests from surrounding code and comments.',
    category: Category.CODE_ASSISTANT,
    link: 'https://github.com/features/copilot',
    tags: ['coding', 'autocomplete', 'ide', 'developer'],
    ageDays: 1000,
    upvotes: 331,
  },
  {
    name: 'Cursor',
    description:
      'Editor built around an assistant that reads the whole repository, applying multi-file edits and answering questions about the codebase.',
    category: Category.CODE_ASSISTANT,
    link: 'https://cursor.com',
    tags: ['coding', 'ide', 'editor', 'developer'],
    ageDays: 420,
    upvotes: 284,
  },
  {
    name: 'Codeium',
    description:
      'Free code completion and chat across many editors and languages, with repository-aware context and self-hosting options.',
    category: Category.CODE_ASSISTANT,
    link: 'https://codeium.com',
    tags: ['coding', 'autocomplete', 'ide', 'developer'],
    ageDays: 500,
    upvotes: 121,
  },
  {
    name: 'Tabnine',
    description:
      'Code completion that can run entirely inside a private network, aimed at teams with strict source-code residency requirements.',
    category: Category.CODE_ASSISTANT,
    link: 'https://www.tabnine.com',
    tags: ['coding', 'autocomplete', 'privacy', 'ide'],
    ageDays: 900,
    upvotes: 79,
  },
  {
    name: 'Replit Agent',
    description:
      'Builds and deploys a working application from a plain-language brief, provisioning the environment and iterating on errors.',
    category: Category.CODE_ASSISTANT,
    link: 'https://replit.com',
    tags: ['coding', 'ide', 'deployment', 'developer'],
    ageDays: 300,
    upvotes: 138,
  },

  // --- Chatbots ---
  {
    name: 'Character.AI',
    description:
      'Create and converse with persona-driven characters that hold a consistent voice and memory across long conversations.',
    category: Category.CHATBOT,
    link: 'https://character.ai',
    tags: ['chatbot', 'roleplay', 'companion', 'personas'],
    ageDays: 700,
    upvotes: 158,
  },
  {
    name: 'Poe',
    description:
      'Single interface for querying many different models side by side, with shareable bots and custom prompt presets.',
    category: Category.CHATBOT,
    link: 'https://poe.com',
    tags: ['chatbot', 'aggregator', 'multi-model'],
    ageDays: 650,
    upvotes: 104,
  },
  {
    name: 'Botpress',
    description:
      'Visual builder for deploying conversational agents to web, WhatsApp and Slack, with tool calling and knowledge sources.',
    category: Category.CHATBOT,
    link: 'https://botpress.com',
    tags: ['chatbot', 'builder', 'deployment', 'integrations'],
    ageDays: 560,
    upvotes: 72,
  },

  // --- Productivity ---
  {
    name: 'Notion AI',
    description:
      'Drafts, summarises and reorganises pages inside a workspace, answering questions across connected notes and databases.',
    category: Category.PRODUCTIVITY,
    link: 'https://www.notion.so/product/ai',
    tags: ['notes', 'writing', 'workspace', 'summarisation'],
    ageDays: 700,
    upvotes: 214,
  },
  {
    name: 'Otter.ai',
    description:
      'Joins meetings to transcribe them live, then produces summaries, action items and a searchable record of what was said.',
    category: Category.PRODUCTIVITY,
    link: 'https://otter.ai',
    tags: ['meetings', 'transcription', 'notes', 'summarisation'],
    ageDays: 900,
    upvotes: 133,
  },
  {
    name: 'Reclaim',
    description:
      'Defends focus time by rearranging a calendar automatically around meetings, habits and shifting task priorities.',
    category: Category.PRODUCTIVITY,
    link: 'https://reclaim.ai',
    tags: ['calendar', 'scheduling', 'focus', 'planning'],
    ageDays: 750,
    upvotes: 64,
  },
  {
    name: 'Mem',
    description:
      'Self-organising notebook that links related notes automatically and surfaces relevant past context while writing.',
    category: Category.PRODUCTIVITY,
    link: 'https://get.mem.ai',
    tags: ['notes', 'knowledge-base', 'search'],
    ageDays: 600,
    upvotes: 52,
  },

  // --- Marketing ---
  {
    name: 'Surfer SEO',
    description:
      'Scores drafts against ranking pages and recommends structure, headings and terms to cover before publishing.',
    category: Category.MARKETING,
    link: 'https://surferseo.com',
    tags: ['seo', 'content', 'optimization', 'marketing'],
    ageDays: 800,
    upvotes: 101,
  },
  {
    name: 'AdCreative.ai',
    description:
      'Generates ad creative variants sized for each network and ranks them by predicted conversion before spending budget.',
    category: Category.MARKETING,
    link: 'https://www.adcreative.ai',
    tags: ['ads', 'creative', 'conversion', 'marketing'],
    ageDays: 550,
    upvotes: 76,
  },

  // --- Design ---
  {
    name: 'Figma AI',
    description:
      'Generates layouts, renames layers and rewrites placeholder content directly inside a design file alongside collaborators.',
    category: Category.DESIGN,
    link: 'https://www.figma.com',
    tags: ['design', 'ui', 'prototyping', 'collaboration'],
    ageDays: 300,
    upvotes: 152,
  },
  {
    name: 'Uizard',
    description:
      'Turns a hand-drawn wireframe or a written brief into an editable multi-screen interface prototype.',
    category: Category.DESIGN,
    link: 'https://uizard.io',
    tags: ['design', 'ui', 'wireframes', 'prototyping'],
    ageDays: 650,
    upvotes: 61,
  },
  {
    name: 'Galileo AI',
    description:
      'Produces high-fidelity interface designs from a text description, exporting editable components to a design tool.',
    category: Category.DESIGN,
    link: 'https://www.usegalileo.ai',
    tags: ['design', 'ui', 'generative', 'prototyping'],
    ageDays: 400,
    upvotes: 73,
  },

  // --- Data analysis ---
  {
    name: 'Julius AI',
    description:
      'Analyses spreadsheets and datasets from plain-language questions, returning charts, statistics and the code behind them.',
    category: Category.DATA_ANALYSIS,
    link: 'https://julius.ai',
    tags: ['data', 'analysis', 'charts', 'spreadsheets'],
    ageDays: 400,
    upvotes: 67,
  },
  {
    name: 'Hex Magic',
    description:
      'Writes and explains SQL and Python inside collaborative notebooks, wiring results into shareable data apps.',
    category: Category.DATA_ANALYSIS,
    link: 'https://hex.tech',
    tags: ['data', 'sql', 'notebooks', 'analysis'],
    ageDays: 500,
    upvotes: 58,
  },

  // --- Research ---
  {
    name: 'Perplexity',
    description:
      'Answer engine that searches the web live and returns a synthesised response with inline citations to every source used.',
    category: Category.RESEARCH,
    link: 'https://www.perplexity.ai',
    tags: ['search', 'citations', 'answer-engine', 'research'],
    ageDays: 600,
    upvotes: 271,
  },
  {
    name: 'Elicit',
    description:
      'Screens academic literature at scale, extracting methods, sample sizes and findings from papers into a comparison table.',
    category: Category.RESEARCH,
    link: 'https://elicit.com',
    tags: ['research', 'papers', 'literature-review', 'academia'],
    ageDays: 700,
    upvotes: 84,
  },
  {
    name: 'Consensus',
    description:
      'Searches peer-reviewed papers and reports what the weight of published evidence actually says about a claim.',
    category: Category.RESEARCH,
    link: 'https://consensus.app',
    tags: ['research', 'papers', 'evidence', 'academia'],
    ageDays: 550,
    upvotes: 63,
  },

  // --- Automation ---
  {
    name: 'Zapier Agents',
    description:
      'Builds automations across thousands of connected apps from a description of the workflow, handling triggers and branching.',
    category: Category.AUTOMATION,
    link: 'https://zapier.com',
    tags: ['automation', 'workflows', 'integrations', 'no-code'],
    ageDays: 800,
    upvotes: 113,
  },
  {
    name: 'n8n',
    description:
      'Self-hostable workflow automation with a visual editor and native model nodes for building agentic pipelines.',
    category: Category.AUTOMATION,
    link: 'https://n8n.io',
    tags: ['automation', 'workflows', 'open-source', 'integrations'],
    ageDays: 600,
    upvotes: 94,
  },

  // --- Education ---
  {
    name: 'Khanmigo',
    description:
      'Socratic tutor that guides students toward an answer with questions instead of giving it away, with teacher dashboards.',
    category: Category.EDUCATION,
    link: 'https://www.khanmigo.ai',
    tags: ['education', 'tutoring', 'learning', 'students'],
    ageDays: 500,
    upvotes: 97,
  },
  {
    name: 'Duolingo Max',
    description:
      'Adds roleplay conversations and explanations of mistakes to language practice, adapting difficulty to the learner.',
    category: Category.EDUCATION,
    link: 'https://www.duolingo.com',
    tags: ['education', 'language', 'learning', 'practice'],
    ageDays: 550,
    upvotes: 106,
  },

  // --- Customer support ---
  {
    name: 'Intercom Fin',
    description:
      'Support agent that answers customer questions from existing help content and hands off to a human when it is unsure.',
    category: Category.CUSTOMER_SUPPORT,
    link: 'https://www.intercom.com/fin',
    tags: ['support', 'helpdesk', 'deflection', 'chatbot'],
    ageDays: 500,
    upvotes: 91,
  },
  {
    name: 'Forethought',
    description:
      'Triages and routes support tickets by predicted intent and urgency, drafting replies for agents to approve.',
    category: Category.CUSTOMER_SUPPORT,
    link: 'https://forethought.ai',
    tags: ['support', 'helpdesk', 'triage', 'automation'],
    ageDays: 480,
    upvotes: 47,
  },

  // === The recency block =================================================
  // Young tools with modest counts. On a raw upvote sort these sit near the
  // bottom; on /tools/popular the decay lifts them above the giants above.
  // This is the contrast the design answer rests on — keep it.
  {
    name: 'Devin',
    description:
      'Autonomous software engineer that plans a task, writes the code, runs the tests and opens a pull request unattended.',
    category: Category.CODE_ASSISTANT,
    link: 'https://devin.ai',
    tags: ['coding', 'agent', 'autonomous', 'developer'],
    ageDays: 5,
    upvotes: 46,
  },
  {
    name: 'Flux',
    description:
      'Open-weights image model with unusually strong prompt adherence and hand rendering, available in several distilled sizes.',
    category: Category.IMAGE_GENERATION,
    link: 'https://blackforestlabs.ai',
    tags: ['image', 'open-source', 'diffusion', 'art'],
    ageDays: 12,
    upvotes: 54,
  },
  {
    name: 'NotebookLM Audio',
    description:
      'Turns a pile of uploaded sources into a two-host audio discussion that explains and connects the material conversationally.',
    category: Category.RESEARCH,
    link: 'https://notebooklm.google.com',
    tags: ['research', 'audio', 'summarisation', 'notes'],
    ageDays: 8,
    upvotes: 39,
  },
  {
    name: 'Kling',
    description:
      'Video generator producing longer clips with coherent motion and physics, with start and end frame control.',
    category: Category.VIDEO_GENERATION,
    link: 'https://klingai.com',
    tags: ['video', 'generative', 'animation', 'motion'],
    ageDays: 18,
    upvotes: 43,
  },
  {
    name: 'Granola',
    description:
      'Meeting notepad that merges what you typed with what was said, producing a clean summary without a bot joining the call.',
    category: Category.PRODUCTIVITY,
    link: 'https://www.granola.ai',
    tags: ['meetings', 'notes', 'transcription', 'summarisation'],
    ageDays: 22,
    upvotes: 37,
  },
];

/**
 * Two reference tools for comparing `/related` responses side by side.
 *
 * Deliberately from different categories with completely disjoint tag sets, so
 * their related lists cannot overlap. That makes them a quick sanity check that
 * relevance is genuinely being scored per source tool, rather than the endpoint
 * quietly returning the same popular tools to everyone.
 */
export const ANCHOR_TOOL_NAMES = ['Midjourney', 'GitHub Copilot'] as const;
