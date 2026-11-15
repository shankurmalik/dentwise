"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import type { AppointmentStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "../prisma";

function transformAppointment(appointment: any) {
  const {
    consultationFee,
    actualAmountCollected,
    dentistReportedAmount,
    patientReportedAmount,
    ...serializableAppointment
  } = appointment;
  return {
    ...serializableAppointment,
    patientName:
      `${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim(),
    patientEmail: appointment.user.email,
    doctorName: appointment.doctor.name,
    doctorImageUrl: appointment.doctor.imageUrl || "",
    date: appointment.date.toISOString().split("T")[0],
    consultationFee: consultationFee?.toString() ?? null,
    actualAmountCollected: actualAmountCollected?.toString() ?? null,
    verificationStatus: appointment.verificationStatus,
    verificationDeadline: appointment.verificationDeadline,
    dentistReportedAmount: dentistReportedAmount?.toString() ?? null,
    dentistPaymentMethod: appointment.dentistPaymentMethod,
    patientReportedAmount: patientReportedAmount?.toString() ?? null,
    patientPaymentMethod: appointment.patientPaymentMethod,
  };
}

async function getOrCreateDatabaseUser() {
  const { userId } = await auth();

  if (!userId) throw new Error("You must be logged in");

  const clerkUser = await currentUser();

  if (!clerkUser) throw new Error("Unable to fetch Clerk user");

  const email = clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) throw new Error("Your account has no email address");

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ clerkId: userId }, { email }],
    },
  });

  if (existingUser) {
    return prisma.user.update({
      where: { id: existingUser.id },
      data: {
        clerkId: userId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        phone: clerkUser.phoneNumbers[0]?.phoneNumber ?? null,
      },
    });
  }

  return prisma.user.create({
    data: {
      clerkId: userId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      phone: clerkUser.phoneNumbers[0]?.phoneNumber ?? null,
      role: "PATIENT",
    },
  });
}

async function requireAdmin() {
  const user = await currentUser();

  if (!user) throw new Error("You must be logged in");

  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = user.emailAddresses[0]?.emailAddress;

  if (!adminEmail || userEmail !== adminEmail) {
    throw new Error("Unauthorized");
  }
}

function assertAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error("Enter a valid amount");
}

async function getApprovedCurrentDentist() {
  const user = await getOrCreateDatabaseUser();
  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });

  if (!doctor || doctor.approvalStatus !== "APPROVED" || !doctor.isActive) {
    throw new Error("Your dentist account is not approved");
  }

  return { user, doctor };
}

async function finalizeMatchingReports(
  appointmentId: string,
  actorUserId: string,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment?.dentistReportedAt || !appointment.patientReportedAt) return;

  const matches =
    appointment.dentistReportedAmount?.equals(
      appointment.patientReportedAmount ?? 0,
    ) && appointment.dentistPaymentMethod === appointment.patientPaymentMethod;

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: matches
        ? {
            verificationStatus: "VERIFIED",
            actualAmountCollected: appointment.dentistReportedAmount,
            paymentMethod: appointment.dentistPaymentMethod,
            dentistConfirmedAt: appointment.dentistReportedAt,
            patientConfirmedAt: appointment.patientReportedAt,
          }
        : { verificationStatus: "DISPUTED" },
    });
    await tx.verificationEvent.create({
      data: {
        appointmentId,
        actorUserId,
        eventType: matches ? "REPORTS_MATCHED" : "REPORTS_DISPUTED",
        details: {
          reason: matches
            ? "Matching independent reports"
            : "Reported amount or payment method differs",
        },
      },
    });
    if (matches && appointment.dentistReportedAmount) {
      const setting = await tx.commissionSetting.findUnique({
        where: { id: "default" },
      });
      if (setting) {
        await tx.commission.upsert({
          where: { appointmentId },
          create: {
            appointmentId,
            doctorId: appointment.doctorId,
            collectedAmount: appointment.dentistReportedAmount,
            commissionRate: setting.rate,
            commissionAmount: appointment.dentistReportedAmount.mul(
              setting.rate,
            ),
          },
          update: {},
        });
      } else {
        await tx.verificationEvent.create({
          data: {
            appointmentId,
            actorUserId,
            eventType: "COMMISSION_PENDING_CONFIGURATION",
          },
        });
      }
    }
  });
}

export async function updateCommissionRate(rate: number) {
  await requireAdmin();
  if (!Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new Error("Commission rate must be between 0 and 1");
  const setting = await prisma.commissionSetting.upsert({
    where: { id: "default" },
    create: { id: "default", rate },
    update: { rate },
  });
  return { ...setting, rate: setting.rate.toString() };
}

export async function getCommissions() {
  await requireAdmin();
  const commissions = await prisma.commission.findMany({
    include: { doctor: { select: { name: true } }, appointment: true },
    orderBy: { createdAt: "desc" },
  });
  return commissions.map(
    ({
      collectedAmount,
      commissionRate,
      commissionAmount,
      appointment,
      ...commission
    }) => ({
      ...commission,
      collectedAmount: collectedAmount.toString(),
      commissionRate: commissionRate.toString(),
      commissionAmount: commissionAmount.toString(),
      appointment: transformAppointment({
        ...appointment,
        user: { firstName: null, lastName: null, email: "" },
        doctor: { name: "", imageUrl: "" },
      }),
    }),
  );
}

export async function settleCommission(commissionId: string) {
  await requireAdmin();
  const result = await prisma.commission.updateMany({
    where: { id: commissionId, status: "DUE" },
    data: { status: "SETTLED", settledAt: new Date() },
  });
  if (result.count !== 1)
    throw new Error("This commission is already settled or unavailable");
  return { success: true };
}

export async function getAdminPayments() {
  await requireAdmin();
  const appointments = await prisma.appointment.findMany({
    where: {
      verificationStatus: { in: ["AWAITING_PATIENT", "VERIFIED", "DISPUTED"] },
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      doctor: { select: { name: true, imageUrl: true } },
      commission: true,
      events: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const [commissions, commissionSetting] = await Promise.all([
    prisma.commission.findMany({
      include: {
        doctor: { select: { name: true } },
        appointment: { select: { date: true, time: true, reason: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.commissionSetting.findUnique({ where: { id: "default" } }),
  ]);
  const serializedAppointments = appointments.map(
    ({ commission, events, ...appointment }) => ({
      ...transformAppointment(appointment),
      commission: commission
        ? {
            ...commission,
            collectedAmount: commission.collectedAmount.toString(),
            commissionRate: commission.commissionRate.toString(),
            commissionAmount: commission.commissionAmount.toString(),
          }
        : null,
      events: events.map((event) => ({ ...event })),
    }),
  );
  const serializedCommissions = commissions.map((commission) => ({
    ...commission,
    collectedAmount: commission.collectedAmount.toString(),
    commissionRate: commission.commissionRate.toString(),
    commissionAmount: commission.commissionAmount.toString(),
    appointment: {
      ...commission.appointment,
      date: commission.appointment.date.toISOString(),
    },
  }));
  const sum = (items: typeof commissions) =>
    items.reduce((total, item) => total + Number(item.commissionAmount), 0);
  return {
    appointments: serializedAppointments,
    commissions: serializedCommissions,
    summary: {
      totalCollected: appointments
        .filter((item) => item.verificationStatus === "VERIFIED")
        .reduce(
          (total, item) => total + Number(item.actualAmountCollected ?? 0),
          0,
        )
        .toFixed(2),
      totalCommissionDue: sum(
        commissions.filter((item) => item.status === "DUE"),
      ).toFixed(2),
      totalCommissionSettled: sum(
        commissions.filter((item) => item.status === "SETTLED"),
      ).toFixed(2),
      pendingConfirmations: appointments.filter(
        (item) => item.verificationStatus === "AWAITING_PATIENT",
      ).length,
      disputedPayments: appointments.filter(
        (item) => item.verificationStatus === "DISPUTED",
      ).length,
      activeCommissionRate: commissionSetting?.rate.toString() ?? null,
    },
  };
}

export async function resolveDisputedPayment(input: {
  appointmentId: string;
  resolution: "VERIFIED" | "CANCELLED";
}) {
  await requireAdmin();
  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, verificationStatus: "DISPUTED" },
  });
  if (!appointment) throw new Error("Disputed appointment not found");
  await prisma.$transaction(async (tx) => {
    if (input.resolution === "CANCELLED") {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: "CANCELLED" },
      });
    } else {
      const setting = await tx.commissionSetting.findUnique({
        where: { id: "default" },
      });
      if (
        !setting ||
        !appointment.dentistReportedAmount ||
        !appointment.dentistPaymentMethod
      )
        throw new Error(
          "Configure a commission rate and review the dentist report before verifying",
        );
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          verificationStatus: "VERIFIED",
          actualAmountCollected: appointment.dentistReportedAmount,
          paymentMethod: appointment.dentistPaymentMethod,
        },
      });
      await tx.commission.upsert({
        where: { appointmentId: appointment.id },
        create: {
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          collectedAmount: appointment.dentistReportedAmount,
          commissionRate: setting.rate,
          commissionAmount: appointment.dentistReportedAmount.mul(setting.rate),
        },
        update: {},
      });
    }
    await tx.verificationEvent.create({
      data: {
        appointmentId: appointment.id,
        eventType: `ADMIN_RESOLVED_${input.resolution}`,
      },
    });
  });
  return { success: true };
}

export async function getAppointments() {
  try {
    await requireAdmin();

    const appointments = await prisma.appointment.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        doctor: {
          select: { name: true, imageUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    throw new Error("Failed to fetch appointments");
  }
}

export async function getUserAppointments() {
  try {
    const user = await getOrCreateDatabaseUser();

    const appointments = await prisma.appointment.findMany({
      where: { userId: user.id },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        doctor: {
          select: { name: true, imageUrl: true },
        },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.error("Error fetching user appointments:", error);
    throw new Error("Failed to fetch user appointments");
  }
}

export async function getUserAppointmentStats() {
  try {
    const user = await getOrCreateDatabaseUser();

    const [totalCount, completedCount] = await Promise.all([
      prisma.appointment.count({
        where: { userId: user.id },
      }),
      prisma.appointment.count({
        where: {
          userId: user.id,
          status: "COMPLETED",
        },
      }),
    ]);

    return {
      totalAppointments: totalCount,
      completedAppointments: completedCount,
    };
  } catch (error) {
    console.error("Error fetching appointment stats:", error);
    return {
      totalAppointments: 0,
      completedAppointments: 0,
    };
  }
}

export async function getBookedTimeSlots(doctorId: string, date: string) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: new Date(date),
        status: {
          in: ["PENDING", "CONFIRMED", "COMPLETED"],
        },
      },
      select: { time: true },
    });

    return appointments.map((appointment) => appointment.time);
  } catch (error) {
    console.error("Error fetching booked time slots:", error);
    return [];
  }
}

interface BookAppointmentInput {
  doctorId: string;
  date: string;
  time: string;
  reason?: string;
}

export async function bookAppointment(input: BookAppointmentInput) {
  try {
    if (!input.doctorId || !input.date || !input.time) {
      throw new Error("Doctor, date, and time are required");
    }

    const user = await getOrCreateDatabaseUser();

    if (user.role !== "PATIENT") {
      throw new Error("Only patient accounts can book appointments");
    }

    const doctor = await prisma.doctor.findFirst({
      where: {
        id: input.doctorId,
        isActive: true,
        approvalStatus: "APPROVED",
      },
    });

    if (!doctor) throw new Error("This dentist is not available");

    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        doctorId: doctor.id,
        date: new Date(input.date),
        time: input.time,
        reason: input.reason || "General consultation",
        consultationFee: doctor.consultationFee,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        doctor: {
          select: { name: true, imageUrl: true },
        },
      },
    });

    return transformAppointment(appointment);
  } catch (error) {
    console.error("Error booking appointment:", error);

    if (
      error instanceof Error &&
      error.message !== "Failed to book appointment"
    ) {
      throw error;
    }

    throw new Error("Failed to book appointment. Please try again later.");
  }
}

export async function updateAppointmentStatus(input: {
  id: string;
  status: AppointmentStatus;
}) {
  try {
    await requireAdmin();

    const allowedStatuses: AppointmentStatus[] = [
      "PENDING",
      "CONFIRMED",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(input.status)) {
      throw new Error("Invalid appointment status");
    }

    const appointment = await prisma.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { name: true, imageUrl: true } },
      },
    });
    return transformAppointment(appointment);
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw new Error("Failed to update appointment");
  }
}

export async function getDentistAppointments() {
  const { doctor } = await getApprovedCurrentDentist();
  const appointments = await prisma.appointment.findMany({
    where: { doctorId: doctor.id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      doctor: { select: { name: true, imageUrl: true } },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  return appointments.map(transformAppointment);
}

export async function reportDentistCompletion(input: {
  appointmentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
}) {
  const { user, doctor } = await getApprovedCurrentDentist();
  assertAmount(input.amount);

  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, doctorId: doctor.id },
  });
  if (!appointment) throw new Error("Appointment not found");
  if (["CANCELLED", "REJECTED"].includes(appointment.status)) {
    throw new Error("Cancelled appointments cannot be reported");
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "COMPLETED",
        dentistReportedAmount: input.amount,
        dentistPaymentMethod: input.paymentMethod,
        dentistReportedAt: now,
        verificationStatus: "AWAITING_PATIENT",
        verificationDeadline: appointment.verificationDeadline ?? deadline,
      },
    }),
    prisma.verificationEvent.create({
      data: {
        appointmentId: appointment.id,
        actorUserId: user.id,
        eventType: "DENTIST_REPORTED_COMPLETION",
        details: { amount: input.amount, paymentMethod: input.paymentMethod },
      },
    }),
  ]);

  await finalizeMatchingReports(appointment.id, user.id);
  return { success: true };
}

export async function reportPatientCompletion(input: {
  appointmentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
}) {
  const user = await getOrCreateDatabaseUser();
  assertAmount(input.amount);

  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, userId: user.id },
  });
  if (!appointment) throw new Error("Appointment not found");
  if (
    appointment.verificationDeadline &&
    appointment.verificationDeadline < new Date()
  ) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { verificationStatus: "EXPIRED" },
    });
    throw new Error("The 48-hour confirmation window has closed");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        patientReportedAmount: input.amount,
        patientPaymentMethod: input.paymentMethod,
        patientReportedAt: now,
      },
    }),
    prisma.verificationEvent.create({
      data: {
        appointmentId: appointment.id,
        actorUserId: user.id,
        eventType: "PATIENT_REPORTED_COMPLETION",
        details: { amount: input.amount, paymentMethod: input.paymentMethod },
      },
    }),
  ]);

  await finalizeMatchingReports(appointment.id, user.id);
  return { success: true };
}
