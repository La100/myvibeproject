import type { Team, User } from "../../types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Building2, ChevronRight, LogOut, Users2 } from "lucide-react"

interface TeamViewProps {
  teams: Team[]
  user: User
  onTeamSelect: (team: Team) => void
  onLogout: () => void
}

const TeamView = ({ teams, user, onTeamSelect, onLogout }: TeamViewProps) => {
  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="vp-title">Your teams</p>
          <h2 className="mt-1 text-xl font-semibold">Choose a workspace</h2>
        </div>

        <Button variant="ghost" size="sm" onClick={onLogout} className="text-foreground/70">
          <LogOut className="mr-1 h-4 w-4" />
          Sign out
        </Button>
      </div>

      <div className="clean-panel mb-3 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Users2 className="h-4 w-4 text-primary" />
          <span className="font-semibold">{teams.length} teams</span>
        </div>
        <span className="vp-chip">{user.email}</span>
      </div>

      {teams.length === 0 ? (
        <div className="clean-panel flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Building2 className="mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-1 text-base font-semibold">No teams found</h3>
          <p className="text-sm text-muted-foreground">
            You must belong to at least one team to use this extension.
          </p>
        </div>
      ) : (
        <ScrollArea className="vp-scrollbar flex-1 pr-1">
          <div className="space-y-2 pb-1">
            {teams.map((team) => (
              <button
                key={team._id}
                type="button"
                className="clean-surface group w-full rounded-2xl px-4 py-3 text-left transition-all duration-200 hover:-translate-y-[1px] hover:bg-accent/45"
                onClick={() => onTeamSelect(team)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                      <Building2 className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.projects.length} projects
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

export default TeamView
