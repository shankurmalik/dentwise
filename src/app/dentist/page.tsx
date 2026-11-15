"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import type { Gender, PaymentMethod } from "@prisma/client";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDentistAppointments,
  useReportDentistCompletion,
} from "@/hooks/use-appointment";
import { useMyDentistProfile, useRegisterDentist } from "@/hooks/use-doctors";

export default function DentistPage() {
  const { isLoaded, isSignedIn } = useUser();
  const profile = useMyDentistProfile(Boolean(isSignedIn));
  const register = useRegisterDentist();
  const appointments = useDentistAppointments(
    profile.data?.approvalStatus === "APPROVED",
  );
  const report = useReportDentistCompletion();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    speciality: "",
    licenseNumber: "",
    clinicAddress: "",
    consultationFee: "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    register.mutate(
      {
        ...form,
        consultationFee: Number(form.consultationFee),
        gender: "MALE" as Gender,
      },
      {
        onSuccess: () => toast.success("Application submitted for approval"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const reportCompleted = (appointmentId: string) => {
    const rawAmount = window.prompt("Amount collected (₹)");
    if (rawAmount === null) return;
    report.mutate(
      {
        appointmentId,
        amount: Number(rawAmount),
        paymentMethod: "CASH" as PaymentMethod,
      },
      {
        onSuccess: () => toast.success("Patient confirmation requested"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const doctor = profile.data;
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-24 sm:px-6">
        <div className="section-heading">
          <p className="text-sm font-medium text-primary">
            DentWise for professionals
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Dentist Portal</h1>
        </div>
        {!isLoaded || profile.isLoading ? (
          <div className="surface-card p-8 text-center text-muted-foreground">
            Loading your portal…
          </div>
        ) : !isSignedIn ? (
          <div className="surface-card mt-6 p-6">
            <p className="mb-4 text-muted-foreground">
              Sign in to submit and manage a dentist application.
            </p>
            <SignInButton mode="redirect">
              <Button>Sign in</Button>
            </SignInButton>
          </div>
        ) : !doctor ? (
          <form
            onSubmit={submit}
            className="surface-card mt-6 grid gap-4 p-5 sm:grid-cols-2 sm:p-6"
          >
            <p className="text-muted-foreground sm:col-span-2">
              Submit your professional details for secure admin review.
            </p>
            {Object.entries(form).map(([key, value]) => (
              <div
                key={key}
                className={key === "clinicAddress" ? "sm:col-span-2" : ""}
              >
                <Label className="mb-1.5 block capitalize" htmlFor={key}>
                  {key.replace(/([A-Z])/g, " $1")}
                </Label>
                <Input
                  id={key}
                  required
                  value={value}
                  type={key === "consultationFee" ? "number" : "text"}
                  min={key === "consultationFee" ? "0" : undefined}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </div>
            ))}
            <Button
              className="sm:col-span-2 sm:w-fit"
              disabled={register.isPending}
            >
              {register.isPending ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        ) : doctor.approvalStatus !== "APPROVED" ? (
          <div className="surface-card mt-6 p-6">
            <h2 className="font-semibold">
              Application {doctor.approvalStatus.toLowerCase()}
            </h2>
            <p className="mt-2 text-muted-foreground">
              You will receive access after an administrator approves your
              application.
            </p>
          </div>
        ) : (
          <section className="mt-6">
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              Manage only your own appointments. Reporting completion starts a
              48-hour patient confirmation window.
            </div>
            <div className="space-y-3">
              {appointments.data?.map((appointment) => (
                <div
                  className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={appointment.id}
                >
                  <div>
                    <p className="font-medium">{appointment.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.date} · {appointment.time} ·{" "}
                      {appointment.reason}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={
                      report.isPending || appointment.status === "CANCELLED"
                    }
                    onClick={() => reportCompleted(appointment.id)}
                  >
                    Report completion
                  </Button>
                </div>
              ))}
              {appointments.data?.length === 0 && (
                <div className="surface-card p-8 text-center text-muted-foreground">
                  No appointments yet.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
