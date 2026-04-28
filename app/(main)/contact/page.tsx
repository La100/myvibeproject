import { Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "./contact-form";

export default function ContactPage() {
  return (
    <div className="min-h-[calc(100svh-6rem)] bg-background px-6 pb-16 pt-8">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:grid lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
        <div className="flex flex-col gap-5 pt-4">
          <div className="flex size-11 items-center justify-center rounded-full border border-border/70 bg-card text-foreground">
            <Mail />
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="max-w-xl font-serif text-5xl font-medium leading-[0.96] tracking-[-0.045em] text-foreground md:text-6xl">
              Contact MyVibeProject
            </h1>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Send product, account, billing, or support questions to the team. Replies go back to
              the email address you provide.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
            <CardDescription>
              The form sends directly to contact@myvibeproject.com.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
