import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";

import { Users, FolderOpen, HardDrive, Check, Sparkles, Brain, ExternalLink, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { toast } from "sonner";

interface SubscriptionCardProps {
  teamId: Id<"teams">;
}

export function SubscriptionCard({ teamId }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const subscription = useQuery(apiAny.stripe.getTeamSubscription, { teamId });
  const storageUsage = useQuery(apiAny.files.getTeamStorageUsage, { teamId });
  const createCheckoutSession = useAction(apiAny.stripeActions.createCheckoutSession);
  const createBillingPortalSession = useAction(apiAny.stripeActions.createBillingPortalSession);
  const ensureSubscriptionSynced = useAction(apiAny.stripeActions.ensureSubscriptionSynced);

  // Auto-sync subscription from Stripe if needed (runs once on mount)
  useEffect(() => {
    if (subscription && subscription.stripeCustomerId && subscription.subscriptionPlan === "free") {
      ensureSubscriptionSynced({ teamId }).catch(console.error);
    }
  }, [subscription, teamId, ensureSubscriptionSynced]);

  if (!subscription) {
    return <div className="h-24 w-full animate-pulse rounded-xl bg-muted/20" />;
  }

  // Check if subscription is active (has subscriptionId and active status)
  const hasActiveSubscription = subscription.subscriptionId && 
    (subscription.subscriptionStatus === "active" || subscription.subscriptionStatus === "trialing");
  const isActive = subscription.subscriptionStatus === "active" || subscription.subscriptionStatus === "trialing";
  const isTrial = subscription.subscriptionStatus === "trialing";
  const isPastDue = subscription.subscriptionStatus === "past_due";

  const handleUpgrade = async (priceId: string) => {
    if (!priceId) {
      toast.error("Price ID is not configured");
      return;
    }
    
    setLoading(true);
    try {
      const result = await createCheckoutSession({
        teamId,
        priceId,
      });
      
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Error creating checkout session");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const result = await createBillingPortalSession({
        teamId,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to open Stripe portal");
      }
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      toast.error("Error opening Stripe portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusBadge = () => {
    if (isTrial) return <Badge variant="secondary" className="font-normal">Trial Period</Badge>;
    if (isActive) return <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 font-normal">Active</Badge>;
    if (isPastDue) return <Badge variant="destructive" className="font-normal">Past Due</Badge>;
    if (subscription.cancelAtPeriodEnd) return <Badge variant="outline" className="text-orange-600 border-orange-200 font-normal">Ends soon</Badge>;
    return <Badge variant="outline" className="font-normal">Inactive</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Card - Clean Horizontal Layout */}
      <Card className="border-border/10 shadow-sm bg-card/40 overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-8">
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
                   <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-medium tracking-tight">{subscription.planDetails.name} Plan</h3>
                    {getStatusBadge()}
                  </div>
                  <p className="text-muted-foreground font-light mt-1">
                    {subscription.planDetails.price === 0 
                      ? "Free forever" 
                      : `$${subscription.planDetails.price} / month`
                    }
                  </p>
                </div>
             </div>

             {subscription.subscriptionPlan !== "free" && (
                <Button
                  variant="outline"
                  className="bg-transparent border-border/20 hover:bg-muted/50"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {portalLoading ? "Opening..." : "Manage Subscription"}
                  <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
                </Button>
              )}
          </div>

          <div className="h-px bg-border/10 mb-8" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Projects</span>
               <div className="flex items-center gap-2">
                 <FolderOpen className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm font-medium">{subscription.limits.maxProjects} projects</span>
               </div>
            </div>
            
            <div className="space-y-2">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Team Size</span>
               <div className="flex items-center gap-2">
                 <Users className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm font-medium">{subscription.limits.maxTeamMembers} users</span>
               </div>
            </div>

            <div className="space-y-2">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Storage</span>
               <div className="flex items-center gap-2">
                 <HardDrive className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm font-medium">{subscription.limits.maxStorageGB} GB</span>
               </div>
               {storageUsage && (
                  <Progress value={storageUsage.percentUsed} className="h-1 bg-muted/20" indicatorClassName="bg-foreground" />
               )}
            </div>

            <div className="space-y-2">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">AI Features</span>
               <div className="flex items-center gap-2">
                 <Brain className={`h-4 w-4 ${subscription.planDetails.hasAIFeatures ? 'text-violet-500' : 'text-muted-foreground'}`} />
                 <span className={`text-sm font-medium ${subscription.planDetails.hasAIFeatures ? 'text-violet-600' : 'text-muted-foreground'}`}>
                   {subscription.planDetails.hasAIFeatures ? 'Enabled' : 'Disabled'}
                 </span>
               </div>
            </div>
          </div>
          
          {isActive && subscription.currentPeriodEnd && (
            <div className="mt-8 pt-6 border-t border-border/10 flex justify-end">
               <p className="text-xs text-muted-foreground/60 font-light">
                 {isTrial ? "Trial ends" : "Renews on"} {formatDate(subscription.currentPeriodEnd)}
               </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Promo Card - Minimal Gradient */}
      {!hasActiveSubscription && subscription.subscriptionPlan !== "ai" && (
        <Card className="relative overflow-hidden rounded-xl border border-transparent bg-gradient-to-br from-violet-500/5 to-purple-500/10 shadow-none hover:shadow-sm transition-all">
          <CardContent className="p-8 grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
                    <Sparkles className="h-5 w-5" />
                 </div>
                 <h3 className="text-xl font-bold tracking-tight">Upgrade to AI Pro</h3>
               </div>
               <p className="text-muted-foreground font-light leading-relaxed max-w-sm">
                 Unlock the full power of Myvibe project with AI-driven insights, more storage, and unlimited potential.
               </p>
               <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>20 projects</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>25 team members</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>50 GB storage</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>AI Assistant</span>
                  </div>
               </div>
            </div>

            <div className="flex flex-col items-start md:items-end justify-center gap-4">
               <div className="text-right">
                  <span className="text-3xl font-bold tracking-tight">$39</span>
                  <span className="text-muted-foreground ml-1">/ month</span>
               </div>
               <Button 
                className="w-full md:w-auto h-12 px-8 rounded-full text-base font-medium shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all"
                disabled={loading}
                onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_AI_PRICE_ID || "")}
              >
                {loading ? "Processing..." : "Upgrade Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
