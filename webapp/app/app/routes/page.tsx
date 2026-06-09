import {
  ArrowDownIcon,
  CopyIcon,
  GripVerticalIcon,
  KeyRoundIcon,
  MoreVerticalIcon,
  PlusIcon,
  QrCodeIcon,
  Users2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { checkpoints } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const clueTypes: Record<string, { label: string; tone: string }> = {
  scan: { label: "QR scan", tone: "text-sky-300/80" },
  staff: { label: "Staff code", tone: "text-amber-300/80" },
  pair: { label: "Paired fragment", tone: "text-fuchsia-300/80" },
}

const checkpointClues = ["scan", "staff", "staff", "pair", "scan"] as const

export default function RoutesPage() {
  const selectedIndex = 2
  const selected = checkpoints[selectedIndex]

  return (
    <div className="px-5 pt-6 pb-14 lg:px-7">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Route · Cluj Loop 01
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
            Route builder
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Order checkpoints, assign sponsors and staff, and configure the clue
            each player has to solve to move on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs defaultValue="builder">
            <TabsList className="h-8 bg-secondary/40 p-0.5">
              <TabsTrigger value="builder" className="h-7 px-3 text-xs">
                Builder
              </TabsTrigger>
              <TabsTrigger value="preview" className="h-7 px-3 text-xs">
                Player preview
              </TabsTrigger>
              <TabsTrigger value="settings" className="h-7 px-3 text-xs">
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" className="h-8">
            Save draft
          </Button>
          <Button className="h-8">Publish</Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card className="self-start">
          <CardHeader className="flex-row items-start justify-between border-b border-border pb-3">
            <div>
              <CardTitle className="text-sm font-medium">Checkpoints</CardTitle>
              <CardDescription className="text-xs">
                {checkpoints.length} stops · drag to reorder
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <PlusIcon className="mr-1 size-3.5" /> Add
            </Button>
          </CardHeader>
          <CardContent className="grid gap-1.5 px-2 py-2">
            {checkpoints.map((cp, i) => {
              const clue = clueTypes[checkpointClues[i] ?? "scan"]
              const active = i === selectedIndex
              return (
                <div
                  key={cp.id}
                  data-active={active || undefined}
                  className={cn(
                    "grid grid-cols-[18px_28px_1fr_auto] items-center gap-2.5 rounded-md border border-transparent px-2 py-2 transition-colors",
                    "hover:bg-secondary/40",
                    "data-[active]:border-primary/40 data-[active]:bg-primary/8"
                  )}
                >
                  <GripVerticalIcon className="size-3.5 text-muted-foreground/40" />
                  <span className="grid size-7 place-items-center rounded-md border border-border bg-secondary/40 font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{cp.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {cp.sponsor} · {cp.area}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 rounded-full border-border bg-secondary/40 px-1.5 font-mono text-[9px] tracking-[0.08em] uppercase",
                        clue.tone
                      )}
                    >
                      {clue.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground"
                          >
                            <MoreVerticalIcon className="size-3.5" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit checkpoint</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem>Move up / down</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          Remove from route
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground"
            >
              <PlusIcon className="size-3.5" /> Add checkpoint
              <ArrowDownIcon className="size-3" />
            </button>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="flex-row items-start justify-between border-b border-border pb-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                Step {selectedIndex + 1} · {selected.id}
              </p>
              <CardTitle className="mt-0.5 text-base font-semibold">
                {selected.name}
              </CardTitle>
              <CardDescription className="text-xs">
                Operated by {selected.sponsor} · {selected.area}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="h-6 rounded-full border-rose-400/40 bg-rose-400/8 font-mono text-[10px] tracking-[0.08em] text-rose-300 uppercase"
            >
              Needs staff
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-5">
            <section className="grid gap-3">
              <SectionLabel
                icon={QrCodeIcon}
                title="Clue"
                hint="What the player sees on this stop"
              />
              <Field>
                <FieldLabel className="text-[11px] font-medium text-muted-foreground">
                  Clue type
                </FieldLabel>
                <Select defaultValue="pair">
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scan">QR scan</SelectItem>
                    <SelectItem value="staff">Staff code</SelectItem>
                    <SelectItem value="pair">Paired fragment</SelectItem>
                    <SelectItem value="nfc">NFC tag</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel className="text-[11px] font-medium text-muted-foreground">
                  Player-facing prompt
                </FieldLabel>
                <Textarea
                  defaultValue={selected.clue}
                  rows={2}
                  className="resize-none text-sm"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-[11px] font-medium text-muted-foreground">
                    Verification code
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      defaultValue="HVT-9F4K"
                      className="h-9 font-mono text-sm tracking-[0.08em]"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                    >
                      <CopyIcon className="size-3.5" />
                    </Button>
                  </div>
                </Field>
                <Field>
                  <FieldLabel className="text-[11px] font-medium text-muted-foreground">
                    Time limit
                  </FieldLabel>
                  <Select defaultValue="none">
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No limit</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            <Separator className="bg-border/60" />

            <section className="grid gap-3">
              <SectionLabel
                icon={Users2Icon}
                title="Staff assignment"
                hint="Booth operators who can issue this code"
              />
              <div className="grid gap-2">
                {[
                  { name: "Mara Ionescu", role: "Lead", primary: true },
                  { name: "Alex Radu", role: "Backup", primary: false },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {s.name.split(" ").map((p) => p[0]).join("")}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.role}
                        </p>
                      </div>
                    </div>
                    <Switch defaultChecked={s.primary} />
                  </div>
                ))}
                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground"
                >
                  <PlusIcon className="size-3.5" /> Invite booth staff
                </button>
              </div>
            </section>

            <Separator className="bg-border/60" />

            <section className="grid gap-3">
              <SectionLabel
                icon={KeyRoundIcon}
                title="Completion rules"
                hint="What counts as solving this checkpoint"
              />
              <RuleRow
                label="Require physical scan"
                hint="Player must scan the NFC tag at the booth"
                defaultChecked
              />
              <RuleRow
                label="Require pair fragment"
                hint="Player must combine with another player's fragment"
                defaultChecked
              />
              <RuleRow
                label="Allow re-attempt"
                hint="Player can retry up to 3 times after a wrong code"
              />
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SectionLabel({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid size-6 place-items-center rounded-md bg-secondary/60 text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

function RuleRow({
  label,
  hint,
  defaultChecked,
}: {
  label: string
  hint: string
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}
