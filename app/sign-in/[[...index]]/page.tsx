"use client";

import { useEffect } from "react";
import { useSignIn, useSignUp, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function SignInPage() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  const handleGoogleSignIn = async () => {
    if (isSignedIn) {
      router.replace("/dashboard");
      return;
    }

    try {
      await signIn?.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/onboarding",

      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already signed in")) {
        router.replace("/dashboard");
        return;
      }
      console.error("Error signing in with Google:", error);
    }
  };

  const handleSignUp = async () => {
    if (isSignedIn) {
      router.replace("/dashboard");
      return;
    }

    try {
      await signUp?.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/onboarding",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already signed in")) {
        router.replace("/dashboard");
        return;
      }
      console.error("Error signing up with Google:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex flex-1 p-4">
        <div className="relative w-full rounded-[24px] overflow-hidden">
          <Image
            src="/auth-image.jpg"
            alt="Myvibe project"
            fill
            className="object-cover"
            priority
          />

          {/* Content overlay */}

        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-[340px] flex flex-col items-center">
          {/* Logo/Title */}
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Myvibe project</h1>
          <p className="text-gray-500 text-base mb-10">AI assistant workspace.</p>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-gray-800 text-white py-3.5 px-6 rounded-full font-medium transition-colors mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Log in
          </button>

          {/* Divider */}
          <div className="w-full flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-gray-400 text-sm">or</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Sign Up Button */}
          <button
            onClick={handleSignUp}
            className="w-full flex items-center justify-center bg-white hover:bg-gray-50 text-gray-900 py-3.5 px-6 rounded-full font-medium border border-gray-300 transition-colors mb-8"
          >
            Sign up
          </button>

          <div id="clerk-captcha" className="w-full mb-8" />

          {/* Terms */}
          <p className="text-center text-xs text-gray-500 mb-16">
            By signing in you agree to our{" "}
            <Link href="/privacy" className="underline hover:text-gray-700">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline hover:text-gray-700">
              Terms of Service
            </Link>
            .
          </p>

          {/* Footer */}
          <p className="text-sm text-gray-500">
            by{" "}
            <Link href="/" className="underline hover:text-gray-700">
              Myvibe project
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
