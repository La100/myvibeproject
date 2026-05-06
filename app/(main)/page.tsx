import { HeroSection } from "@/components/ui/landing/minimal/HeroSection";
import { ProductSections } from "@/components/ui/landing/minimal/ProductSections";
import { Footer } from "@/components/ui/landing/minimal/Footer";

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <HeroSection />
      <ProductSections />
      <Footer />
    </main>
  );
}
