import { Navbar } from "@/components/ui/landing/minimal/Navbar";
import { Footer } from "@/components/ui/landing/minimal/Footer";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
