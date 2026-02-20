const LAST_UPDATED = "February 20, 2026"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm mt-6 max-w-none text-foreground">
          <p>
            This policy describes how MyVibeProject and the MyVibeProject Web Clipper Chrome
            extension process data.
          </p>

          <h2>1. Data We Process</h2>
          <p>The extension processes only data needed to let you clip shopping items:</p>
          <ul>
            <li>Authentication token synchronized from your signed-in MyVibeProject session.</li>
            <li>Team and project metadata needed to select a destination list.</li>
            <li>Product fields you choose to save, such as name, price, notes, URL, and image URL.</li>
            <li>Current page signals used for optional on-page product detection.</li>
          </ul>

          <h2>2. How We Use Data</h2>
          <p>We use this data to:</p>
          <ul>
            <li>Authenticate your extension session.</li>
            <li>Display your teams and projects.</li>
            <li>Create shopping list entries you explicitly submit.</li>
            <li>Improve reliability and prevent abuse.</li>
          </ul>

          <h2>3. Local Browser Storage</h2>
          <p>
            The extension stores session token and UI selection state in Chrome local extension
            storage on your device. You can clear this data by signing out or removing extension
            data in Chrome.
          </p>

          <h2>4. Data Sharing</h2>
          <p>
            We do not sell personal data. Data is shared only with service providers required to run
            the product (for example authentication, hosting, and database infrastructure), under
            contractual safeguards.
          </p>

          <h2>5. Retention</h2>
          <p>
            Data is retained only as long as needed for account operation, legal obligations, and
            security. You can request deletion by contacting us.
          </p>

          <h2>6. Security</h2>
          <p>
            We use industry-standard controls, including authenticated API access and transport
            encryption. No method is 100% secure, but we continuously improve protections.
          </p>

          <h2>7. Your Choices</h2>
          <ul>
            <li>You can sign out of the extension at any time.</li>
            <li>You can review and edit product details before saving.</li>
            <li>You can contact us to request access, correction, or deletion where applicable.</li>
          </ul>

          <h2>8. Contact</h2>
          <p>
            For privacy questions, contact:{" "}
            <a href="mailto:privacy@myvibeproject.com">privacy@myvibeproject.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
