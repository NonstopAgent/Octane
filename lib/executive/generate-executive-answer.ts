import { classifyExecutiveQuestion } from "./classify-executive-question";
import {
  buildAgentsAnswer,
  buildBlockersAnswer,
  buildBuildingAnswer,
  buildChangedAnswer,
  buildDecisionsAnswer,
  buildImprovementAnswer,
  buildMoneyAnswer,
  buildOutlookAnswer,
  buildOwnershipAnswer,
  buildRiskOpportunityAnswer,
  buildTodayAnswer,
  buildUnknownAnswer,
} from "./answer-builders";
import {
  detectSensitiveExecutiveTopic,
  EXECUTIVE_SENSITIVE_TOPIC_WARNING,
} from "./sensitive-topics";
import { enrichExecutiveAnswerWithLiveSignals, resolveReferenceDate } from "./shared";
import type {
  ExecutiveAnswer,
  ExecutiveAnswerInput,
  ExecutiveQuestionCategory,
} from "./types";

export { classifyExecutiveQuestion } from "./classify-executive-question";
export {
  buildAgentsAnswer,
  buildBlockersAnswer,
  buildBuildingAnswer,
  buildChangedAnswer,
  buildDecisionsAnswer,
  buildImprovementAnswer,
  buildMoneyAnswer,
  buildOutlookAnswer,
  buildOwnershipAnswer,
  buildRiskOpportunityAnswer,
  buildTodayAnswer,
  buildUnknownAnswer,
} from "./answer-builders";
export type {
  ClassifiedExecutiveQuestion,
  ExecutiveAnswer,
  ExecutiveAnswerInput,
  ExecutiveConfidence,
  ExecutiveQuestionCategory,
  ExecutiveSupportingSignal,
} from "./types";

function buildAnswerForCategory(
  category: ExecutiveQuestionCategory,
  state: ExecutiveAnswerInput,
  referenceDate: Date,
): ExecutiveAnswer {
  switch (category) {
    case "ownership":
      return buildOwnershipAnswer(state, referenceDate);
    case "building":
      return buildBuildingAnswer(state, referenceDate);
    case "today":
      return buildTodayAnswer(state, referenceDate);
    case "blockers":
      return buildBlockersAnswer(state, referenceDate);
    case "changed":
      return buildChangedAnswer(state, referenceDate);
    case "decisions":
      return buildDecisionsAnswer(state, referenceDate);
    case "money":
      return buildMoneyAnswer(state, referenceDate);
    case "agents":
      return buildAgentsAnswer(state, referenceDate);
    case "outlook":
      return buildOutlookAnswer(state, referenceDate);
    case "risk":
      return buildRiskOpportunityAnswer(state, referenceDate, "risk");
    case "opportunity":
      return buildRiskOpportunityAnswer(state, referenceDate, "opportunity");
    case "improvement":
      return buildImprovementAnswer(state, referenceDate);
    case "unknown":
    default:
      return buildUnknownAnswer(state, referenceDate);
  }
}

export function generateExecutiveAnswer(
  question: string,
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const { category } = classifyExecutiveQuestion(question);
  const answer = enrichExecutiveAnswerWithLiveSignals(
    buildAnswerForCategory(category, state, ref),
    state,
  );

  if (detectSensitiveExecutiveTopic(question)) {
    return {
      ...answer,
      sensitiveTopicWarning: EXECUTIVE_SENSITIVE_TOPIC_WARNING,
    };
  }

  return answer;
}
