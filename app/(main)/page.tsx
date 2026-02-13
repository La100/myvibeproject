import { HeroSection } from "@/components/ui/landing/minimal/HeroSection";
import { FeaturesGrid } from "@/components/ui/landing/minimal/FeaturesGrid";
import { PricingSection } from "@/components/ui/landing/minimal/PricingSection";
import { FaqSection } from "@/components/ui/landing/minimal/FaqSection";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesGrid />
      <PricingSection />
      <FaqSection />
    </>
  );
}
