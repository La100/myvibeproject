export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full bg-white p-8 rounded-xl shadow-sm">
                <h1 className="text-3xl font-medium text-gray-900 mb-6">Terms of Service</h1>
                <div className="prose prose-sm max-w-none text-gray-600">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>
                    <p className="mt-4">
                        Welcome to Myvibe project. By using our services, you agree to these Terms of Service.
                    </p>
                    <h2 className="text-xl font-medium text-gray-800 mt-6 mb-2">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the service.
                    </p>
                    <h2 className="text-xl font-medium text-gray-800 mt-6 mb-2">2. Use License</h2>
                    <p>
                        Permission is granted to temporarily download one copy of the materials (information or software) on Myvibe project's website for personal, non-commercial transitory viewing only.
                    </p>
                    <h2 className="text-xl font-medium text-gray-800 mt-6 mb-2">3. Disclaimer</h2>
                    <p>
                        The materials on Myvibe project's website are provided on an 'as is' basis. Myvibe project makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                    </p>
                </div>
            </div>
        </div>
    );
}
