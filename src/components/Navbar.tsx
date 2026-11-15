"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import {
  CalendarIcon,
  HomeIcon,
  MicIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Navbar() {
  const { user } = useUser();
  const pathname = usePathname();

  const isAdmin =
    user?.emailAddresses?.[0]?.emailAddress ===
    process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
    { href: "/appointments", label: "Appointments", icon: CalendarIcon },
    { href: "/voice", label: "Voice", icon: MicIcon },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/70 bg-background/90 px-4 py-2 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="DentWise Logo"
              width={32}
              height={32}
              className="w-11"
            />
          </Link>

          <div className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-4">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  pathname === href
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}

            <Link
              href="/dentist"
              className={`flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                pathname.startsWith("/dentist")
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <StethoscopeIcon className="w-4 h-4" />
              <span className="hidden md:inline">Dentist Portal</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className={`flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  pathname === "/admin"
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShieldCheckIcon className="w-4 h-4" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-sm font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="text-xs text-muted-foreground">
              {user?.emailAddresses?.[0]?.emailAddress}
            </span>
          </div>
          <UserButton />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
