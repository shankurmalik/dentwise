"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminPayments,
  resolveDisputedPayment,
  settleCommission,
} from "@/lib/actions/appointments";

const money = (value: string | null | undefined) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const Report = ({
  label,
  amount,
  method,
}: {
  label: string;
  amount: string | null;
  method: string | null;
}) => (
  <div className="rounded border p-3 text-sm">
    <p className="font-medium">{label}</p>
    <p>
      {money(amount)} · {method ?? "Not reported"}
    </p>
  </div>
);

export default function PaymentsClient() {
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ["adminPayments"],
    queryFn: getAdminPayments,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["adminPayments"] });
  const settle = useMutation({
    mutationFn: settleCommission,
    onSuccess: refresh,
  });
  const resolve = useMutation({
    mutationFn: resolveDisputedPayment,
    onSuccess: refresh,
  });
  if (payments.isLoading)
    return (
      <main>
        <Navbar />
        <div className="pt-24 text-center">Loading payments…</div>
      </main>
    );
  if (payments.isError || !payments.data)
    return (
      <main>
        <Navbar />
        <div className="pt-24 text-center text-destructive">
          Unable to load payments. Please retry.
        </div>
      </main>
    );
  const { appointments, commissions, summary } = payments.data;
  const awaiting = appointments.filter(
    (item) => item.verificationStatus === "AWAITING_PATIENT",
  );
  const verified = appointments.filter(
    (item) => item.verificationStatus === "VERIFIED",
  );
  const disputed = appointments.filter(
    (item) => item.verificationStatus === "DISPUTED",
  );
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-7xl px-6 pb-12 pt-24">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Payments &amp; Commissions</h1>
            <p className="text-muted-foreground">
              Verification, disputes, and dentist settlements.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline">Back to Admin</Button>
          </Link>
        </div>
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            [
              "Active commission rate",
              summary.activeCommissionRate === null
                ? "Not configured"
                : `${Number(summary.activeCommissionRate) * 100}%`,
            ],
            ["Total collected", money(summary.totalCollected)],
            ["Commission due", money(summary.totalCommissionDue)],
            ["Commission settled", money(summary.totalCommissionSettled)],
            ["Pending confirmations", summary.pendingConfirmations],
            ["Disputed payments", summary.disputedPayments],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Tabs defaultValue="awaiting">
          <TabsList className="mb-5 h-auto w-full flex-wrap">
            <TabsTrigger value="awaiting">
              Awaiting Patient Confirmation
            </TabsTrigger>
            <TabsTrigger value="verified">Verified Payments</TabsTrigger>
            <TabsTrigger value="disputed">Disputed Payments</TabsTrigger>
            <TabsTrigger value="settlements">
              Commission Settlements
            </TabsTrigger>
          </TabsList>
          <TabsContent value="awaiting">
            <PaymentList
              items={awaiting}
              empty="No patient confirmations are awaiting response."
              mode="awaiting"
            />
          </TabsContent>
          <TabsContent value="verified">
            <PaymentList
              items={verified}
              empty="No verified payments yet."
              mode="verified"
            />
          </TabsContent>
          <TabsContent value="disputed">
            <PaymentList
              items={disputed}
              empty="No disputed payments."
              mode="disputed"
              onResolve={(appointmentId, resolution) =>
                resolve.mutate({ appointmentId, resolution })
              }
              busy={resolve.isPending}
            />
          </TabsContent>
          <TabsContent value="settlements">
            <div className="space-y-3">
              {commissions.length === 0 ? (
                <Empty text="No commissions have been created. A configured rate and verified matching reports are required." />
              ) : (
                commissions.map((commission) => (
                  <Card key={commission.id}>
                    <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">
                          {commission.doctor.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(
                            commission.appointment.date,
                          ).toLocaleDateString()}{" "}
                          · {commission.appointment.reason ?? "Appointment"}
                        </p>
                        <p className="text-sm">
                          Collected {money(commission.collectedAmount)} · Rate{" "}
                          {Number(commission.commissionRate) * 100}% ·
                          Commission {money(commission.commissionAmount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            commission.status === "SETTLED"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {commission.status}
                        </Badge>
                        {commission.status === "DUE" && (
                          <Button
                            disabled={settle.isPending}
                            onClick={() => settle.mutate(commission.id)}
                          >
                            Mark settled
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function PaymentList({
  items,
  empty,
  mode,
  onResolve,
  busy,
}: {
  items: any[];
  empty: string;
  mode: "awaiting" | "verified" | "disputed";
  onResolve?: (id: string, resolution: "VERIFIED" | "CANCELLED") => void;
  busy?: boolean;
}) {
  if (!items.length) return <Empty text={empty} />;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {item.doctorName}{" "}
              <span className="font-normal text-muted-foreground">
                · {item.patientName || item.patientEmail}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {item.date} · {item.time} · {item.reason ?? "Appointment"}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Report
                label="Dentist report"
                amount={item.dentistReportedAmount}
                method={item.dentistPaymentMethod}
              />
              {mode !== "awaiting" && (
                <Report
                  label="Patient report"
                  amount={item.patientReportedAmount}
                  method={item.patientPaymentMethod}
                />
              )}
            </div>
            {mode === "awaiting" && (
              <p className="text-sm font-medium text-amber-600">
                Commission is not payable until independent patient confirmation
                matches.
              </p>
            )}
            {mode === "verified" && (
              <p className="text-sm">
                Verified{" "}
                {item.updatedAt
                  ? new Date(item.updatedAt).toLocaleString()
                  : ""}{" "}
                · Collected {money(item.actualAmountCollected)} ·{" "}
                {item.paymentMethod} · Commission{" "}
                {item.commission
                  ? `${Number(item.commission.commissionRate) * 100}% (${money(item.commission.commissionAmount)})`
                  : "pending rate configuration"}
              </p>
            )}
            {mode === "disputed" && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-sm text-destructive">
                  Reports differ. No payable commission exists until admin
                  resolution.
                </p>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onResolve?.(item.id, "VERIFIED")}
                >
                  Resolve as verified
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onResolve?.(item.id, "CANCELLED")}
                >
                  Cancel appointment
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}
