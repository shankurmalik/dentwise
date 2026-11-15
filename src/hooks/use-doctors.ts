"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDoctor,
  getAvailableDoctors,
  getDoctors,
  getMyDentistProfile,
  registerDentist,
  reviewDentistApplication,
  updateDoctor,
} from "@/lib/actions/doctors";

export function useGetDoctors() {
  return useQuery({
    queryKey: ["getDoctors"],
    queryFn: getDoctors,
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDoctor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getDoctors"] });
      queryClient.invalidateQueries({ queryKey: ["getAvailableDoctors"] });
    },
  });
}

export function useUpdateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDoctor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getDoctors"] });
      queryClient.invalidateQueries({ queryKey: ["getAvailableDoctors"] });
    },
  });
}

export function useAvailableDoctors() {
  return useQuery({
    queryKey: ["getAvailableDoctors"],
    queryFn: getAvailableDoctors,
  });
}

export function useRegisterDentist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerDentist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myDentistProfile"] });
    },
  });
}

export function useMyDentistProfile(enabled = true) {
  return useQuery({
    queryKey: ["myDentistProfile"],
    queryFn: getMyDentistProfile,
    enabled,
  });
}

export function useReviewDentistApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reviewDentistApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getDoctors"] });
      queryClient.invalidateQueries({ queryKey: ["getAvailableDoctors"] });
    },
  });
}
