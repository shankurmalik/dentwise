import { PricingTable } from "@clerk/nextjs";

export default function ProPage() {
  return (
    <div className="min-h-screen bg-background pt-24 px-6">
      <div className="max-w-5xl mx-auto">
        <PricingTable />
      </div>
    </div>
  );
}