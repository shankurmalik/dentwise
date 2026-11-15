import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import PaymentsClient from "./payments-client";

export default async function PaymentsPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (
    !process.env.ADMIN_EMAIL ||
    user.emailAddresses[0]?.emailAddress !== process.env.ADMIN_EMAIL
  )
    redirect("/dashboard");
  return <PaymentsClient />;
}
