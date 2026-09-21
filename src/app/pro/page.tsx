import Navbar from "@/components/Navbar";
import { currentUser } from "@clerk/nextjs/server";
import { CrownIcon } from "lucide-react";
import { redirect } from "next/navigation";

async function ProPage() {
  const user = await currentUser();

  if (!user) redirect("/");

  return (
    <>
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 pt-24">
        <div className="mb-12 overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-br from-primary/10 to-background rounded-3xl p-8 border border-primary/20">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primar/10 rounded-full border border-primary/20 ">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-primary">Upgrade to Pro</span>
              </div>

              <div>
                <h1 className="text-4xl font-bold mb-2">Unlock Premium AI Dental Care</h1>
                <p className="text-muted-foreground">
                  Get unlimited AI consultations, advanced features, and priority support to take
                  your dental health to the next level.
                </p>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                <CrownIcon className="w-16 h-16 text-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* PRICING SECTION */}
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Choose Your Plan</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Select the perfect plan for your dental care needs. All plans include secure access
              and bank-level encryption.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
  <div className="rounded-2xl border border-primary/20 bg-background p-8">
    <h3 className="text-2xl font-bold">AI Basic</h3>
    <p className="text-3xl font-bold mt-4">₹799/month</p>

    <ul className="mt-6 space-y-3 text-muted-foreground">
      <li>✓ AI dental assistant</li>
      <li>✓ Voice consultations</li>
      <li>✓ Dental guidance</li>
    </ul>
  </div>

  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8">
    <h3 className="text-2xl font-bold">AI Pro</h3>
    <p className="text-3xl font-bold mt-4">₹1,599/month</p>

    <ul className="mt-6 space-y-3 text-muted-foreground">
      <li>✓ Unlimited AI consultations</li>
      <li>✓ Voice assistant</li>
      <li>✓ Priority support</li>
    </ul>
  </div>
</div>
        </div>
      </div>
    </>
  );
}

export default ProPage;
