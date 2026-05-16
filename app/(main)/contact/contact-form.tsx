"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitContactForm, type ContactFormState } from "./actions";
import { useI18n } from "@/lib/i18n";

const initialState: ContactFormState = {
  status: "idle",
};

export function ContactForm() {
  const { t } = useI18n();
  const [state, formAction, isPending] = useActionState(submitContactForm, initialState);
  const hasStatusMessage = Boolean(state.message);
  const isSuccess = state.status === "success";

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <FieldGroup className="gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field data-invalid={Boolean(state.fieldErrors?.name)}>
            <FieldLabel htmlFor="name">{t("contactForm", "name")}</FieldLabel>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              aria-invalid={Boolean(state.fieldErrors?.name)}
              disabled={isPending}
              required
            />
            <FieldError>{state.fieldErrors?.name}</FieldError>
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.email)}>
            <FieldLabel htmlFor="email">{t("contactForm", "email")}</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(state.fieldErrors?.email)}
              disabled={isPending}
              required
            />
            <FieldError>{state.fieldErrors?.email}</FieldError>
          </Field>
        </div>

        <Field data-invalid={Boolean(state.fieldErrors?.subject)}>
          <FieldLabel htmlFor="subject">{t("contactForm", "subject")}</FieldLabel>
          <Input
            id="subject"
            name="subject"
            aria-invalid={Boolean(state.fieldErrors?.subject)}
            disabled={isPending}
            required
          />
          <FieldError>{state.fieldErrors?.subject}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.message)}>
          <FieldLabel htmlFor="message">{t("contactForm", "message")}</FieldLabel>
          <Textarea
            id="message"
            name="message"
            className="min-h-36 resize-none"
            aria-invalid={Boolean(state.fieldErrors?.message)}
            disabled={isPending}
            required
          />
          <FieldError>{state.fieldErrors?.message}</FieldError>
        </Field>

        <Field className="hidden" aria-hidden="true">
          <FieldLabel htmlFor="company">{t("contactForm", "company")}</FieldLabel>
          <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </Field>
      </FieldGroup>

      {hasStatusMessage ? (
        <Alert variant={isSuccess ? "default" : "destructive"} className="rounded-xl">
          {isSuccess ? <CheckCircle2 /> : <AlertCircle />}
          <AlertTitle>
            {isSuccess
              ? t("contactForm", "messageSent")
              : t("contactForm", "emailUnavailable")}
          </AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end pt-1">
        <Button type="submit" size="lg" className="w-full px-5 sm:w-auto" disabled={isPending}>
          <Send data-icon="inline-start" />
          {isPending ? t("contactForm", "sending") : t("contactForm", "sendMessage")}
        </Button>
      </div>
    </form>
  );
}
