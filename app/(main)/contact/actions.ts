"use server";

import { z } from "zod";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "subject" | "message", string>>;
};

const CONTACT_EMAIL = "contact@myvibeproject.com";

const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Wpisz swoje imię."),
  email: z.string().trim().email("Wpisz poprawny adres e-mail."),
  subject: z.string().trim().min(3, "Wpisz temat."),
  message: z.string().trim().min(10, "Wpisz dłuższą wiadomość."),
  company: z.string().trim().max(0, "Nie można wysłać tej wiadomości."),
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
      message: "Sprawdź zaznaczone pola i spróbuj ponownie.",
      fieldErrors,
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !resendFromEmail) {
    console.error("Contact form email skipped: Resend is not configured.");
    return {
      status: "error",
      message: "Wysyłka wiadomości jest chwilowo niedostępna. Napisz bezpośrednio na contact@myvibeproject.com.",
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
      subject: `Formularz kontaktowy: ${parsed.data.subject}`,
      text: [
        `Imię: ${parsed.data.name}`,
        `E-mail: ${parsed.data.email}`,
        `Temat: ${parsed.data.subject}`,
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
      message: "Nie udało się wysłać wiadomości. Napisz bezpośrednio na contact@myvibeproject.com.",
    };
  }

  return {
    status: "success",
    message: "Wiadomość wysłana. Odpowiemy e-mailem.",
  };
}
