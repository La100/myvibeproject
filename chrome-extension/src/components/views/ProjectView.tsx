import type { Project, Team } from "../../types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, ChevronRight, FolderOpen } from "lucide-react"

interface ProjectViewProps {
  team: Team
  onProjectSelect: (project: Project) => void
  onBack: () => void
}

const ProjectView = ({ team, onProjectSelect, onBack }: ProjectViewProps) => {
  const projects = team.projects || []

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mt-0.5 h-9 w-9 rounded-full border border-border/80 bg-background/80 p-0 text-foreground shadow-sm hover:bg-accent/60"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
          </Button>
          <div>
            <p className="vp-title">Team projects</p>
            <h2 className="mt-1 text-xl font-semibold">{team.name}</h2>
          </div>
        </div>
        <span className="vp-chip">{projects.length} active</span>
      </div>

      {projects.length > 0 ? (
        <ScrollArea className="vp-scrollbar flex-1 pr-1">
          <div className="space-y-2 pb-1">
            {projects.map((project) => (
              <button
                key={project._id}
                type="button"
                className="clean-surface group w-full rounded-2xl px-4 py-3 text-left transition-all duration-200 hover:-translate-y-[1px] hover:bg-accent/45"
                onClick={() => onProjectSelect(project)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                      <FolderOpen className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.sections.length} shopping list sections
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      ) : (
          <div className="clean-panel flex flex-1 flex-col items-center justify-center px-6 text-center">
            <FolderOpen className="mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-1 text-base font-semibold">No projects found</h3>
          <p className="text-sm text-muted-foreground">
            This team does not have any active projects yet.
          </p>
        </div>
      )}
    </div>
  )
}

export default ProjectView
