"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { LayoutGrid, List, ChevronsUpDown, X, MessageSquare, ListTodo, Plus } from "lucide-react";
import Link from "next/link";
import TaskForm from "./TaskForm";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  type DragEndEvent,
} from '@/components/ui/shadcn-io/kanban';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const formatDateTime = (timestamp: number | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    if (hasTime) {
      return format(date, "MM/dd/yyyy, HH:mm");
    }
    return format(date, "MM/dd/yyyy");
};

type TaskStatusKey = "todo" | "in_progress" | "review" | "done";

type TaskStatusLiterals = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent" | null | undefined;

const columnOrder: TaskStatusKey[] = ["todo", "in_progress", "review", "done"];

type KanbanTask = {
  id: Id<"tasks">;
  name: string;
  column: TaskStatusLiterals;
  title: string;
  description: string | undefined;
  content: string | undefined;
  priority: TaskPriority;
  startDate: number | undefined;
  endDate: number | undefined;
  cost: number | undefined;
  status: TaskStatusLiterals;
  assignedTo: string | null | undefined;
  assignedToName: string | undefined;
  assignedToImageUrl: string | undefined;
  tags: string[] | undefined;
  commentCount: number;
};

type TaskWithDetails = {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  content?: string;
  priority?: TaskPriority;
  startDate?: number;
  endDate?: number;
  cost?: number;
  status: TaskStatusLiterals;
  assignedTo?: string | null;
  assignedToName?: string;
  assignedToImageUrl?: string;
  tags?: string[];
  commentCount: number;
};

interface TeamMemberWithUser {
  _id: Id<"teamMembers">;
  clerkUserId: string;
  name: string;
}

// A simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const priorityColors: Record<NonNullable<TaskPriority>, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

const getPriorityDisplay = (priority: TaskPriority) => {
  if (!priority || priority === null) return { label: "No priority", color: "bg-gray-50 text-gray-400" };
  return { label: priority, color: priorityColors[priority] };
};

export function TasksViewSkeleton({ viewMode = "kanban" }: { viewMode?: "kanban" | "list" }) {
  return (
    <div className="p-4 h-full flex flex-col animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-10 flex-grow" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-2">
              <Skeleton className="h-6 w-3/4 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-grow border rounded-lg">
          <div className="p-4">
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TasksView() {
  const params = useParams<{ projectSlug: string }>();
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  
  const [filters, setFilters] = useState<{
    searchQuery: string;
    status: string[];
    priority: string[];
    assignedTo: string[];
    tags: string[];
  }>({ searchQuery: "", status: [], priority: [], assignedTo: [], tags: [] });

  const [sorting, setSorting] = useState<{
    sortBy: string;
    sortOrder: "asc" | "desc";
  }>({ sortBy: "createdAt", sortOrder: "desc" });

  const debouncedSearchQuery = useDebounce(filters.searchQuery, 300);

  const { project } = useProject();
  
  const teamMembers = useQuery(apiAny.teams.getTeamMembers, {
    teamId: project.teamId,
  }) as TeamMemberWithUser[] | undefined;

  const tasks = useQuery(apiAny.tasks.listProjectTasks, {
    projectId: project._id,
    filters: {
      ...filters,
      searchQuery: debouncedSearchQuery,
    },
    sortBy: sorting.sortBy,
    sortOrder: sorting.sortOrder
  }) as TaskWithDetails[] | undefined;

  const [preservedTasks, setPreservedTasks] = useState<typeof tasks>(undefined);

  useEffect(() => {
    if (tasks !== undefined) {
      setPreservedTasks(tasks);
    }
  }, [tasks]);

  const tasksToDisplay = tasks ?? preservedTasks;

  const hasAccess = useQuery(apiAny.projects.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );
  
  const updateTaskStatus = useMutation(apiAny.tasks.updateTaskStatus);
  
  const statusOptions = useMemo(() => 
    project.taskStatusSettings 
      ? Object.entries(project.taskStatusSettings)
          .map(([id, { name, color }]) => ({ value: id, label: name, color }))
          .sort((a, b) => columnOrder.indexOf(a.value as TaskStatusKey) - columnOrder.indexOf(b.value as TaskStatusKey))
      : [],
    [project]
  );
  
  const priorityOptions = [
      { value: "urgent", label: "Urgent" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
  ];

  const assignedToOptions = useMemo(() =>
    teamMembers?.map((member: TeamMemberWithUser) => ({ value: member.clerkUserId!, label: member.name! })) || [],
    [teamMembers]
  );
  
  const kanbanTasks = useMemo(() => tasksToDisplay?.map(task => ({
    id: task._id,
    name: task.title,
    column: task.status,
    title: task.title,
    description: task.description,
    content: task.content,
    priority: task.priority as TaskPriority,
    startDate: task.startDate,
    endDate: task.endDate,
    cost: task.cost,
    status: task.status,
    assignedTo: task.assignedTo,
    assignedToName: task.assignedToName,
    assignedToImageUrl: task.assignedToImageUrl,
    tags: task.tags,
    commentCount: task.commentCount,
  })) || [], [tasksToDisplay]);
  
  const [localKanbanTasks, setLocalKanbanTasks] = useState<KanbanTask[]>(kanbanTasks);

  useEffect(() => {
    setLocalKanbanTasks(kanbanTasks);
  }, [kanbanTasks]);

  const tagsOptions = useMemo(() => {
    const allTags = tasksToDisplay?.flatMap(task => task.tags || []) || [];
    const uniqueTags = [...new Set(allTags)];
    return Array.from(uniqueTags).map(tag => ({ value: tag, label: tag }));
  }, [tasksToDisplay]);

  const handleFilterChange = (filterType: keyof typeof filters, value: string | string[]) => {
      setFilters(prev => ({...prev, [filterType]: value}));
  };

  const clearFilters = () => {
    setFilters({ searchQuery: "", status: [], priority: [], assignedTo: [], tags: [] });
  };

  const handleSortChange = (newSortBy: string) => {
    setSorting(prev => ({
      sortBy: newSortBy,
      sortOrder: prev.sortBy === newSortBy && prev.sortOrder === "desc" ? "asc" : "desc",
    }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const columnId = (over.data.current?.parent || over.id) as TaskStatusLiterals;

    if (!statusOptions.some(s => s.value === columnId)) {
        return;
    }

    const task = localKanbanTasks.find(t => t.id === cardId);
    if (task && task.column !== columnId) {
      setLocalKanbanTasks(prev => {
        return prev.map(t =>
          t.id === cardId ? { ...t, column: columnId } : t
        );
      });

      try {
        await updateTaskStatus({
          taskId: cardId as Id<"tasks">,
          status: columnId,
        });
        toast.success("Task status updated.");
      } catch {
        toast.error("Failed to update task status.");
        // Revert optimistic update on failure
        setLocalKanbanTasks(prev => {
           return prev.map(t =>
            t.id === cardId ? { ...t, column: task.column } : t
          );
        });
      }
    }
  };

  const isFiltered = filters.searchQuery !== "" || filters.status.length > 0 || filters.priority.length > 0 || filters.assignedTo.length > 0 || filters.tags.length > 0;

  if (project === undefined || hasAccess === undefined || teamMembers === undefined) {
    return <TasksViewSkeleton viewMode={viewMode} />;
  }

  if (project === null) {
    return <div>Project not found.</div>;
  }

  if (hasAccess === false) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>You do not have access to view tasks for this project.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
       <div className="flex-shrink-0 sticky top-0 z-10 p-4 border-b mb-4">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-bold">{project.name} Tasks</h1>
             <p className="text-muted-foreground">Manage your project's tasks</p>
           </div>
           <div className="flex items-center gap-2">
             <Button onClick={() => setIsTaskFormOpen(true)} disabled={!hasAccess || (typeof hasAccess === 'object' && hasAccess.role === 'customer')}>
                Add Task
            </Button>
             <div className="flex items-center rounded-md border bg-background">
                <Button
                 variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                 size="sm"
                 onClick={() => setViewMode('kanban')}
                 className="rounded-r-none"
               >
                 <LayoutGrid className="h-4 w-4" />
               </Button>
               <Button
                 variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                 size="sm"
                 onClick={() => setViewMode('list')}
                 className="rounded-l-none"
               >
                 <List className="h-4 w-4" />
               </Button>
             </div>
           </div>
         </div>
         
         {/* Filters */}
         <div className="flex items-center gap-2 mt-4">
           <Input 
             placeholder="Search tasks..." 
             className="max-w-sm" 
             value={filters.searchQuery}
             onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
           />
 
           <DataTableFacetedFilter 
             title="Status"
             options={statusOptions}
             selectedValues={new Set(filters.status)}
             onFilterChange={(selected) => handleFilterChange('status', Array.from(selected))}
           />
           <DataTableFacetedFilter 
             title="Priority"
             options={priorityOptions}
             selectedValues={new Set(filters.priority)}
             onFilterChange={(selected) => handleFilterChange('priority', Array.from(selected))}
           />
            <DataTableFacetedFilter 
             title="Assignee"
             options={assignedToOptions}
             selectedValues={new Set(filters.assignedTo)}
             onFilterChange={(selected) => handleFilterChange('assignedTo', Array.from(selected))}
           />
           <DataTableFacetedFilter
             title="Tags"
             options={tagsOptions}
             selectedValues={new Set(filters.tags)}
             onFilterChange={(selected) => handleFilterChange('tags', Array.from(selected))}
           />
 
           {isFiltered && <Button variant="ghost" onClick={clearFilters} className="h-8 px-2 lg:px-3">Reset <X className="ml-2 h-4 w-4"/></Button>}
         </div>
       </div>
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create a new task</DialogTitle>
          </DialogHeader>
          {project && (
            <TaskForm
              projectId={project._id}
              teamId={project.teamId}
              teamMembers={teamMembers || []}
              currency={project.currency}
              setIsOpen={setIsTaskFormOpen}
              onTaskCreated={() => {
                // Optionally refetch tasks or handle UI update
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex-grow overflow-y-auto overflow-x-hidden">
        {localKanbanTasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Get started by creating your first task to track your project progress"
            action={{
              label: "Create Task",
              onClick: () => setIsTaskFormOpen(true),
              icon: Plus,
            }}
          />
        ) : viewMode === "kanban" ? (
          <KanbanProvider onDragEnd={handleDragEnd}>
            <div className="grid flex-grow grid-cols-1 gap-4 items-start md:grid-cols-2 lg:grid-cols-4">
              {statusOptions.map((status) => (
                <KanbanBoard id={status.value} key={status.value}>
                  <KanbanHeader
                    name={status.label}
                    color={status.color}
                  />
                  <KanbanCards>
                    {localKanbanTasks
                      .filter((task) => task.column === status.value)
                      .map((task, index) => (
                        <KanbanCard
                          key={task.id}
                          id={task.id}
                          name={task.name}
                          index={index}
                          parent={status.value}
                          className="border-0 bg-transparent p-0 shadow-none"
                        >
                            <TaskCardContent
                            task={task}
                            projectSlug={params.projectSlug}
                          />
                        </KanbanCard>
                      ))}
                  </KanbanCards>
                </KanbanBoard>
              ))}
            </div>
          </KanbanProvider>
        ) : (
          <Card className="flex-grow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSortChange('title')}>
                    <div className="flex items-center cursor-pointer">
                      Task <ChevronsUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead onClick={() => handleSortChange('endDate')}>
                    <div className="flex items-center cursor-pointer">
                      End Date <ChevronsUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksToDisplay?.map((task) => (
                  <TableRow key={task._id}>
                    <TableCell className="font-medium">
                      <Link href={`/organisation/projects/${params.projectSlug}/tasks/${task._id}`}>
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge style={{ 
                        backgroundColor: project.taskStatusSettings?.[task.status]?.color,
                        color: 'white',
                      }}>
                        {project.taskStatusSettings?.[task.status]?.name || task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.priority && <Badge variant="outline">{task.priority}</Badge>}
                    </TableCell>
                    <TableCell>
                      {task.assignedToName && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={task.assignedToImageUrl} />
                            <AvatarFallback>{task.assignedToName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{task.assignedToName}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.endDate ? formatDateTime(task.endDate) : task.startDate ? formatDateTime(task.startDate) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {task.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <ChevronsUpDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}

function TaskCardContent({ task, projectSlug }: { task: KanbanTask, projectSlug: string }) {
  const priority = getPriorityDisplay(task.priority);

  // Priority accent colors
  const priorityAccentColors = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
  };

  return (
    <div className="relative block hover-lift bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer">
      {/* Priority accent bar */}
      {task.priority && (
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
          priorityAccentColors[task.priority as keyof typeof priorityAccentColors]
        )} />
      )}

      <div className="flex justify-between items-start mb-2">
        <Link href={`/organisation/projects/${projectSlug}/tasks/${task.id}`} className="flex-1">
          <h4 className="font-semibold text-sm hover:underline line-clamp-2">{task.title}</h4>
        </Link>
        {task.priority && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={`${priority.color} text-xs ml-2 shrink-0`}>{priority.label}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Priority: {priority.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
      )}

      {(task.startDate || task.endDate) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          {task.startDate && task.endDate ? (
            <span>{formatDateTime(task.startDate)} - {formatDateTime(task.endDate)}</span>
          ) : task.endDate ? (
            <span>Due: {formatDateTime(task.endDate)}</span>
          ) : (
            <span>Start: {formatDateTime(task.startDate!)}</span>
          )}
        </div>
      )}

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-auto pt-3 border-t">
        <div className="flex items-center gap-3">
          {task.commentCount > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{task.commentCount}</span>
            </div>
          )}
        </div>
        <div className="flex items-center -space-x-2">
          {task.assignedTo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="w-6 h-6 border-2 border-background hover:scale-110 transition-transform">
                    <AvatarImage src={task.assignedToImageUrl} />
                    <AvatarFallback className="text-xs">{task.assignedToName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assigned to {task.assignedToName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
} 
