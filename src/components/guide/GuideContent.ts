// ============================================================================
// User Guide Content — Odyssean Grant Manager
// ============================================================================
// All guide text lives in this single file for easy maintenance.
// Components in the guide/ folder render this data; they never contain prose.
// ============================================================================

export interface GuideSection {
  heading: string;
  content: string;
  tips?: string[];
  steps?: string[];
}

export interface GuideModule {
  id: string;
  group: 'artefact' | 'workflow' | 'reference';
  title: string;
  icon: string;
  summary: string;
  relatedRoutes: string[];
  sections: GuideSection[];
}

// ── Artefact Modules ────────────────────────────────────────────────────────

const dashboard: GuideModule = {
  id: 'dashboard',
  group: 'artefact',
  title: 'Dashboard',
  icon: 'IconLayoutDashboard',
  summary:
    'A live overview of the discovery pipeline — from funders tracked through to scored opportunities.',
  relatedRoutes: ['/dashboard'],
  sections: [
    {
      heading: 'Stat Cards',
      content:
        'The four cards at the top summarise the current state of the pipeline:\n\n' +
        '• **Funders Tracked** — total funders in the database. Click to jump to the Funders page.\n' +
        '• **Sources** — number of configured web sources being monitored for grant opportunities.\n' +
        '• **Opportunities Found** — total opportunities extracted so far, with the count recommended to pursue.\n' +
        '• **Pursue Pipeline** — combined maximum funding value across all opportunities marked PURSUE.',
    },
    {
      heading: 'Discovery Pipeline',
      content:
        'A four-step progress tracker showing how far the pipeline has advanced:\n\n' +
        '1. Funders in Catalogue\n' +
        '2. Sources Configured (% of funders with at least one harvest source)\n' +
        '3. Opportunities Discovered (% of funders with at least one opportunity)\n' +
        '4. AI-Scored & Aligned (how many opportunities have been scored)',
      tips: [
        'The pipeline is a funnel — each step depends on the previous one. If coverage is low at step 2, focus on running Source Discovery for more funders.',
      ],
    },
    {
      heading: 'AI Recommendations',
      content:
        'The ring chart breaks down all opportunities by their AI-assigned action:\n\n' +
        '• **Pursue** (green) — strong alignment, worth applying to.\n' +
        '• **Monitor** (yellow) — partial fit, keep an eye on.\n' +
        '• **No-Go** (red) — poor alignment, not recommended.\n' +
        '• **Unscored** (grey) — not yet processed by the AI.',
    },
    {
      heading: 'Funder Landscape & Top Opportunities',
      content:
        'The bottom row shows a bar chart of funder types (Foundation, Trust, Public Research Funder, etc.) and a ranked list of the top 5 opportunities by AI fit score. Click any opportunity to view its detail page.',
    },
  ],
};

const catalogue: GuideModule = {
  id: 'catalogue',
  group: 'artefact',
  title: 'Catalogue',
  icon: 'IconBook2',
  summary:
    'The initial information source for funders — a curated list that can be integrated into the main Funders database.',
  relatedRoutes: ['/catalogue'],
  sections: [
    {
      heading: 'What Is the Catalogue?',
      content:
        'The Catalogue is a staging area for funder information. Entries here are not yet full Funder records — they are lightweight profiles that can be reviewed, enriched, and then integrated into the Funders list.\n\n' +
        'Think of it as a research notebook: you collect funder details here first, then promote them when ready.',
    },
    {
      heading: 'Catalogue Fields',
      content:
        '• **Name** — the funder organisation name.\n' +
        '• **Type** — Foundation, Trust, Public Research Funder, etc.\n' +
        '• **Focus Areas** — research themes the funder supports (e.g. AI Safety, Climate, Health).\n' +
        '• **Geographies** — regions where the funder operates or accepts applications.\n' +
        '• **Website URL** — the funder\'s main website.\n' +
        '• **Award Range** — typical minimum and maximum grant amounts.\n' +
        '• **Currency** — GBP, USD, or EUR.\n' +
        '• **Open Data** — whether the funder publishes grant data openly (Yes / Partial / No).\n' +
        '• **Notes** — free-text field for additional context.',
    },
    {
      heading: 'Catalogue vs Funders',
      content:
        'Catalogue entries and Funder records are separate. To move catalogue entries into the Funders list, use the "Integrate Catalogue" action on the Funders page. This creates proper Funder records with full relationship support (sources, opportunities, contacts).',
      tips: [
        'You can edit catalogue entries at any time before integration. Once integrated, changes should be made on the Funder record directly.',
      ],
    },
  ],
};

const funders: GuideModule = {
  id: 'funders',
  group: 'artefact',
  title: 'Funders',
  icon: 'IconBuildingBank',
  summary:
    'Organisations that provide grant funding. Each funder can have sources, opportunities, and contacts.',
  relatedRoutes: ['/funders'],
  sections: [
    {
      heading: 'Funders List',
      content:
        'The Funders page shows all funder records as cards. Each card displays:\n\n' +
        '• Funder name and type badge\n' +
        '• Website link\n' +
        '• Number of opportunities and contacts\n' +
        '• Tags (e.g. CATALOGUE, DISCOVERY)\n\n' +
        'Use the search bar to filter by name, type, description, geography, or tag.',
    },
    {
      heading: 'Funder Detail Page',
      content:
        'Click a funder to open its detail page, which has four tabs:\n\n' +
        '• **Overview** — name, type, website, description, geographies, notes.\n' +
        '• **Sources** — sources configured for this funder, plus the Source Discovery tool.\n' +
        '• **Opportunities** — all opportunities linked to this funder, with scores and recommendations.\n' +
        '• **Statistics** — summary metrics for this funder\'s opportunities.',
    },
    {
      heading: 'Integrate Catalogue',
      content:
        'On the Funders list page, the "Integrate Catalogue" button imports all catalogue entries as Funder records. Duplicates (matched by name) are skipped. This is a one-way operation — it creates funders but does not delete catalogue entries.',
    },
  ],
};

const opportunities: GuideModule = {
  id: 'opportunities',
  group: 'artefact',
  title: 'Opportunities',
  icon: 'IconSparkles',
  summary:
    'Grant opportunities discovered from funder websites, scored for alignment with Odyssean Institute research.',
  relatedRoutes: ['/opportunities'],
  sections: [
    {
      heading: 'Opportunities List',
      content:
        'Opportunities are grouped by funder in collapsible accordion sections. Each opportunity card shows:\n\n' +
        '• Program name\n' +
        '• Alignment score (percentage badge)\n' +
        '• AI recommendation (PURSUE / MONITOR / NO_GO)\n' +
        '• Award amount and deadline\n' +
        '• Link to the official funder page\n\n' +
        'Use the filters at the top to search by name, filter by alignment level, or filter by award amount.\n\n' +
        'Use **Sort By** to rank opportunities by fit score, deadline, or award amount. Switch **View** to "Flat List" for a single sorted list instead of funder groups.',
      tips: [
        'Accordion state is saved in your browser — sections you expand will stay open when you return.',
        'Click "Add Opportunity" at the top right to manually add an opportunity you found outside the system.',
      ],
    },
    {
      heading: 'Opportunity Detail — Overview',
      content:
        'The detail page header shows the program name, funder link, OI alignment score badge, deadline status (with colour coding for upcoming/past), award range, duration, geography, and eligible applicant types.\n\n' +
        'Click "View Official Page" to open the funder\'s original page in a new tab. If the URL is wrong, click the pencil icon next to the buttons to edit it.',
    },
    {
      heading: 'Opportunity Detail — OI Alignment Tab',
      content:
        'This tab appears when alignment data is available. It shows:\n\n' +
        '• **Overall match percentage** as a ring progress indicator\n' +
        '• **Recommendation badge** (Highly Relevant / Relevant / Somewhat Relevant)\n' +
        '• **Dimensional breakdown** — five progress bars:\n' +
        '  - Research Strand Match\n' +
        '  - Methodological Fit\n' +
        '  - Thematic Alignment\n' +
        '  - Impact Potential\n' +
        '  - Practical Feasibility\n' +
        '• **Analysis** — AI-generated strengths (✓) and concerns (⚠)',
    },
    {
      heading: 'Opportunity Detail — Eligibility Tab',
      content:
        'Shows structured eligibility information extracted by the AI:\n\n' +
        '• Eligible applicant types (e.g. Universities, Research Institutes)\n' +
        '• Geographic restrictions\n' +
        '• Additional eligibility details (process steps)\n' +
        '• Full eligibility text from the source page',
    },
    {
      heading: 'Opportunity Detail — Details Tab',
      content:
        'A timeline view of key grant information (program, funding, deadline, duration), funder description, and metadata including creation date, last update, extraction confidence, and tags.',
    },
  ],
};

const templates: GuideModule = {
  id: 'templates',
  group: 'artefact',
  title: 'Templates',
  icon: 'IconFileText',
  summary:
    'Reusable text templates for proposals, outreach, and budgets.',
  relatedRoutes: ['/templates'],
  sections: [
    {
      heading: 'Template Types',
      content:
        '• **Boilerplate 1-Line** — a single-sentence description of the organisation.\n' +
        '• **Boilerplate 1-Paragraph** — a short paragraph summary.\n' +
        '• **Boilerplate 1-Page** — a full-page organisational description.\n' +
        '• **Outreach** — template for initial contact with funders.\n' +
        '• **Budget** — template for budget sections of applications.',
    },
    {
      heading: 'Managing Templates',
      content:
        'Create, edit, and delete templates from the Templates page. Each template has a name, type, content body, and optional tags. Templates track their usage count automatically.',
      tips: [
        'Templates will connect to the Applications pipeline once it is available — you\'ll be able to insert template content directly into application drafts.',
      ],
    },
  ],
};

const contacts: GuideModule = {
  id: 'contacts',
  group: 'artefact',
  title: 'Contacts & Interactions',
  icon: 'IconUsers',
  summary:
    'People at funder organisations and a log of communications with them.',
  relatedRoutes: ['/contacts', '/interactions'],
  sections: [
    {
      heading: 'Contacts',
      content:
        'Contact records represent individuals at funder organisations. Each contact can be linked to a funder and optionally to a specific opportunity.\n\n' +
        'Fields: name, role/title, email, phone, notes, primary contact flag.',
    },
    {
      heading: 'Interactions',
      content:
        'Interactions log communications with contacts — emails, calls, meetings, etc. Each interaction records the type, a summary, the date, and links to the relevant contact and application.\n\n' +
        'This provides an audit trail of all funder communications.',
    },
  ],
};

const organisation: GuideModule = {
  id: 'organisation',
  group: 'artefact',
  title: 'Organisation',
  icon: 'IconBuildingCommunity',
  summary:
    'Organisation-wide settings — identity, programmes, LLM context blocks, funding parameters, branding, and system preferences. Admin only.',
  relatedRoutes: ['/admin/organisation'],
  sections: [
    {
      heading: 'Overview',
      content:
        'The Organisation page is the central configuration hub for the grant manager. All settings here are read by the backend at request time — changes take effect immediately on save, without a server restart.\n\n' +
        'Access is restricted to Admin users. Navigate via the navbar or sidebar.',
    },
    {
      heading: 'Identity Tab',
      content:
        'Three sections:\n\n' +
        '• **Basic information** — display name, legal name, organisation type, sector, year founded, staff count, website.\n' +
        '• **Registration & location** — charity number, company number, other identifier, HQ city and country.\n' +
        '• **Narrative** — elevator pitch (used as a concise org summary throughout the LLM pipeline), plus mission and vision statements.',
      tips: [
        'The elevator pitch is injected into multiple LLM prompts. Keep it concise, specific, and keyword-rich.',
      ],
    },
    {
      heading: 'Programmes Tab',
      content:
        'Research strands or strategic programmes. Each programme has:\n\n' +
        '• Name and description\n' +
        '• Keywords, themes, methodologies, and output types\n\n' +
        'Programme data feeds directly into alignment scoring — the AI reads these when deciding how well a grant fits the organisation. Cross-cutting themes, geographic priorities, and applicant type descriptors apply across all programmes.',
      tips: [
        'The more specific and keyword-rich your programmes are, the better the AI alignment scoring will be.',
        'Add or remove programmes at any time — changes are reflected in the next scoring run.',
      ],
    },
    {
      heading: 'LLM Context Tab',
      content:
        'Three context blocks that are injected verbatim into LLM prompts at different pipeline stages:\n\n' +
        '• **Discovery context** — injected when assessing whether a web page is a relevant grant opportunity. Should be keyword-rich and focused on themes, methods, and scope.\n' +
        '• **Alignment scoring context** — injected when scoring how well a grant fits the organisation. Can be more detailed and nuanced.\n' +
        '• **Application writing context** — injected when generating application structures and drafting section content. Include organisational boilerplate, track record, and capacity information.\n\n' +
        'Each context block can be collapsed by clicking its header. When collapsed, the header shows word and token counts.',
      tips: [
        'Token estimates are approximate (word count × 1.3). Keep contexts focused — very long contexts increase cost and can dilute LLM attention.',
        'Use the Summarise tool to condense source material into a dense context block automatically.',
      ],
    },
    {
      heading: 'LLM Context — Source Tools',
      content:
        'Each context block has a source material panel for building and refining context:\n\n' +
        '• **Paste area** — paste raw text (documents, notes, strategy papers) and click **Add** to queue it as a source.\n' +
        '• **Drop zone** — drop `.txt` or `.md` files directly onto the panel (up to 5 MB each).\n' +
        '• **Source list** — queued sources are listed with word counts and can be removed individually.\n\n' +
        '**Toolbar actions:**\n' +
        '• **Add** — adds the pasted text as a named source entry.\n' +
        '• **Revise** — sends the current context output plus any queued sources to the LLM; the result replaces the context. Use this to holistically update an existing context with new material.\n' +
        '• **Replace / Append toggle** — controls whether Summarise replaces the context output or appends to it.\n' +
        '• **Summarise** — sends queued sources to the LLM and writes a high-density summary into the context output field.',
      tips: [
        'Revise is best when you already have a context and want to integrate new information into it.',
        'Summarise is best when starting from scratch with a set of source documents.',
        'The Append mode is useful for incrementally building a context from multiple summarisation passes.',
      ],
    },
    {
      heading: 'Funding Tab',
      content:
        'Award and duration parameters used in alignment scoring to assess practical feasibility:\n\n' +
        '• **Award parameters** — minimum, maximum, and ideal range (lower and upper bound) in the organisation\'s primary currency.\n' +
        '• **Duration parameters** — minimum, maximum, and ideal range in months.\n' +
        '• **Preferred currencies** — ISO codes (GBP, EUR, USD, etc.) for currencies the organisation actively tracks.',
    },
    {
      heading: 'Branding Tab',
      content:
        'Logo URLs (primary and monochrome/secondary) and brand colour palette (primary, secondary, accent). These are stored for future use in generated documents and white-label features.',
    },
    {
      heading: 'System Tab',
      content:
        'LLM configuration:\n\n' +
        '• **Preferred LLM provider** — Gemini (default), Anthropic Claude, or Auto. The active provider is also controlled by the `LLM_PROVIDER` environment variable on the backend.\n' +
        '• **Temperature per use case** — separate temperature values for discovery (default 0, deterministic), alignment scoring (default 0.3), and application writing (default 0.7, more generative).',
    },
    {
      heading: 'Saving Changes',
      content:
        'An orange "Unsaved changes" badge appears whenever you have modified settings. Click **Save changes** at the top right to persist all changes to the database. The backend reads the latest saved values on every request — there is no cache to clear.',
      tips: [
        'Use "Reset to defaults" to restore all settings to the built-in Odyssean Institute defaults. This cannot be undone.',
      ],
    },
  ],
};

const admin: GuideModule = {
  id: 'admin',
  group: 'artefact',
  title: 'Administration',
  icon: 'IconShield',
  summary:
    'User management, roles, and password administration. Visible to Admin users only.',
  relatedRoutes: ['/admin'],
  sections: [
    {
      heading: 'User List',
      content:
        'The Admin → Users page shows all registered users with their username, name, email, role badge, active status, and last login time.',
    },
    {
      heading: 'Roles',
      content:
        '• **Admin** — full access to all features including user management and Organisation settings.\n' +
        '• **Grants Officer** — access to all grant management features (funders, opportunities, applications, etc.) but not user administration or Organisation settings.\n' +
        '• **Reviewer** — read-only access for reviewing opportunities and applications.',
    },
    {
      heading: 'Password Management',
      content:
        '• **Change your own password** — click the key icon next to your name. You must enter your current password.\n' +
        '• **Admin reset** — Admins can reset any other user\'s password by clicking the reset icon. This sets a new password without requiring the old one.',
    },
  ],
};

// ── Workflow Modules ────────────────────────────────────────────────────────

const wfCatalogueEdit: GuideModule = {
  id: 'wf-catalogue-edit',
  group: 'workflow',
  title: 'Editing the Catalogue',
  icon: 'IconWand',
  summary:
    'How to add funders to the catalogue using LLM-assisted auto-fill or manual entry.',
  relatedRoutes: ['/catalogue'],
  sections: [
    {
      heading: 'Auto-Fill (Recommended)',
      content:
        'The fastest way to add a funder. The system uses an LLM to extract structured information from the funder\'s website.',
      steps: [
        'Navigate to the Catalogue Editor page.',
        'Paste the funder\'s website URL into the "Funder URL" field.',
        'Click "Auto-Fill". The system will scrape the website and extract name, type, focus areas, geographies, and description.',
        'Review the pre-populated form in the modal that opens. Correct any fields as needed.',
        'Click "Create" to save the catalogue entry.',
      ],
      tips: [
        'Auto-Fill works best with well-structured funder websites that have clear "About" or "What we fund" pages.',
        'If Auto-Fill fails, you\'ll see an error message — fall back to Manual Entry.',
      ],
    },
    {
      heading: 'Manual Entry',
      content:
        'For funders where Auto-Fill doesn\'t work, or when you want full control over the data.',
      steps: [
        'Click "Manual Entry" on the Catalogue Editor page.',
        'Fill in the required fields: Name, Website URL, and Type.',
        'Add optional fields: focus areas, geographies, award range, currency, open data status, and notes.',
        'Click "Create" to save.',
      ],
    },
    {
      heading: 'Editing & Deleting',
      content:
        'In the catalogue table, use the pencil icon to edit an entry (opens the same form modal) or the trash icon to delete (with confirmation prompt).',
    },
  ],
};

const wfCatalogueIntegrate: GuideModule = {
  id: 'wf-catalogue-integrate',
  group: 'workflow',
  title: 'Integrating the Catalogue',
  icon: 'IconTransform',
  summary:
    'How to promote catalogue entries into full Funder records.',
  relatedRoutes: ['/funders'],
  sections: [
    {
      heading: 'Running Integration',
      content:
        'Integration creates Funder records from your catalogue entries, making them available for source discovery and opportunity harvesting.',
      steps: [
        'Navigate to the Funders page.',
        'Click the "Integrate Catalogue" button.',
        'Confirm the action in the dialog.',
        'The system will create Funder records for each catalogue entry. Duplicates (matched by name) are skipped.',
        'New funders appear in the list with a CATALOGUE tag.',
      ],
      tips: [
        'Integration is additive — it never deletes existing funders or catalogue entries.',
        'After integration, manage the funder from the Funders page. The catalogue entry remains as a reference.',
      ],
    },
  ],
};

const wfSourceDiscovery: GuideModule = {
  id: 'wf-source-discovery',
  group: 'workflow',
  title: 'Discovering Sources',
  icon: 'IconWorldSearch',
  summary:
    'How to find grant-related pages on a funder\'s website using intelligent crawling.',
  relatedRoutes: ['/funders/'],
  sections: [
    {
      heading: 'What Is Source Discovery?',
      content:
        'Source Discovery crawls a funder\'s website to find pages that are likely to contain grant or funding opportunity information. It analyses navigation structure, identifies scheme/programme links, and scores each page for relevance against the organisation\'s discovery context.\n\n' +
        'The discovered pages become "suggested sources" that you can selectively add as sources. Relevance scoring is more accurate when the Organisation → LLM Context → Discovery context is up to date.',
    },
    {
      heading: 'Running Discovery',
      content: '',
      steps: [
        'Open a funder\'s detail page and go to the Sources tab.',
        'In the "Discover Pages" section, optionally add manual URLs if you know specific grant pages.',
        'Set the search depth (1–3 levels). Higher depth explores more pages but takes longer.',
        'Click "Discover Pages" to start the crawl.',
        'A progress bar shows the job status. Discovery typically takes 30–90 seconds.',
        'When complete, a list of discovered pages appears with relevance scores.',
      ],
      tips: [
        'Start with depth 1 for a quick scan. Use depth 2–3 if the funder has a complex site structure.',
        'Adding manual URLs is useful when you already know the grants page but want the system to find related pages.',
      ],
    },
    {
      heading: 'Creating Sources from Discoveries',
      content: '',
      steps: [
        'Review the discovered pages. Each shows a URL, page title, and relevance score.',
        'Tick the checkbox next to pages you want to monitor.',
        'Click "Create N Sources" to add them as sources.',
        'The new sources appear in the "Configured Sources" section, ready for inspection.',
      ],
    },
  ],
};

const wfSourceInspection: GuideModule = {
  id: 'wf-source-inspection',
  group: 'workflow',
  title: 'Inspecting Sources',
  icon: 'IconSearch',
  summary:
    'How to extract grant opportunities from configured sources using LLM analysis.',
  relatedRoutes: ['/funders/'],
  sections: [
    {
      heading: 'What Is Source Inspection?',
      content:
        'Source Inspection fetches the HTML content of a configured source page and uses an LLM to extract structured grant opportunity data. It identifies programme names, deadlines, award amounts, eligibility criteria, and more.\n\n' +
        'Extracted opportunities are automatically scored for alignment with the organisation and integrated into the database. The scoring uses the alignment context and programme data configured in the Organisation settings.',
    },
    {
      heading: 'Running an Inspection',
      content: '',
      steps: [
        'On a funder\'s detail page, go to the Sources tab.',
        'In the "Configured Sources" section, find the source you want to inspect.',
        'Click the "Inspect" button next to the source.',
        'A progress indicator shows the extraction status. Inspection typically takes 20–60 seconds.',
        'When complete, new opportunities appear in the funder\'s Opportunities tab.',
      ],
    },
    {
      heading: 'What Happens During Inspection',
      content:
        'The inspection process runs several stages:\n\n' +
        '1. **HTML Fetch** — downloads the source page content.\n' +
        '2. **LLM Extraction** — the LLM analyses the page and extracts grant data in structured JSON format.\n' +
        '3. **Eligibility Extraction** — a second LLM pass extracts detailed eligibility criteria.\n' +
        '4. **Alignment Scoring** — each opportunity is scored across 5 dimensions using the organisation\'s alignment context and programme data.\n' +
        '5. **Auto-Integration** — opportunities are saved to the database and linked to the funder.',
      tips: [
        'If a source page has changed since the last inspection, re-running will update existing opportunities and add new ones.',
        'The LLM uses anti-hallucination rules — it will only extract information explicitly present on the page.',
        'Alignment scoring quality improves with richer programme and context data in the Organisation settings.',
      ],
    },
  ],
};

const wfAddOpportunity: GuideModule = {
  id: 'wf-add-opportunity',
  group: 'workflow',
  title: 'Adding Opportunities Manually',
  icon: 'IconSparkles',
  summary:
    'How to add a grant opportunity you found outside the automated discovery pipeline.',
  relatedRoutes: ['/opportunities'],
  sections: [
    {
      heading: 'When to Add Manually',
      content:
        'The automated pipeline (Source Discovery → Source Inspection) is the primary way opportunities enter the system. However, you may find opportunities through personal research, email alerts, or colleague recommendations that are not on a monitored source page.\n\n' +
        'Manual entry lets you add these to the system so they can be tracked, scored, and managed alongside automated discoveries.',
    },
    {
      heading: 'Adding an Opportunity',
      content: '',
      steps: [
        'Go to the Opportunities page.',
        'Click the "Add Opportunity" button at the top right.',
        'Select the **Funder** from the dropdown (required). If the funder is not listed, add them via the Catalogue Editor first.',
        'Enter the **Program Name** (e.g. "Open Research Fund 2025").',
        'Paste the **Source URL** — the web page where you found the opportunity.',
        'Optionally add a description and select the application type (Open, Invited, or Rolling).',
        'Click "Create Opportunity". You will be taken to the new opportunity\'s detail page.',
      ],
      tips: [
        'After creation, you can edit the URLs by clicking the pencil icon on the detail page.',
        'Manually added opportunities do not have AI scores initially. You can trigger scoring from the detail page once more data is added.',
      ],
    },
  ],
};

const wfOpportunityReview: GuideModule = {
  id: 'wf-opportunity-review',
  group: 'workflow',
  title: 'Reviewing Opportunities',
  icon: 'IconTarget',
  summary:
    'How to evaluate discovered opportunities using AI scores, alignment data, and eligibility information.',
  relatedRoutes: ['/opportunities/'],
  sections: [
    {
      heading: 'Browsing Opportunities',
      content: '',
      steps: [
        'Go to the Opportunities page to see all opportunities grouped by funder.',
        'Use the search bar to find specific programmes by name.',
        'Use the Alignment filter to show only High (≥70%), Medium (40–69%), or Low (<40%) alignment.',
        'Use the Amount filter to narrow by award size.',
        'Click any opportunity to open its detail page.',
      ],
    },
    {
      heading: 'Interpreting AI Scores',
      content:
        '• **Fit Score (0–10)** — overall suitability for Odyssean Institute. Scores ≥7 are strong matches.\n' +
        '• **Alignment Percentage** — derived from the 5 dimensional scores, shown as a tag on the list and a ring on the detail page.\n' +
        '• **Recommendation** — PURSUE (apply), MONITOR (watch), or NO_GO (skip).\n' +
        '• **Confidence** — how confident the AI is in its extraction (shown in the Details tab metadata).',
      tips: [
        'AI scores are a starting point, not a final decision. Always review the official funder page before committing to an application.',
      ],
    },
    {
      heading: 'Checking Eligibility',
      content:
        'The Eligibility tab on the detail page shows extracted criteria:\n\n' +
        '• Eligible applicant types (e.g. "UK Higher Education Institutions")\n' +
        '• Geographic restrictions\n' +
        '• Process steps and requirements\n' +
        '• Full eligibility text from the source\n\n' +
        'Cross-reference this with the official page to confirm accuracy.',
    },
  ],
};

const wfPipeline: GuideModule = {
  id: 'wf-pipeline-overview',
  group: 'workflow',
  title: 'The Discovery Pipeline',
  icon: 'IconRocket',
  summary:
    'The end-to-end flow from catalogue research through to scored opportunities.',
  relatedRoutes: ['/dashboard'],
  sections: [
    {
      heading: 'Pipeline Stages',
      content:
        'The Odyssean Grant Manager follows a structured pipeline:\n\n' +
        '**Stage 0: Organisation** → Configure identity, programmes, and LLM context blocks. These drive relevance and scoring quality throughout every later stage.\n\n' +
        '**Stage 1: Catalogue** → Research and collect funder information in the Catalogue Editor. Use Auto-Fill to quickly extract data from funder websites.\n\n' +
        '**Stage 2: Funders** → Integrate catalogue entries to create Funder records. Each funder becomes a trackable entity with its own sources, opportunities, and contacts.\n\n' +
        '**Stage 3: Sources** → Run Source Discovery on each funder to find grant-related pages. Select the best pages and create sources.\n\n' +
        '**Stage 4: Opportunities** → Run Source Inspection on configured sources. The LLM extracts grant data, scores it for alignment using the organisation\'s context, and creates Opportunity records.\n\n' +
        '**Stage 5: Applications** → Select promising opportunities and create application drafts. The LLM uses the organisation\'s application context when generating templates and drafting section content.',
    },
    {
      heading: 'Monitoring Progress',
      content:
        'The Dashboard provides a live view of pipeline progress. The Discovery Pipeline section shows what percentage of funders have progressed through each stage. Use this to identify bottlenecks — for example, if many funders lack sources, prioritise running Source Discovery.',
    },
    {
      heading: 'Keeping Context Current',
      content:
        'The quality of AI outputs across all stages depends on the Organisation → LLM Context blocks being accurate and up to date. Revisit them whenever the organisation\'s research agenda, programmes, or strategic priorities change.',
    },
  ],
};

const wfOrganisationSetup: GuideModule = {
  id: 'wf-organisation-setup',
  group: 'workflow',
  title: 'Configuring Organisation Context',
  icon: 'IconBrain',
  summary:
    'How to set up and maintain the LLM context blocks that drive discovery, alignment scoring, and application drafting.',
  relatedRoutes: ['/admin/organisation'],
  sections: [
    {
      heading: 'Why Context Matters',
      content:
        'The three LLM context blocks — Discovery, Alignment, and Application — are injected directly into AI prompts at each pipeline stage. Well-crafted context significantly improves:\n\n' +
        '• The accuracy of source relevance scoring during discovery\n' +
        '• The quality and specificity of alignment scores\n' +
        '• The relevance of generated application structures and drafted content\n\n' +
        'Think of context blocks as a briefing document you write for the AI — the more precise and information-dense, the better.',
    },
    {
      heading: 'Building a Context from Scratch',
      content: '',
      steps: [
        'Go to Organisation → LLM Context tab.',
        'Click a context block header to expand it.',
        'In the source material panel, paste relevant documents (strategy papers, research agendas, annual reports) into the paste area, clicking Add after each.',
        'Alternatively, drop .txt or .md files onto the drop zone.',
        'Once sources are queued, click Summarise. The LLM will produce a dense, structured summary optimised for use in AI prompts.',
        'Review and edit the output in the context field below.',
        'Click Save changes at the top of the page.',
      ],
      tips: [
        'Start with your most comprehensive strategic document (e.g. a research agenda or funding strategy).',
        'The Summarise output is designed for LLM readers, not humans — it prioritises density over readability.',
      ],
    },
    {
      heading: 'Updating an Existing Context',
      content: '',
      steps: [
        'Queue any new source material (paste or drop files).',
        'Use Revise if you want the new material integrated holistically into the existing context.',
        'Use Append + Summarise if you want to add a supplementary block to the end of the existing context without rewriting it.',
        'Save when done.',
      ],
    },
    {
      heading: 'Discovery vs Alignment Context',
      content:
        '• **Discovery context** — used when scanning web pages for relevance. Optimise for breadth: include research themes, methodologies, and keywords that signal relevant grant pages.\n\n' +
        '• **Alignment context** — used when scoring individual opportunities. Can be more detailed and nuanced. Include programme descriptions, strategic priorities, and eligibility preferences.\n\n' +
        '• **Application context** — used when generating application structures and drafting content. Include organisational boilerplate, track record, capacity information, and anything useful to pre-populate in applications.',
    },
  ],
};

// ── Reference Modules ───────────────────────────────────────────────────────

const refRoles: GuideModule = {
  id: 'ref-roles',
  group: 'reference',
  title: 'User Roles',
  icon: 'IconShieldCheck',
  summary:
    'What each role can access and do in the system.',
  relatedRoutes: ['/admin'],
  sections: [
    {
      heading: 'Role Permissions',
      content:
        '| Role | Access |\n' +
        '|------|--------|\n' +
        '| **Admin** | Everything — funders, opportunities, catalogue, templates, contacts, interactions, user management, Organisation settings, password resets |\n' +
        '| **Grants Officer** | All grant management features. Cannot access Admin → Users or Organisation settings. |\n' +
        '| **Reviewer** | Read-only access to review opportunities and applications. |',
    },
  ],
};

const refScoring: GuideModule = {
  id: 'ref-scoring',
  group: 'reference',
  title: 'AI Scoring Explained',
  icon: 'IconChartBar',
  summary:
    'How fit scores, alignment dimensions, and recommendations work.',
  relatedRoutes: ['/opportunities'],
  sections: [
    {
      heading: 'Fit Score',
      content:
        'A number from 0 to 10 representing overall suitability for the organisation. The score is computed from weighted factors: alignment (50%), geography (20%), applicant type (20%), and award size (10%).\n\n' +
        '• **7–10** — Strong match (typically PURSUE)\n' +
        '• **4–6.9** — Moderate match (typically MONITOR)\n' +
        '• **0–3.9** — Weak match (typically NO_GO)',
    },
    {
      heading: 'Alignment Dimensions',
      content:
        'Each opportunity is scored across five dimensions (0–100%). The LLM uses the organisation\'s alignment context and programme data when computing these:\n\n' +
        '• **Research Strand Match** — overlap with the organisation\'s research areas and programmes.\n' +
        '• **Methodological Fit** — compatibility with the organisation\'s research methods.\n' +
        '• **Thematic Alignment** — relevance to the organisation\'s themes and priorities.\n' +
        '• **Impact Potential** — potential for meaningful real-world impact.\n' +
        '• **Practical Feasibility** — logistical and resource fit (award size, duration, geography).',
      tips: [
        'Scoring quality improves when the Organisation → Programmes and LLM Context → Alignment context are detailed and up to date.',
      ],
    },
    {
      heading: 'Recommendations',
      content:
        '• **PURSUE** — the opportunity is a strong fit. Consider preparing an application.\n' +
        '• **MONITOR** — partial fit. Worth tracking for future rounds or if criteria change.\n' +
        '• **NO_GO** — poor fit. Not recommended for application.',
    },
    {
      heading: 'Extraction Confidence',
      content:
        'A percentage (0–100%) indicating how confident the AI is in the accuracy of the extracted data. Low confidence may indicate the source page was poorly structured or the information was ambiguous.',
    },
  ],
};

const refStatuses: GuideModule = {
  id: 'ref-statuses',
  group: 'reference',
  title: 'Status & Stage Reference',
  icon: 'IconListCheck',
  summary:
    'Quick reference for all status values used across the system.',
  relatedRoutes: [],
  sections: [
    {
      heading: 'Opportunity Status',
      content:
        '• **Open** — the funding call is currently accepting applications.\n' +
        '• **Closed** — the deadline has passed.\n' +
        '• **Unknown** — status could not be determined from the source.',
    },
    {
      heading: 'Application Stage',
      content:
        '• **Triage** — initial assessment of whether to pursue.\n' +
        '• **Prep** — gathering materials and drafting the application.\n' +
        '• **Review** — internal review before submission.\n' +
        '• **Submit** — application has been submitted.\n' +
        '• **Awarded** — funding was granted.\n' +
        '• **Rejected** — application was unsuccessful.',
    },
  ],
};

const refTips: GuideModule = {
  id: 'ref-tips',
  group: 'reference',
  title: 'Tips & Shortcuts',
  icon: 'IconBulb',
  summary:
    'Useful tips for navigating and using the system efficiently.',
  relatedRoutes: [],
  sections: [
    {
      heading: 'Search & Filtering',
      content:
        '• Most list pages have a search bar that filters across multiple fields (name, type, description, tags).\n' +
        '• The Opportunities page supports combined filters: search + alignment level + award amount.\n' +
        '• Funder Detail page search works within that funder\'s data only.',
    },
    {
      heading: 'Persistent State',
      content:
        '• Accordion sections on the Opportunities page remember which funders you expanded (saved in browser storage).\n' +
        '• Your login session persists until you explicitly log out or the JWT expires.',
    },
    {
      heading: 'External Links',
      content:
        '• Funder website links and opportunity source URLs open in new tabs.\n' +
        '• The "View Official Page" button on opportunity details always links to the original funder page.',
    },
    {
      heading: 'URL Bookmarking',
      content:
        'You can bookmark any page directly:\n\n' +
        '• `/funders/[id]` — a specific funder\n' +
        '• `/opportunities/[id]` — a specific opportunity\n' +
        '• `/contacts/[id]` — a specific contact',
    },
  ],
};

// ── Export ───────────────────────────────────────────────────────────────────

export const GUIDE_MODULES: GuideModule[] = [
  // Artefacts
  dashboard,
  catalogue,
  funders,
  opportunities,
  templates,
  contacts,
  organisation,
  admin,
  // Workflows
  wfPipeline,
  wfOrganisationSetup,
  wfCatalogueEdit,
  wfCatalogueIntegrate,
  wfSourceDiscovery,
  wfSourceInspection,
  wfAddOpportunity,
  wfOpportunityReview,
  // Reference
  refRoles,
  refScoring,
  refStatuses,
  refTips,
];

export const GUIDE_GROUPS = [
  { key: 'artefact', label: 'Data & Pages' },
  { key: 'workflow', label: 'Workflows' },
  { key: 'reference', label: 'Quick Reference' },
] as const;
