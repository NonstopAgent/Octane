import type {
  ClassifiedExecutiveQuestion,
  ExecutiveQuestionCategory,
} from "./types";

type CategoryRule = {
  category: ExecutiveQuestionCategory;
  keywords: string[];
  weight?: number;
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "risk",
    keywords: [
      "risk",
      "downside",
      "threat",
      "exposure",
      "vulnerable",
      "what could go wrong",
    ],
    weight: 1.2,
  },
  {
    category: "opportunity",
    keywords: [
      "opportunity",
      "upside",
      "bet",
      "double down",
      "where to invest time",
      "best bet",
    ],
    weight: 1.2,
  },
  {
    category: "outlook",
    keywords: [
      "outlook",
      "30 day",
      "30-day",
      "60 day",
      "90 day",
      "strategic plan",
      "pause",
      "review project",
      "roadmap horizon",
    ],
    weight: 1.15,
  },
  {
    category: "improvement",
    keywords: [
      "improve",
      "improvement",
      "needs work",
      "weaker",
      "what needs improvement",
      "get better",
    ],
    weight: 1.1,
  },
  {
    category: "today",
    keywords: [
      "today",
      "this morning",
      "briefing",
      "focus now",
      "focus today",
      "top priority",
      "top priorities",
      "what should i do",
    ],
    weight: 1.1,
  },
  {
    category: "blockers",
    keywords: [
      "blocker",
      "blocked",
      "blocking",
      "stuck",
      "stale project",
      "holding up",
      "what is in the way",
    ],
    weight: 1.15,
  },
  {
    category: "changed",
    keywords: [
      "what changed",
      "since last",
      "recent activity",
      "recent updates",
      "what happened",
      "activity log",
      "since yesterday",
      "this week",
    ],
    weight: 1.1,
  },
  {
    category: "decisions",
    keywords: [
      "decision",
      "decisions",
      "review date",
      "pending decision",
      "decide",
    ],
    weight: 1.05,
  },
  {
    category: "money",
    keywords: [
      "money",
      "revenue",
      "expense",
      "burn",
      "runway",
      "finance",
      "spending",
      "cash",
      "closest to revenue",
      "monetiz",
      "p&l",
      "profit",
    ],
    weight: 1.05,
  },
  {
    category: "agents",
    keywords: [
      "agent",
      "agents",
      "automation",
      "bot",
      "agent error",
      "agent status",
    ],
    weight: 1.05,
  },
  {
    category: "ownership",
    keywords: [
      "ownership",
      "holdings",
      "entity",
      "entities",
      " ip ",
      "intellectual property",
      "compliance",
      "legal question",
      "document gap",
      "formation",
      "trademark",
      "patent",
    ],
    weight: 1.05,
  },
  {
    category: "building",
    keywords: [
      "building",
      "project",
      "projects",
      "roadmap",
      "task",
      "tasks",
      "ship",
      "pipeline",
      "milestone",
      "in progress",
    ],
    weight: 1,
  },
];

const TIE_BREAK_ORDER: ExecutiveQuestionCategory[] = [
  "risk",
  "opportunity",
  "outlook",
  "improvement",
  "today",
  "blockers",
  "changed",
  "decisions",
  "money",
  "agents",
  "ownership",
  "building",
  "unknown",
];

function normalizeQuestion(question: string): string {
  return ` ${question.toLowerCase().replace(/\s+/g, " ").trim()} `;
}

function scoreCategory(
  normalized: string,
  rule: CategoryRule,
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let score = 0;
  const weight = rule.weight ?? 1;

  for (const keyword of rule.keywords) {
    const needle = keyword.toLowerCase();
    if (normalized.includes(needle)) {
      matched.push(keyword);
      score += weight;
    }
  }

  return { score, matched };
}

export function classifyExecutiveQuestion(
  question: string,
): ClassifiedExecutiveQuestion {
  const normalized = normalizeQuestion(question);
  if (!normalized.trim()) {
    return { category: "unknown", matchedKeywords: [], score: 0 };
  }

  let bestCategory: ExecutiveQuestionCategory = "unknown";
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (const rule of CATEGORY_RULES) {
    const { score, matched } = scoreCategory(normalized, rule);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
      bestMatched = matched;
    } else if (score === bestScore && score > 0) {
      const currentRank = TIE_BREAK_ORDER.indexOf(bestCategory);
      const challengerRank = TIE_BREAK_ORDER.indexOf(rule.category);
      if (challengerRank < currentRank) {
        bestCategory = rule.category;
        bestMatched = matched;
      }
    }
  }

  return {
    category: bestScore > 0 ? bestCategory : "unknown",
    matchedKeywords: bestMatched,
    score: bestScore,
  };
}
