import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LAST_UPDATED = "March 12, 2026";

const sections = [
  {
    title: "1. Scope of These Terms",
    body: [
      "These Terms of Service govern access to and use of MyVibeProject, including the web application, client-facing portals, AI features, file workflows, and the MyVibeProject Web Clipper Chrome extension (collectively, the \"Service\").",
      "Welcome to MyVibe Project. By creating an account, accepting an invitation, connecting an extension, or otherwise using the Service, you agree to these Terms.",
      "If you have signed a separate order form, enterprise agreement, or other written contract with us covering the Service, that agreement will control to the extent of any conflict.",
      "If you are using the Service on behalf of a company, studio, contractor, or other organization, you confirm that you are authorized to bind that organization to these Terms.",
    ],
  },
  {
    title: "2. Eligibility and Account Responsibility",
    body: [
      "You must provide accurate account information and keep it up to date. You are responsible for all activity that occurs under your account, organization, and connected devices.",
      "You must keep credentials, API sessions, browser extension sessions, and access links confidential. Notify us promptly if you believe your account or workspace has been compromised.",
      "Organization administrators are responsible for managing team members, permissions, shared workspaces, and client-facing access granted through the Service.",
    ],
  },
  {
    title: "3. The Service We Provide",
    body: [
      "MyVibeProject is a SaaS workspace built for architectural and project-delivery teams. Features may include project tracking, tasks, schedules, contacts, shopping lists, labor tracking, estimates, invoices, client collaboration, file storage, AI assistance, and image or visualization generation.",
      "We may improve, add, remove, or modify features from time to time. If a change materially reduces core functionality of a paid plan during an active billing period, we will use commercially reasonable efforts to provide advance notice.",
      "Some features may be marked beta, preview, experimental, or subject to usage caps. Those features may change more frequently and may be unavailable from time to time.",
    ],
  },
  {
    title: "4. Subscriptions, Billing, and Usage Limits",
    body: [
      "Certain parts of the Service require a paid subscription. Pricing, billing intervals, plan features, usage allowances, and overage rules are presented at checkout or inside the billing settings in your workspace.",
      "Paid subscriptions renew automatically for the same billing cycle unless canceled before the renewal date. Taxes may apply unless stated otherwise.",
      "You authorize us and our payment processors to charge the payment method on file for recurring subscription fees, applicable taxes, and other charges you authorize.",
      "Downgrades, cancellations, and plan changes take effect as described in the billing flow or product settings. Unless required by law, fees already paid are non-refundable.",
      "We may suspend access to paid features if invoices are overdue, chargebacks occur, or usage materially exceeds the limits of the selected plan.",
    ],
  },
  {
    title: "5. Customer Data, Files, and Workspace Content",
    body: [
      "As between you and MyVibeProject, you retain ownership of the files, project data, notes, contact records, images, prompts, and other content you submit or store in the Service (\"Customer Data\").",
      "You grant us a limited, non-exclusive license to host, copy, process, transmit, display, and back up Customer Data solely as necessary to operate, secure, improve, and support the Service.",
      "You are responsible for ensuring that you have all rights, permissions, notices, and legal bases needed to upload Customer Data, invite collaborators, and share client-facing content through the Service.",
      "You must not upload unlawful content, malware, deceptive material, or content that infringes intellectual property, privacy, confidentiality, or other third-party rights.",
    ],
  },
  {
    title: "6. AI Features and Generated Output",
    body: [
      "The Service may provide AI-generated text, suggestions, summaries, estimates, visualizations, classifications, or extracted information (\"AI Output\"). AI Output is probabilistic and may be inaccurate, incomplete, or unsuitable for your use case.",
      "You are responsible for reviewing all AI Output before relying on it for project decisions, budgets, client communication, procurement, scheduling, compliance, design, construction, or safety matters.",
      "AI features are not a substitute for professional architectural, engineering, legal, financial, procurement, or compliance advice. You must apply human review before acting on AI Output.",
      "You must not use the Service or AI features to generate unlawful content, attempt model abuse, reverse engineer third-party models, or process data in a way prohibited by applicable law or third-party provider terms.",
    ],
  },
  {
    title: "7. Acceptable Use",
    body: [
      "You may not use the Service to violate any law, infringe rights, harass others, distribute spam, interfere with security, bypass access controls, scrape the Service at scale, probe for vulnerabilities, or disrupt the platform.",
      "You may not resell, sublicense, or provide unauthorized third-party access to the Service except through features expressly intended for collaboration, client panels, or invited users.",
      "You may not use the Service to store or transmit sensitive regulated data unless the Service expressly supports that use and you have completed your own legal and security review.",
    ],
  },
  {
    title: "8. Third-Party Services",
    body: [
      "The Service relies on third-party providers such as authentication, hosting, storage, payment, browser, messaging, and AI infrastructure providers. Their availability may affect parts of the Service.",
      "Third-party services, websites, merchant pages, or payment processors may have separate terms and privacy notices. We are not responsible for third-party products or content outside our reasonable control.",
    ],
  },
  {
    title: "9. Intellectual Property",
    body: [
      "The Service, including its software, interface design, branding, documentation, and underlying technology, is owned by Myvibe project Inc. or its licensors and is protected by applicable intellectual property laws.",
      "Subject to these Terms and timely payment of applicable fees, we grant you a limited, non-transferable, non-exclusive right to access and use the Service for your internal business operations.",
      "You may not copy, modify, distribute, sell, lease, reverse engineer, decompile, or create derivative works from the Service except to the extent that applicable law expressly permits it despite this restriction.",
    ],
  },
  {
    title: "10. Suspension and Termination",
    body: [
      "You may stop using the Service at any time. We may suspend or terminate access immediately if we reasonably believe you violated these Terms, created security risk, failed to pay fees, or used the Service in a way that could harm us, other users, or third parties.",
      "Where practicable, we will provide notice and an opportunity to resolve the issue before suspension. We may remove unlawful content or disable access links without prior notice when reasonably necessary.",
      "Upon termination, your right to use the Service ends immediately, but provisions that by their nature should survive will remain in effect, including payment obligations accrued before termination, ownership, disclaimers, limitations of liability, and dispute provisions.",
    ],
  },
  {
    title: "11. Disclaimers",
    body: [
      "The Service is provided on an \"as is\" and \"as available\" basis. To the maximum extent permitted by law, we disclaim all warranties, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, uninterrupted availability, and error-free operation.",
      "We do not warrant that the Service will be uninterrupted, secure, or free from delays, data loss, or defects, or that AI Output, project estimates, or generated documents will be accurate or legally sufficient for your needs.",
    ],
  },
  {
    title: "12. Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, Myvibe project Inc. and its affiliates, officers, employees, contractors, and licensors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenue, goodwill, data, or business opportunities.",
      "Our aggregate liability arising out of or relating to the Service and these Terms will not exceed the greater of: (a) the amounts paid by you to us for the Service during the 12 months before the event giving rise to the claim, or (b) USD 100.",
      "Nothing in these Terms excludes or limits liability that cannot be excluded under applicable law.",
    ],
  },
  {
    title: "13. Indemnity",
    body: [
      "You will defend, indemnify, and hold harmless Myvibe project Inc. and its affiliates, officers, employees, and contractors from and against claims, liabilities, damages, losses, and expenses arising out of or related to your Customer Data, your use of the Service, your violation of these Terms, or your violation of any law or third-party right.",
    ],
  },
  {
    title: "14. Changes to These Terms",
    body: [
      "We may update these Terms from time to time. When we make material changes, we will update the \"Last updated\" date and may provide additional notice through the Service or by email.",
      "If you continue using the Service after the updated Terms become effective, you agree to the revised Terms. If you do not agree, you must stop using the Service and cancel any paid subscription before the next renewal date.",
    ],
  },
  {
    title: "15. Governing Law and Mandatory Rights",
    body: [
      "These Terms are governed by the laws specified in your applicable order form or, if no order form applies, by the laws governing the contracting entity operating the Service, excluding conflict-of-law rules.",
      "If you use the Service as a consumer, any mandatory rights you have under applicable consumer protection law remain unaffected.",
    ],
  },
  {
    title: "16. Contact",
    body: [
      "For legal, contractual, or policy questions about these Terms, contact us at privacy@myvibeproject.com.",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
          <CardDescription>Last updated: {LAST_UPDATED}</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground">
          <p>
            These Terms are designed for a professional SaaS workflow and reflect how
            MyVibeProject currently operates across team workspaces, client collaboration, billing,
            AI tools, and browser-extension features.
          </p>

          {sections.map((section) => (
            <section key={section.title} className="mt-6">
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
