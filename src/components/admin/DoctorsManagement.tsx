"use client";

import { type Doctor, DoctorApproval } from "@prisma/client";
import {
  CheckCircleIcon,
  ClockIcon,
  EditIcon,
  MailIcon,
  PhoneIcon,
  PlusIcon,
  StethoscopeIcon,
  XCircleIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  useGetDoctors,
  useReviewDentistApplication,
} from "@/hooks/use-doctors";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import AddDoctorDialog from "./AddDoctorDialog";
import EditDoctorDialog from "./EditDoctorDialog";

function DoctorsManagement() {
  const { data: doctors = [], isLoading } = useGetDoctors();
  const reviewApplication = useReviewDentistApplication();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const pendingApplications = doctors.filter(
    (doctor) => doctor.approvalStatus === "PENDING",
  );

  const approvedDoctors = doctors.filter(
    (doctor) => doctor.approvalStatus === "APPROVED",
  );

  const handleEditDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedDoctor(null);
  };

  const handleReview = (
    doctorId: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    const action = decision === "APPROVED" ? "approve" : "reject";

    if (
      !window.confirm(`Are you sure you want to ${action} this application?`)
    ) {
      return;
    }

    reviewApplication.mutate({ doctorId, decision });
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="size-5 text-primary" />
            Pending Dentist Applications
            <Badge variant="secondary">{pendingApplications.length}</Badge>
          </CardTitle>
          <CardDescription>
            Review and approve dentists before they can receive patient
            bookings.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading applications...
            </p>
          ) : pendingApplications.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No pending dentist applications.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApplications.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex flex-col gap-4 rounded-xl border border-border/50 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    {doctor.imageUrl ? (
                      <Image
                        src={doctor.imageUrl}
                        alt={doctor.name}
                        width={48}
                        height={48}
                        className="size-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <StethoscopeIcon className="size-5" />
                      </div>
                    )}

                    <div>
                      <div className="font-semibold">{doctor.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {doctor.speciality}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MailIcon className="size-3" />
                          {doctor.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="size-3" />
                          {doctor.phone}
                        </span>
                      </div>
                      {doctor.licenseNumber && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          License: {doctor.licenseNumber}
                        </p>
                      )}
                      {doctor.clinicAddress && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Clinic: {doctor.clinicAddress}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Awaiting review</Badge>
                    <Button
                      size="sm"
                      onClick={() => handleReview(doctor.id, "APPROVED")}
                      disabled={reviewApplication.isPending}
                    >
                      <CheckCircleIcon className="mr-1 size-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReview(doctor.id, "REJECTED")}
                      disabled={reviewApplication.isPending}
                    >
                      <XCircleIcon className="mr-1 size-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-12">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <StethoscopeIcon className="size-5 text-primary" />
              Doctors Management
            </CardTitle>
            <CardDescription>
              Manage approved doctors and oversee their activity.
            </CardDescription>
          </div>

          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/100"
          >
            <PlusIcon className="mr-2 size-4" />
            Add Doctor
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading doctors...</p>
          ) : approvedDoctors.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No approved doctors found.
            </div>
          ) : (
            <div className="space-y-4">
              {approvedDoctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex flex-col gap-4 rounded-xl border border-border/50 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    {doctor.imageUrl ? (
                      <Image
                        src={doctor.imageUrl}
                        alt={doctor.name}
                        width={48}
                        height={48}
                        className="size-12 rounded-full object-cover ring-2 ring-background"
                      />
                    ) : (
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <StethoscopeIcon className="size-5" />
                      </div>
                    )}

                    <div>
                      <div className="font-semibold">{doctor.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {doctor.speciality}
                        <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
                          {doctor.gender === "MALE" ? "Male" : "Female"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MailIcon className="size-3" />
                          {doctor.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="size-3" />
                          {doctor.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-center">
                      <div className="font-semibold text-primary">
                        {"appointmentCount" in doctor
                          ? String(
                              (doctor as Doctor & { appointmentCount?: number })
                                .appointmentCount ?? 0,
                            )
                          : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Appointments
                      </div>
                    </div>

                    {doctor.isActive ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3"
                      onClick={() => handleEditDoctor(doctor)}
                    >
                      <EditIcon className="mr-1 size-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddDoctorDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />

      <EditDoctorDialog
        key={selectedDoctor?.id}
        isOpen={isEditDialogOpen}
        onClose={handleCloseEditDialog}
        doctor={selectedDoctor}
      />
    </>
  );
}

export default DoctorsManagement;
