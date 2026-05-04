"use client";

import { PostAuthRouter } from "@/components/auth/PostAuthRouter";

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <PostAuthRouter />
    </div>
  );
}
