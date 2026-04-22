import { Suspense } from "react";
import { ContactsView } from "./components/ContactsView";

export default function ContactsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Address Book</h1>
      </div>
      
      <Suspense fallback={<div>Loading contacts...</div>}>
        <ContactsView />
      </Suspense>
    </div>
  );
}
