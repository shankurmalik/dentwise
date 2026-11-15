"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import type { Gender } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { generateAvatar } from "../utils";

function serializeDoctor<
  T extends { consultationFee: { toString(): string } | null },
>(doctor: T) {
  return {
    ...doctor,
    consultationFee: doctor.consultationFee?.toString() ?? null,
  };
}

// Check that the current user is the administrator.
async function requireAdmin() {
  const user = await currentUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  const email = user?.emailAddresses[0]?.emailAddress;

  if (!user || !adminEmail || email !== adminEmail) {
    throw new Error("Unauthorized: Admin access required");
  }

  return user;
}

// Get or create the currently logged-in database user.
async function getOrCreateCurrentUser() {
  const { userId } = await auth();

  if (!userId) throw new Error("Please sign in first");

  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unable to retrieve your account");

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("Your account needs an email address");

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ clerkId: userId }, { email }],
    },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
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

// ADMIN: Get all dentist profiles.
export async function getDoctors() {
  try {
    await requireAdmin();

    const doctors = await prisma.doctor.findMany({
      include: {
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return doctors.map((doctor) => ({
      ...serializeDoctor(doctor),
      appointmentCount: doctor._count.appointments,
    }));
  } catch (error) {
    console.error("Error fetching doctors:", error);
    throw new Error("Failed to fetch doctors");
  }
}

interface CreateDoctorInput {
  name: string;
  email: string;
  phone: string;
  speciality: string;
  gender: Gender;
  isActive: boolean;
  consultationFee?: number;
  clinicAddress?: string;
  licenseNumber?: string;
}

// ADMIN: Manually create an already-approved dentist.
export async function createDoctor(input: CreateDoctorInput) {
  try {
    await requireAdmin();

    if (!input.name || !input.email || !input.phone || !input.speciality) {
      throw new Error("Please complete all required doctor details");
    }

    const doctor = await prisma.doctor.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        speciality: input.speciality,
        gender: input.gender,
        isActive: input.isActive,
        consultationFee: input.consultationFee ?? 0,
        clinicAddress: input.clinicAddress,
        licenseNumber: input.licenseNumber,
        imageUrl: generateAvatar(input.name, input.gender),
        approvalStatus: "APPROVED",
      },
    });

    revalidatePath("/admin");
    revalidatePath("/appointments");

    return serializeDoctor(doctor);
  } catch (error: any) {
    console.error("Error creating doctor:", error);

    if (error?.code === "P2002") {
      throw new Error("A doctor with this email already exists");
    }

    throw new Error(
      error instanceof Error ? error.message : "Failed to create doctor",
    );
  }
}

interface UpdateDoctorInput extends Partial<CreateDoctorInput> {
  id: string;
}

// ADMIN: Update an existing dentist.
export async function updateDoctor(input: UpdateDoctorInput) {
  try {
    await requireAdmin();

    const doctor = await prisma.doctor.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.speciality !== undefined && {
          speciality: input.speciality,
        }),
        ...(input.gender !== undefined && { gender: input.gender }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.consultationFee !== undefined && {
          consultationFee: input.consultationFee,
        }),
        ...(input.clinicAddress !== undefined && {
          clinicAddress: input.clinicAddress,
        }),
        ...(input.licenseNumber !== undefined && {
          licenseNumber: input.licenseNumber,
        }),
      },
    });

    revalidatePath("/admin");
    revalidatePath("/appointments");

    return serializeDoctor(doctor);
  } catch (error) {
    console.error("Error updating doctor:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to update doctor",
    );
  }
}

// DENTIST: Submit an application for admin approval.
export async function registerDentist(input: {
  name: string;
  phone: string;
  speciality: string;
  gender: Gender;
  licenseNumber: string;
  clinicAddress: string;
  consultationFee: number;
}) {
  try {
    const user = await getOrCreateCurrentUser();

    if (user.role === "ADMIN") {
      throw new Error("Admin accounts cannot register as dentists");
    }

    if (
      !input.name?.trim() ||
      !input.phone?.trim() ||
      !input.speciality?.trim() ||
      !input.licenseNumber?.trim() ||
      !input.clinicAddress?.trim()
    ) {
      throw new Error("Please complete all required fields");
    }

    if (!Number.isFinite(input.consultationFee) || input.consultationFee < 0) {
      throw new Error("Please enter a valid consultation fee");
    }

    const existing = await prisma.doctor.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (existing) {
      return {
        success: true,
        applicationId: existing.id,
        status: existing.approvalStatus,
        message:
          existing.approvalStatus === "PENDING"
            ? "Your dentist application is already pending review."
            : existing.approvalStatus === "APPROVED"
              ? "Your dentist account is approved."
              : "Your previous application was rejected. Please contact support before resubmitting.",
      };
    }

    let application;
    try {
      application = await prisma.doctor.create({
        data: {
          userId: user.id,
          name: input.name.trim(),
          email: user.email,
          phone: input.phone.trim(),
          speciality: input.speciality.trim(),
          gender: input.gender,
          licenseNumber: input.licenseNumber.trim(),
          clinicAddress: input.clinicAddress.trim(),
          consultationFee: input.consultationFee,
          imageUrl: generateAvatar(input.name, input.gender),
          isActive: false,
          approvalStatus: "PENDING",
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
      const concurrentApplication = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (!concurrentApplication) throw error;
      return {
        success: true,
        applicationId: concurrentApplication.id,
        status: concurrentApplication.approvalStatus,
        message: "Your dentist application has already been received.",
      };
    }

    revalidatePath("/dentist");
    revalidatePath("/admin");

    return {
      success: true,
      applicationId: application.id,
      status: application.approvalStatus,
      message: "Application submitted. Please wait for admin approval.",
    };
  } catch (error) {
    console.error("Dentist registration error:", error);

    throw new Error(
      error instanceof Error ? error.message : "Failed to submit application",
    );
  }
}

// ADMIN: Approve or reject a dentist application.
export async function reviewDentistApplication(input: {
  doctorId: string;
  decision: "APPROVED" | "REJECTED";
}) {
  try {
    await requireAdmin();

    const doctor = await prisma.doctor.findUnique({
      where: { id: input.doctorId },
    });

    if (!doctor) {
      throw new Error("Dentist application not found");
    }

    const updatedDoctor = await prisma.$transaction(async (tx) => {
      const updated = await tx.doctor.update({
        where: { id: input.doctorId },
        data: {
          approvalStatus: input.decision,
          isActive: input.decision === "APPROVED",
        },
      });

      if (doctor.userId) {
        await tx.user.update({
          where: { id: doctor.userId },
          data: {
            role: input.decision === "APPROVED" ? "DENTIST" : "PATIENT",
          },
        });
      }

      return updated;
    });

    revalidatePath("/admin");
    revalidatePath("/dentist");
    revalidatePath("/appointments");

    return serializeDoctor(updatedDoctor);
  } catch (error) {
    console.error("Dentist application review error:", error);

    throw new Error(
      error instanceof Error ? error.message : "Failed to review application",
    );
  }
}

// PUBLIC: Only approved and active dentists appear to patients.
export async function getAvailableDoctors() {
  try {
    const doctors = await prisma.doctor.findMany({
      where: {
        isActive: true,
        approvalStatus: "APPROVED",
      },
      include: {
        _count: {
          select: { appointments: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return doctors.map((doctor) => ({
      ...serializeDoctor(doctor),
      appointmentCount: doctor._count.appointments,
    }));
  } catch (error) {
    console.error("Error fetching available doctors:", error);
    throw new Error("Failed to fetch available doctors");
  }
}

// DENTIST: Get the currently logged-in dentist's profile/application.
export async function getMyDentistProfile() {
  try {
    const user = await getOrCreateCurrentUser();

    const doctor = await prisma.doctor.findUnique({
      where: {
        userId: user.id,
      },
    });
    return doctor ? serializeDoctor(doctor) : null;
  } catch (error) {
    console.error("Error fetching dentist profile:", error);
    throw new Error("Failed to fetch dentist profile");
  }
}
