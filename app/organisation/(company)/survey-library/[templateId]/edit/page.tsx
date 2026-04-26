import { SurveyTemplateForm } from "@/components/surveys/SurveyTemplateForm";
import { Id } from "@/convex/_generated/dataModel";

type EditSurveyTemplatePageProps = {
  params: Promise<{
    templateId: string;
  }>;
};

export default async function EditSurveyTemplatePage({
  params,
}: EditSurveyTemplatePageProps) {
  const { templateId } = await params;

  return (
    <div className="px-5 py-6 md:px-7">
      <SurveyTemplateForm templateId={templateId as Id<"surveyTemplates">} />
    </div>
  );
}
