export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full bg-white p-8 rounded-xl shadow-sm">
                <h1 className="text-3xl font-medium text-gray-900 mb-6">Privacy Policy</h1>
                <div className="prose prose-sm max-w-none text-gray-600">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>
                    <p className="mt-4">
                        Welcome to Myvibe project. This Privacy Policy explains how we collect, use, and protect your information.
                    </p>
                    <h2 className="text-xl font-medium text-gray-800 mt-6 mb-2">1. Information We Collect</h2>
                    <p>
                        We collect information you provide directly to us, such as when you create an account, update your profile, or use our services.
                    </p>
                    <h2 className="text-xl font-medium text-gray-800 mt-6 mb-2">2. How We Use Your Information</h2>
                    <p>
                        We use the information we collect to provide, maintain, and improve our services, including to process transactions and send you related information.
                    </p>
                    <h2 className="text-xl font-medium text-gray-800 mt-6 mb-2">3. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us.
                    </p>
                </div>
            </div>
        </div>
    );
}
