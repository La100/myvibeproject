"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitContactForm, type ContactFormState } from "./actions";

const initialState: ContactFormState = {
  status: "idle",
};

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactForm, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup>
        <div className="grid gap-5 md:grid-cols-2">
          <Field data-invalid={Boolean(state.fieldErrors?.name)}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
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
            <FieldLabel htmlFor="email">Email</FieldLabel>
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
          <FieldLabel htmlFor="subject">Subject</FieldLabel>
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
          <FieldLabel htmlFor="message">Message</FieldLabel>
          <Textarea
            id="message"
            name="message"
            className="min-h-40"
            aria-invalid={Boolean(state.fieldErrors?.message)}
            disabled={isPending}
            required
          />
          <FieldDescription>
            Share the account email, project context, or anything we need to route the request.
          </FieldDescription>
          <FieldError>{state.fieldErrors?.message}</FieldError>
        </Field>

        <Field className="hidden" aria-hidden="true">
          <FieldLabel htmlFor="company">Company</FieldLabel>
          <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </Field>
      </FieldGroup>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "text-sm font-medium text-foreground"
              : "text-sm font-medium text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" className="h-10 px-5" disabled={isPending}>
          <Send data-icon="inline-start" />
          {isPending ? "Sending" : "Send message"}
        </Button>
        <a
          href="mailto:contact@myvibeproject.com"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          contact@myvibeproject.com
        </a>
      </div>
    </form>
  );
}
