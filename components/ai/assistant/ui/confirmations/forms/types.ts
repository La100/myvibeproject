export type FormData = Record<string, unknown>;

export interface BaseFormProps {
  data: FormData;
  onUpdate: (updates: FormData) => void;
}

export interface TaskFormProps extends BaseFormProps {
  teamMembers?: Array<{ clerkUserId: string; name?: string; email?: string }>;
}

export interface SectionFormProps extends BaseFormProps {
  type: string;
}
