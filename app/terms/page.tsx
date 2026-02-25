const LAST_UPDATED = "February 24, 2026";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 shadow-soft-sm">
        <h1 className="text-3xl font-semibold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm mt-6 max-w-none text-foreground">
          <p>
            Welcome to Myvibe project. By using our services, you agree to these Terms of Service.
          </p>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using our services, you agree to be bound by these Terms. If you
            disagree with any part of the terms, then you may not access the service.
          </p>
          <h2>2. Use License</h2>
          <p>
            Permission is granted to temporarily download one copy of the materials (information or
            software) on Myvibe project's website for personal, non-commercial transitory viewing
            only.
          </p>
          <h2>3. Disclaimer</h2>
          <p>
            The materials on Myvibe project's website are provided on an &quot;as is&quot; basis.
            Myvibe project makes no warranties, expressed or implied, and hereby disclaims and
            negates all other warranties including, without limitation, implied warranties or
            conditions of merchantability, fitness for a particular purpose, or non-infringement of
            intellectual property or other violation of rights.
          </p>
        </div>
      </div>
    </div>
  );
}
