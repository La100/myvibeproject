type SurveyQuestionType =
  | "text_short"
  | "text_long"
  | "multiple_choice"
  | "single_choice"
  | "rating"
  | "yes_no"
  | "number"
  | "file";

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
}

function asSurveyQuestionType(value: unknown): SurveyQuestionType | undefined {
  if (
    value === "text_short" ||
    value === "text_long" ||
    value === "multiple_choice" ||
    value === "single_choice" ||
    value === "rating" ||
    value === "yes_no" ||
    value === "number" ||
    value === "file"
  ) {
    return value;
  }
  return undefined;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
  return normalized.length > 0 ? normalized : undefined;
}

function extractSurveyQuestions(value: unknown) {
  const items = asRecordArray(value);
  if (!items) return undefined;

  const questions = items
    .map((item) => {
      const questionText = asNonEmptyString(item.questionText) ?? asNonEmptyString(item.title);
      const questionType =
        asSurveyQuestionType(item.questionType) ?? asSurveyQuestionType(item.type);

      return {
        questionId: asNonEmptyString(item.questionId),
        operation: asNonEmptyString(item.operation) as "create" | "edit" | "delete" | undefined,
        questionText,
        questionType,
        options: asStringArray(item.options),
        isRequired: asBoolean(item.isRequired),
        order: asNumber(item.order),
      };
    })
    .filter((item) => item.questionText || item.questionId || item.operation);

  return questions.length > 0 ? questions : undefined;
}

export function buildCreateSurveyPayload(params: Record<string, unknown>) {
  const title =
    asNonEmptyString(params.title) ??
    asNonEmptyString(params.name);

  return {
    title,
    surveyData: title
      ? {
          title,
          description: asNonEmptyString(params.description),
          isRequired: asBoolean(params.isRequired),
          allowMultipleResponses: asBoolean(params.allowMultipleResponses),
          startDate: asNonEmptyString(params.startDate),
          endDate: asNonEmptyString(params.endDate),
          questions: extractSurveyQuestions(params.questions),
        }
      : undefined,
  };
}

export function buildUpdateSurveyPayload(params: Record<string, unknown>) {
  const surveyId = asNonEmptyString(params.surveyId);

  return {
    surveyId,
    updates: surveyId
      ? {
          title: asNonEmptyString(params.title),
          description: asNonEmptyString(params.description),
          isRequired: asBoolean(params.isRequired),
          allowMultipleResponses: asBoolean(params.allowMultipleResponses),
          startDate: asNonEmptyString(params.startDate),
          endDate: asNonEmptyString(params.endDate),
          questions: extractSurveyQuestions(params.questions),
        }
      : undefined,
  };
}
