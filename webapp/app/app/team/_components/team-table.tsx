"use client"

import { ClockIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Friendly label for a Clerk org role (built-in or our custom roles). */
function roleLabel(role: string): string {
  const map: Record<string, string> = {
    "org:admin": "Organizer",
    "org:organizer": "Organizer",
    "org:prize_desk": "Prize desk",
    "org:booth_staff": "Booth staff",
    "org:sponsor": "Sponsor",
    "org:member": "Member",
  }
  return map[role] ?? role.replace(/^org:/, "").replace(/_/g, " ")
}

interface Member {
  id: string
  userId: string
  name: string
  email: string
  role: string
}

interface Invite {
  id: string
  email: string
  role: string
}

/**
 * Pure read-only view for now. Re-invite / revoke buttons hooked up
 * in Phase 2D++ when the operator wants to manage pending invitations
 * — for the pilot, the organizer cancels in the Clerk dashboard.
 */
export function TeamTable({
  memberships,
  invitations,
}: {
  memberships: Member[]
  invitations: Invite[]
}) {
  // Phase 2D+ will wire revoke/edit role here.
  return (
    <div className="grid gap-8">
      <div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-8 px-0 text-[11px] font-normal text-muted-foreground">
                Name
              </TableHead>
              <TableHead className="h-8 text-[11px] font-normal text-muted-foreground">
                Email
              </TableHead>
              <TableHead className="h-8 px-0 text-right text-[11px] font-normal text-muted-foreground">
                Role
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.length === 0 && (
              <TableRow className="border-border">
                <TableCell
                  colSpan={3}
                  className="px-0 py-6 text-center text-sm text-muted-foreground"
                >
                  No team members yet.
                </TableCell>
              </TableRow>
            )}
            {memberships.map((m) => (
              <TableRow key={m.id} className="border-border">
                <TableCell className="px-0 py-2.5 text-sm">{m.name}</TableCell>
                <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                  {m.email}
                </TableCell>
                <TableCell className="px-0 py-2.5 text-right text-xs text-muted-foreground">
                  {roleLabel(m.role)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {invitations.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Pending invitations
          </p>
          <ul className="grid divide-y divide-border border-y border-border">
            {invitations.map((i) => (
              <li
                key={i.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5"
              >
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {i.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {roleLabel(i.role)}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ClockIcon className="size-3" /> Awaiting accept
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
