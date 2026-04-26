"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Sparkles,
  Wand2,
  Image as ImageIcon,
  MessageSquare,
  Brain,
  Check,
  Loader2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";

interface AISubscriptionWallProps {
  teamId: Id<"teams">;
  teamSlug?: string;
}

const AI_FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Assistant",
    description: "Intelligent project management assistant that understands your context"
  },
  {
    icon: Wand2,
    title: "Smart Task Creation",
    description: "Generate tasks, notes, and content with natural language"
  },
  {
    icon: ImageIcon,
    title: "AI Image Generation",
    description: "Create moodboards and visualizations with Gemini AI"
  },
  {
    icon: Brain,
    title: "Context-Aware",
    description: "AI that understands your entire project, team, and history"
  },
];

export function AISubscriptionWall({ teamId }: AISubscriptionWallProps) {
  const [loading, setLoading] = useState(false);

  const subscription = useQuery(apiAny.stripe.getTeamSubscription, { teamId });
  const createCheckoutSession = useAction(apiAny.stripeActions.createCheckoutSession);

  const handleSubscribe = async () => {
    const priceId = subscription?.checkoutPlans?.ai ?? null;

    if (subscription === undefined) {
      toast.error("Loading billing configuration. Try again in a moment.");
      return;
    }

    if (!priceId) {
      toast.error("Stripe price ID not configured. Please contact support.");
      console.error("STRIPE_AI_PRICE_ID is not set");
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckoutSession({
        teamId,
        priceId,
        baseUrl: window.location.origin,
      });

      if (result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Error redirecting to payment", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground sm:p-6 lg:p-8">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]"></div>
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] animate-pulse rounded-full bg-primary/10 blur-[100px] opacity-30"></div>
      <div
        className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] animate-pulse rounded-full bg-muted/50 blur-[100px] opacity-30"
        style={{ animationDelay: "2s" }}
      ></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="z-10 grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2"
      >
        {/* Left Column: Content & Features */}
        <div className="flex flex-col gap-8 text-center lg:text-left">
          <div className="flex flex-col gap-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto inline-flex items-center rounded-lg border border-border bg-background/50 px-3 py-1 text-sm font-medium text-muted-foreground backdrop-blur-sm lg:mx-0"
            >
              <Sparkles className="mr-2 h-4 w-4 text-foreground" />
              Unlock the full potential
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-display">
              Power up with <br />
              <span className="italic text-muted-foreground font-serif">AI Intelligence</span>
            </h1>

            <p className="mx-auto max-w-lg text-xl leading-relaxed text-muted-foreground lg:mx-0">
              Transform your project management with AI-powered assistance,
              smart content generation, and creative image synthesis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {AI_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="group rounded-2xl border border-border/50 bg-muted/30 p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-background text-foreground shadow-sm">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Column: Pricing Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="relative mx-auto w-full max-w-md"
        >
          <Card className="relative overflow-hidden rounded-3xl border-2 border-primary/5 bg-card/80 backdrop-blur-xl shadow-xl">
            {/* Subtle background glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

            <CardHeader className="relative text-center pb-8 pt-8">
              <Badge variant="secondary" className="mx-auto mb-6 w-fit px-4 py-1.5 font-medium">
                Pro Plan
              </Badge>

              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold tracking-tight">$39</span>
                <span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>

              <CardDescription className="text-base mt-4 max-w-xs mx-auto">
                Everything you need to supercharge your workflow with AI
              </CardDescription>
            </CardHeader>

            <CardContent className="relative flex flex-col gap-8 px-8 pb-8">
              {/* Benefits list */}
              <div className="flex flex-col gap-4">
                {[
                  "Unlimited AI Assistant access",
                  "AI credits for text and images",
                  "Smart task generation",
                  "Context-aware suggestions",
                  "20 projects included",
                  "25 team members",
                  "50 GB storage",
                  "Priority support",
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-sm text-muted-foreground">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <div className="flex flex-col gap-4">
                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  size="lg"
                  className={cn(
                    "h-14 w-full rounded-lg text-base font-semibold shadow-lg transition-all duration-300 hover:shadow-xl",
                    "bg-foreground text-background hover:bg-foreground/90"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Subscribe Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Cancel anytime • Secure payment via Stripe
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Current plan info */}
          {subscription && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 text-center"
            >
              <p className="inline-flex items-center rounded-lg bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
                <Lock className="w-3 h-3 mr-2" />
                Current plan: <span className="font-medium ml-1">{subscription.planDetails.name}</span>
                {subscription.subscriptionStatus === "trialing" && (
                  <Badge variant="secondary" className="ml-2 h-5">Trial</Badge>
                )}
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default AISubscriptionWall;
