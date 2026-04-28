"use server";

import { z } from "zod";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "subject" | "message", string>>;
};

const CONTACT_EMAIL = "contact@myvibeproject.com";

const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  subject: z.string().trim().min(3, "Enter a subject."),
  message: z.string().trim().min(10, "Enter a longer message."),
  company: z.string().trim().max(0, "Unable to send this message."),
});

export async function submitContactForm(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    company: formData.get("company"),
  });

  if (!parsed.success) {
    const fieldErrors: ContactFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        field === "name" ||
        field === "email" ||
        field === "subject" ||
        field === "message"
      ) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !resendFromEmail) {
    console.error("Contact form email skipped: Resend is not configured.");
    return {
      status: "error",
      message: "Message delivery is temporarily unavailable. Email us directly at contact@myvibeproject.com.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: CONTACT_EMAIL,
      reply_to: parsed.data.email,
      subject: `Contact form: ${parsed.data.subject}`,
      text: [
        `Name: ${parsed.data.name}`,
        `Email: ${parsed.data.email}`,
        `Subject: ${parsed.data.subject}`,
        "",
        parsed.data.message,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Contact form Resend send failed: ${response.status} ${response.statusText} ${errorText}`,
    );
    return {
      status: "error",
      message: "We could not send the message. Email us directly at contact@myvibeproject.com.",
    };
  }

  return {
    status: "success",
    message: "Message sent. We will reply by email.",
  };
}
