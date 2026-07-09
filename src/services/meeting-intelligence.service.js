const DEFAULT_TEMPLATE = 'general';

const TEMPLATES = {
  general: {
    id: 'general',
    name: 'General meeting',
    description: 'Summary, decisions, action items, questions, and follow-up.',
    sections: ['Summary', 'Decisions', 'Action items', 'Open questions', 'Follow-up']
  },
  product: {
    id: 'product',
    name: 'Product review',
    description: 'Feature requests, user pain, PRD outline, and next steps.',
    sections: ['Context', 'User pain', 'Feature requests', 'Decisions', 'PRD draft', 'Next steps']
  },
  sales: {
    id: 'sales',
    name: 'Sales call',
    description: 'Customer context, objections, buying signals, risks, and follow-up.',
    sections: ['Account context', 'Pain points', 'Objections', 'Buying signals', 'Next steps']
  },
  interview: {
    id: 'interview',
    name: 'User interview',
    description: 'Jobs, pain points, quotes, feature requests, and willingness to pay.',
    sections: ['Participant context', 'Current workflow', 'Pain points', 'Quotes', 'Feature requests']
  },
  standup: {
    id: 'standup',
    name: 'Stand-up',
    description: 'Progress, blockers, owners, and next commitments.',
    sections: ['Progress', 'Blockers', 'Today', 'Owners', 'Risks']
  },
  one_on_one: {
    id: 'one_on_one',
    name: '1:1',
    description: 'Topics, feedback, commitments, concerns, and follow-up.',
    sections: ['Topics', 'Feedback', 'Commitments', 'Concerns', 'Follow-up']
  },
  hiring: {
    id: 'hiring',
    name: 'Hiring interview',
    description: 'Candidate signals, concerns, role fit, and next steps.',
    sections: ['Role fit', 'Strengths', 'Concerns', 'Evidence', 'Recommendation']
  }
};

const ACTION_RE = /\b(action|todo|to-do|follow up|next step|owner|assign|send|share|schedule|draft|create|fix|ship|review|update|email|call|by\s+(monday|tuesday|wednesday|thursday|friday|tomorrow|today|eod|next week))\b/i;
const DECISION_RE = /\b(decided|decision|agreed|approved|final|confirmed|go with|chose|choose|will use|we will|locked|resolved)\b/i;
const QUESTION_RE = /\?|(?:\b(what|why|how|when|who|where|should|can|could|would)\b.*\?*)/i;
const RISK_RE = /\b(blocked|blocker|risk|issue|problem|concern|delay|stuck|pending|dependency|deprioritized|failed)\b/i;
const FEATURE_RE = /\b(feature|request|want|need|template|integration|dashboard|workflow|automation|report|export|search|mobile|sharing|calendar|transcript|diarization)\b/i;
const BUYING_RE = /\b(price|budget|paid|pay|contract|procurement|security|legal|approval|renewal|pilot|trial)\b/i;
const NAME_RE = /\b([A-Z][a-z]+)\s+(?:to|will|should|can|needs to)\b/;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = cleanText(value).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 220);
}

function asBullets(items, emptyText = 'No clear items found.') {
  const list = unique(items).slice(0, 8);
  if (list.length === 0) return [`- ${emptyText}`];
  return list.map(item => `- ${item}`);
}

function transcriptText(session) {
  return session?.diarizedTranscriptHinglish
    || session?.transcriptHinglish
    || session?.diarizedTranscript
    || session?.transcript
    || '';
}

function rawNotesText(session) {
  return cleanText(session?.rawNotes || session?.notesDraft || '');
}

function templateFor(id) {
  return TEMPLATES[id] || TEMPLATES[DEFAULT_TEMPLATE];
}

function meetingDate(session) {
  const value = session?.startedAt || session?.createdAt;
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toISOString().slice(0, 10);
}

function pick(sentences, pattern, limit = 5) {
  return unique(sentences.filter(sentence => pattern.test(sentence))).slice(0, limit);
}

function fallbackSummary(sentences) {
  const scored = sentences.map(sentence => {
    let score = Math.min(sentence.length, 240) / 240;
    if (ACTION_RE.test(sentence)) score += 0.7;
    if (DECISION_RE.test(sentence)) score += 0.7;
    if (RISK_RE.test(sentence)) score += 0.5;
    if (FEATURE_RE.test(sentence)) score += 0.4;
    return { sentence, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .map(item => item.sentence)
    .slice(0, 5);
}

function actionItems(sentences) {
  return pick(sentences, ACTION_RE, 8).map(sentence => {
    const owner = sentence.match(NAME_RE)?.[1] || null;
    return {
      text: sentence,
      owner,
      status: 'open'
    };
  });
}

function buildFollowUpEmail(session, intelligence) {
  const title = session?.title || 'our meeting';
  const actions = intelligence.actionItems.map(item => `- ${item.text}`).join('\n');
  const decisions = intelligence.decisions.map(item => `- ${item}`).join('\n');
  return [
    `Subject: Follow-up from ${title}`,
    '',
    'Hi,',
    '',
    'Thanks for the conversation. Here is the concise recap:',
    '',
    'Key points:',
    ...asBullets(intelligence.summary).map(line => line),
    '',
    decisions ? `Decisions:\n${decisions}` : 'Decisions:\n- No explicit decisions captured.',
    '',
    actions ? `Next steps:\n${actions}` : 'Next steps:\n- No explicit next steps captured.',
    '',
    'Best,'
  ].join('\n');
}

function buildProjectPlan(session, intelligence) {
  return [
    `# ${session?.title || 'Meeting'} project plan`,
    '',
    '## Objective',
    intelligence.summary[0] || 'Turn the meeting discussion into a tracked plan.',
    '',
    '## Workstreams',
    ...asBullets(intelligence.featureRequests.length ? intelligence.featureRequests : intelligence.summary, 'No workstreams found.'),
    '',
    '## Decisions',
    ...asBullets(intelligence.decisions, 'No decisions captured.'),
    '',
    '## Action items',
    ...asBullets(intelligence.actionItems.map(item => item.text), 'No action items captured.'),
    '',
    '## Risks',
    ...asBullets(intelligence.risks, 'No risks captured.')
  ].join('\n');
}

function buildTemplateSections(template, intelligence) {
  const sections = {};
  for (const section of template.sections) {
    const key = section.toLowerCase();
    if (/decision/.test(key)) sections[section] = intelligence.decisions;
    else if (/action|next|owner|commitment/.test(key)) sections[section] = intelligence.actionItems.map(item => item.text);
    else if (/question/.test(key)) sections[section] = intelligence.questions;
    else if (/risk|block|concern|objection/.test(key)) sections[section] = intelligence.risks;
    else if (/feature|prd|pain|workflow|signal|quote|context|topic|progress|feedback|strength/.test(key)) {
      sections[section] = unique([
        ...intelligence.featureRequests,
        ...intelligence.summary
      ]).slice(0, 6);
    } else {
      sections[section] = intelligence.summary;
    }
  }
  return sections;
}

function buildEnhancedMarkdown(session, intelligence) {
  const sections = Object.entries(intelligence.sections)
    .map(([name, values]) => [
      `## ${name}`,
      ...asBullets(values)
    ].join('\n'))
    .join('\n\n');
  const rawNotes = rawNotesText(session);
  return [
    `# ${session?.title || 'Meeting notes'}`,
    '',
    `Date: ${meetingDate(session)}`,
    `Template: ${intelligence.templateName}`,
    '',
    sections,
    rawNotes ? `\n## Raw notes\n${rawNotes}` : ''
  ].filter(Boolean).join('\n');
}

function buildMeetingIntelligence(session) {
  const template = templateFor(session?.noteTemplate || session?.meetingTemplate);
  const source = [rawNotesText(session), transcriptText(session)].filter(Boolean).join('\n');
  const sentences = splitSentences(source);
  const summary = unique([
    ...splitSentences(rawNotesText(session)).slice(0, 5),
    ...fallbackSummary(sentences)
  ]).slice(0, 8);
  const intelligence = {
    templateId: template.id,
    templateName: template.name,
    generatedAt: new Date().toISOString(),
    summary,
    decisions: pick(sentences, DECISION_RE, 8),
    questions: pick(sentences, QUESTION_RE, 8),
    risks: pick(sentences, RISK_RE, 8),
    featureRequests: pick(sentences, FEATURE_RE, 8),
    buyingSignals: pick(sentences, BUYING_RE, 6),
    actionItems: actionItems(sentences)
  };
  intelligence.sections = buildTemplateSections(template, intelligence);
  intelligence.followUpEmail = buildFollowUpEmail(session, intelligence);
  intelligence.projectPlan = buildProjectPlan(session, intelligence);
  intelligence.enhancedMarkdown = buildEnhancedMarkdown(session, intelligence);
  return intelligence;
}

function enrichMeetingSession(session) {
  if (!session) return session;
  const intelligence = session.meetingIntelligence || buildMeetingIntelligence(session);
  return {
    ...session,
    noteTemplate: session.noteTemplate || DEFAULT_TEMPLATE,
    folder: session.folder || 'My notes',
    space: session.space || 'Private',
    meetingIntelligence: intelligence
  };
}

function buildBrief(session, allSessions = []) {
  const title = cleanText(session?.title || '');
  const titleTerms = title.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
  const related = allSessions
    .filter(item => item && item.id !== session?.id && item.status === 'completed')
    .map(item => {
      const haystack = `${item.title || ''} ${rawNotesText(item)} ${transcriptText(item)}`.toLowerCase();
      const score = titleTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { item, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(entry => enrichMeetingSession(entry.item));

  return {
    title: session?.title || 'Meeting',
    preparedAt: new Date().toISOString(),
    context: related.length
      ? related.map(item => `${item.title || item.id}: ${(item.meetingIntelligence.summary || [])[0] || 'Related meeting found.'}`)
      : ['No related previous meetings found in the local library.'],
    openThreads: unique(related.flatMap(item => item.meetingIntelligence.actionItems || []).map(item => item.text)).slice(0, 5),
    suggestedAgenda: unique([
      'Confirm goals for this conversation.',
      'Review open decisions and blockers.',
      'Capture owners and next steps before ending.'
    ])
  };
}

function scoreChunk(question, text) {
  const terms = cleanText(question).toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 2);
  const lower = cleanText(text).toLowerCase();
  return terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
}

function answerQuestion(question, sessions, { sessionId = null } = {}) {
  const scoped = sessions
    .filter(session => !sessionId || session.id === sessionId)
    .map(enrichMeetingSession);
  const q = cleanText(question);
  const lower = q.toLowerCase();
  if (!q) return { answer: 'Ask a question about your meetings.', sources: [] };

  if (/follow.?up.*email|email/.test(lower) && scoped[0]) {
    return {
      answer: scoped[0].meetingIntelligence.followUpEmail,
      sources: [{ id: scoped[0].id, title: scoped[0].title }]
    };
  }

  if (/project plan|prd|spec|brief/.test(lower) && scoped[0]) {
    return {
      answer: scoped[0].meetingIntelligence.projectPlan,
      sources: [{ id: scoped[0].id, title: scoped[0].title }]
    };
  }

  if (/action|next step|todo|follow/.test(lower)) {
    const items = scoped.flatMap(session => (session.meetingIntelligence.actionItems || []).map(item => ({
      session,
      text: item.text
    }))).slice(0, 10);
    return {
      answer: items.length ? items.map(item => `- ${item.text}`).join('\n') : 'No action items were found in the selected meeting context.',
      sources: items.map(item => ({ id: item.session.id, title: item.session.title }))
    };
  }

  const chunks = scoped.flatMap(session => {
    const intelligence = session.meetingIntelligence;
    return [
      ...(intelligence.summary || []),
      ...(intelligence.decisions || []),
      ...(intelligence.questions || []),
      ...(intelligence.risks || []),
      ...(intelligence.featureRequests || []),
      ...splitSentences(transcriptText(session)).slice(0, 40)
    ].map(text => ({ session, text, score: scoreChunk(q, text) }));
  }).filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (chunks.length === 0) {
    return {
      answer: 'I could not find a strong match in the selected meeting context.',
      sources: []
    };
  }

  return {
    answer: chunks.map(chunk => `- ${chunk.text}`).join('\n'),
    sources: chunks.map(chunk => ({ id: chunk.session.id, title: chunk.session.title }))
  };
}

function templates() {
  return Object.values(TEMPLATES);
}

module.exports = {
  DEFAULT_TEMPLATE,
  buildBrief,
  buildMeetingIntelligence,
  enrichMeetingSession,
  answerQuestion,
  templates
};
