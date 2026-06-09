import {
  CopyIcon,
  GripVerticalIcon,
  MoreVerticalIcon,
  PlusIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { checkpoints } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const clueLabel: Record<string, string> = {
  scan: "QR scan",
  staff: "Staff code",
  pair: "Paired fragment",
}

const checkpointClues = ["scan", "staff", "staff", "pair", "scan"] as const

export default function RoutesPage() {
  const selectedIndex = 2
  const selected = checkpoints[selectedIndex]

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-8 pb-16 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="max-w-xl">
          <h1 className="text-xl font-medium tracking-tight">Route builder</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Order checkpoints, assign sponsors and staff, and configure the clue
            each player has to solve to move on.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs defaultValue="builder">
            <TabsList className="h-8 bg-transparent p-0 gap-0">
              <TabsTrigger
                value="builder"
                className="h-8 rounded-none border-b border-transparent px-3 text-xs text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Builder
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="h-8 rounded-none border-b border-transparent px-3 text-xs text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Preview
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="h-8 rounded-none border-b border-transparent px-3 text-xs text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <Button variant="ghost" className="h-8 text-muted-foreground">
              Save draft
            </Button>
            <Button className="h-8">Publish</Button>
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <SectionHeading
            title="Checkpoints"
            hint={`${checkpoints.length} stops · drag to reorder`}
            trailing={
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <PlusIcon className="size-3" /> Add
              </button>
            }
          />
          <ul className="grid divide-y divide-border">
            {checkpoints.map((cp, i) => {
              const clue = clueLabel[checkpointClues[i] ?? "scan"]
              const active = i === selectedIndex
              return (
                <li
                  key={cp.id}
                  data-active={active || undefined}
                  className={cn(
                    "group grid grid-cols-[14px_24px_1fr_auto] items-center gap-3 py-3 transition-colors",
                    "hover:bg-muted/30",
                    "data-[active]:bg-muted/50"
                  )}
                >
                  <GripVerticalIcon className="size-3 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{cp.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cp.sponsor} · {cp.area}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pr-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {clue}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground opacity-0 group-hover:opacity-100"
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
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <PlusIcon className="size-3.5" /> Add checkpoint
          </button>
        </div>

        <div>
          <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Step {selectedIndex + 1} · {selected.id}
              </p>
              <h2 className="mt-0.5 text-lg font-medium tracking-tight">
                {selected.name}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Operated by {selected.sponsor} · {selected.area}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-rose-300/90">
              <span className="size-1.5 rounded-full bg-rose-400" />
              Needs staff
            </span>
          </div>

          <div className="grid gap-8">
            <SubSection title="Clue" hint="What the player sees on this stop">
              <FormRow label="Clue type">
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
              </FormRow>
              <FormRow label="Prompt">
                <Textarea
                  defaultValue={selected.clue}
                  rows={2}
                  className="resize-none text-sm"
                />
              </FormRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Verification code">
                  <div className="flex items-center gap-1.5">
                    <Input
                      defaultValue="HVT-9F4K"
                      className="h-9 font-mono text-sm tracking-[0.06em]"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <CopyIcon className="size-3.5" />
                    </Button>
                  </div>
                </FormRow>
                <FormRow label="Time limit">
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
                </FormRow>
              </div>
            </SubSection>

            <SubSection
              title="Staff assignment"
              hint="Booth operators who can issue this code"
            >
              <ul className="grid divide-y divide-border">
                {[
                  { name: "Mara Ionescu", role: "Lead", primary: true },
                  { name: "Alex Radu", role: "Backup", primary: false },
                ].map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 place-items-center rounded-full bg-primary/12 text-[10px] font-medium text-primary">
                        {s.name.split(" ").map((p) => p[0]).join("")}
                      </span>
                      <div>
                        <p className="text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.role}
                        </p>
                      </div>
                    </div>
                    <Switch defaultChecked={s.primary} />
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <PlusIcon className="size-3.5" /> Invite booth staff
              </button>
            </SubSection>

            <SubSection
              title="Completion rules"
              hint="What counts as solving this checkpoint"
            >
              <ul className="grid divide-y divide-border">
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
              </ul>
            </SubSection>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeading({
  title,
  hint,
  trailing,
}: {
  title: string
  hint?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3 border-b border-border pb-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
      {trailing}
    </div>
  )
}

function SubSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  )
}

function FormRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
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
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="flex-1">
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </li>
  )
}
