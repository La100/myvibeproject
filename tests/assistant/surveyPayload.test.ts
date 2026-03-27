import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreateSurveyPayload,
  buildUpdateSurveyPayload,
} from "../../lib/assistant/surveyPayload.ts";

const interiorDesignQuestions = [
  {
    operation: "create",
    questionText: "Ktory styl wnetrz najbardziej Ci odpowiada?",
    questionType: "single_choice",
    options: ["Nowoczesny", "Skandynawski", "Japandi", "Industrialny"],
    isRequired: true,
    order: 1,
  },
  {
    operation: "create",
    questionText: "Ktore pomieszczenie jest teraz priorytetem?",
    questionType: "single_choice",
    options: ["Salon", "Sypialnia", "Kuchnia", "Lazienka"],
    isRequired: true,
    order: 2,
  },
  {
    operation: "create",
    questionText: "Jakie kolory przewodnie preferujesz?",
    questionType: "multiple_choice",
    options: ["Biele i beze", "Szarosci", "Zielenie", "Ciemne akcenty"],
    isRequired: true,
    order: 3,
  },
  {
    operation: "create",
    questionText: "Czy zalezy Ci na meblach na wymiar?",
    questionType: "yes_no",
    isRequired: true,
    order: 4,
  },
  {
    operation: "create",
    questionText: "Jak wazne jest dla Ciebie naturalne swiatlo?",
    questionType: "rating",
    isRequired: true,
    order: 5,
  },
  {
    operation: "create",
    questionText: "Jakie materialy chcesz widziec we wnetrzu?",
    questionType: "multiple_choice",
    options: ["Drewno", "Kamien", "Metal", "Szklo"],
    isRequired: true,
    order: 6,
  },
  {
    operation: "create",
    questionText: "Czy potrzebujesz duzo zamknietego przechowywania?",
    questionType: "yes_no",
    isRequired: true,
    order: 7,
  },
  {
    operation: "create",
    questionText: "Jaki budzet przewidujesz na wykonanie wntrza?",
    questionType: "number",
    isRequired: false,
    order: 8,
  },
  {
    operation: "create",
    questionText: "Jakiego klimatu ma byc to wnetrze?",
    questionType: "text_long",
    isRequired: false,
    order: 9,
  },
  {
    operation: "create",
    questionText: "Dodaj inspiracje lub linki do referencji.",
    questionType: "text_long",
    isRequired: false,
    order: 10,
  },
] as const;

test("buildCreateSurveyPayload keeps 10 interior design questions", () => {
  const result = buildCreateSurveyPayload({
    title: "Testowy survey",
    description: "Ankieta o interior design",
    isRequired: true,
    questions: interiorDesignQuestions,
  });

  assert.equal(result.title, "Testowy survey");
  assert.equal(result.surveyData?.questions?.length, 10);
  assert.equal(result.surveyData?.questions?.[0]?.questionText, interiorDesignQuestions[0].questionText);
  assert.equal(result.surveyData?.questions?.[0]?.questionType, "single_choice");
  assert.deepEqual(result.surveyData?.questions?.[2]?.options, interiorDesignQuestions[2].options);
  assert.equal(result.surveyData?.questions?.[9]?.order, 10);
});

test("buildUpdateSurveyPayload keeps surveyId and question create operations", () => {
  const result = buildUpdateSurveyPayload({
    surveyId: "survey_test_123",
    title: "Testowy survey",
    questions: interiorDesignQuestions,
  });

  assert.equal(result.surveyId, "survey_test_123");
  assert.equal(result.updates?.questions?.length, 10);
  assert.equal(result.updates?.questions?.every((question) => question.operation === "create"), true);
  assert.equal(result.updates?.questions?.[4]?.questionType, "rating");
  assert.equal(result.updates?.questions?.[7]?.questionType, "number");
});

test("buildCreateSurveyPayload trims blanks and drops incomplete questions", () => {
  const result = buildCreateSurveyPayload({
    name: "  Ankieta wykonawcza  ",
    description: "   ",
    isRequired: "true",
    allowMultipleResponses: "false",
    questions: [
      {
        title: "  Jak oceniasz postep?  ",
        type: "rating",
        options: ["  ", "5", " 4 "],
        isRequired: "true",
        order: "2",
      },
      {
        questionText: "Bez typu powinno wypasc",
      },
      {
        questionId: "question_existing",
        operation: "delete",
      },
    ],
  });

  assert.equal(result.title, "Ankieta wykonawcza");
  assert.equal(result.surveyData?.description, undefined);
  assert.equal(result.surveyData?.isRequired, true);
  assert.equal(result.surveyData?.allowMultipleResponses, false);
  assert.equal(result.surveyData?.questions?.length, 2);
  assert.equal(result.surveyData?.questions?.[0]?.questionText, "Jak oceniasz postep?");
  assert.equal(result.surveyData?.questions?.[0]?.questionType, "rating");
  assert.deepEqual(result.surveyData?.questions?.[0]?.options, ["5", "4"]);
  assert.equal(result.surveyData?.questions?.[0]?.order, 2);
  assert.equal(result.surveyData?.questions?.[1]?.questionId, "question_existing");
  assert.equal(result.surveyData?.questions?.[1]?.operation, "delete");
});

test("buildUpdateSurveyPayload returns undefined updates for blank surveyId", () => {
  const result = buildUpdateSurveyPayload({
    surveyId: "   ",
    title: "Nie powinno wejsc",
  });

  assert.equal(result.surveyId, undefined);
  assert.equal(result.updates, undefined);
});

test("buildUpdateSurveyPayload keeps aliased question fields for identified updates", () => {
  const result = buildUpdateSurveyPayload({
    surveyId: "survey_test_456",
    questions: [
      {
        questionId: "question_1",
        title: "  Nowe pytanie  ",
        type: "single_choice",
        options: [" A ", "B"],
        isRequired: "false",
        order: "3",
      },
    ],
  });

  assert.equal(result.surveyId, "survey_test_456");
  assert.equal(result.updates?.questions?.length, 1);
  assert.equal(result.updates?.questions?.[0]?.questionId, "question_1");
  assert.equal(result.updates?.questions?.[0]?.questionText, "Nowe pytanie");
  assert.equal(result.updates?.questions?.[0]?.questionType, "single_choice");
  assert.deepEqual(result.updates?.questions?.[0]?.options, ["A", "B"]);
  assert.equal(result.updates?.questions?.[0]?.isRequired, false);
  assert.equal(result.updates?.questions?.[0]?.order, 3);
});
