import { Doc } from "@/convex/_generated/dataModel";

export type Task = Doc<"tasks">;
export type ShoppingItem = Doc<"shoppingListItems">;

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: 'task' | 'shopping' | 'deadline' | 'milestone';
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  assignedToName?: string;
  assignedToImageUrl?: string;
  project?: {
    id: string;
    name: string;
    slug: string;
  };
  sourceType: 'task' | 'shopping';
  sourceData: Task | ShoppingItem;
}

export function transformTaskToEvent(task: Task & { 
  assignedToName?: string; 
  assignedToImageUrl?: string;
  project?: { id: string; name: string; slug: string; }
}): CalendarEvent | null {
  // Only include tasks with dates (either startDate or endDate)
  if (!task.startDate && !task.endDate) {
    return null;
  }

  // Determine event type and dates based on what's provided
  let startTime: Date;
  let endTime: Date;
  let eventType: 'task' | 'deadline' | 'milestone';
  let isAllDay: boolean;

  if (task.startDate && task.endDate) {
    // Has both dates - analyze the type
    startTime = new Date(task.startDate);
    endTime = new Date(task.endDate);
    
    const isSameDay = startTime.toDateString() === endTime.toDateString();
    const isSameTimestamp = task.startDate === task.endDate;
    
    // Check if all-day: times are at midnight UTC
    const startIsAllDay = startTime.getUTCHours() === 0 && startTime.getUTCMinutes() === 0;
    const endIsAllDay = endTime.getUTCHours() === 0 && endTime.getUTCMinutes() === 0;
    isAllDay = startIsAllDay && endIsAllDay;
    
    if (isSameDay && isSameTimestamp) {
      // Single point in time
      eventType = isAllDay ? 'deadline' : 'milestone';
    } else if (isSameDay && !isAllDay) {
      // Same day with time range (e.g., meeting 2pm-4pm)
      eventType = 'milestone';
    } else {
      // Multi-day or different days = task
      eventType = 'task';
    }
    
  } else if (task.endDate) {
    // Only endDate - it's a deadline
    endTime = new Date(task.endDate);
    startTime = endTime; // Show on the deadline date
    eventType = 'deadline';
    isAllDay = endTime.getUTCHours() === 0 && endTime.getUTCMinutes() === 0;
    
  } else {
    // Only startDate - it's a milestone/start point
    startTime = new Date(task.startDate!);
    endTime = startTime;
    eventType = 'milestone';
    isAllDay = startTime.getUTCHours() === 0 && startTime.getUTCMinutes() === 0;
  }

  return {
    id: task._id,
    title: task.title,
    description: task.description,
    type: eventType,
    startTime,
    endTime,
    isAllDay,
    color: getPriorityColor(task.priority),
    priority: task.priority || 'medium',
    status: mapTaskStatusToEventStatus(task.status),
    assignedTo: task.assignedTo || undefined,
    assignedToName: task.assignedToName,
    assignedToImageUrl: task.assignedToImageUrl,
    project: task.project,
    sourceType: 'task',
    sourceData: task
  };
}

export function transformShoppingItemToEvent(item: ShoppingItem & { 
  assignedToName?: string; 
  assignedToImageUrl?: string;
  project?: { id: string; name: string; slug: string; }
}): CalendarEvent | null {
  // Only include shopping items with buyBefore dates
  if (!item.buyBefore) {
    return null;
  }

  const startTime = new Date(item.buyBefore);
  const endTime = new Date(item.buyBefore);

  return {
    id: item._id,
    title: `🛒 ${item.name}`,
    description: item.notes ? `Shopping item - ${item.notes}` : 'Shopping item',
    type: 'shopping',
    startTime,
    endTime,
    isAllDay: true,
    color: getPriorityColor(item.priority),
    priority: item.priority || 'medium',
    status: mapShoppingStatusToEventStatus(item.realizationStatus),
    assignedTo: item.assignedTo || undefined,
    assignedToName: item.assignedToName,
    assignedToImageUrl: item.assignedToImageUrl,
    project: item.project,
    sourceType: 'shopping',
    sourceData: item
  };
}

function getPriorityColor(priority?: string | null): string {
  switch (priority) {
    case 'urgent':
      return 'var(--ui-priority-urgent)';
    case 'high':
      return 'var(--ui-priority-high)';
    case 'medium':
      return 'var(--ui-priority-medium)';
    case 'low':
      return 'var(--ui-priority-low)';
    default:
      return 'var(--ui-priority-default)';
  }
}

function mapTaskStatusToEventStatus(status: string): CalendarEvent['status'] {
  switch (status) {
    case 'todo':
      return 'planned';
    case 'in_progress':
      return 'in_progress';
    case 'review':
      return 'confirmed';
    case 'done':
      return 'completed';
    default:
      return 'planned';
  }
}

function mapShoppingStatusToEventStatus(status: string): CalendarEvent['status'] {
  switch (status) {
    case 'PLANNED':
      return 'planned';
    case 'ORDERED':
      return 'confirmed';
    case 'IN_TRANSIT':
      return 'in_progress';
    case 'DELIVERED':
      return 'confirmed';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'planned';
  }
}

export function transformDataToEvents(
  tasks: (Task & { assignedToName?: string; assignedToImageUrl?: string; project?: { id: string; name: string; slug: string; } })[] = [],
  shoppingItems: (ShoppingItem & { assignedToName?: string; assignedToImageUrl?: string; project?: { id: string; name: string; slug: string; } })[] = []
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  // Transform tasks
  tasks.forEach(task => {
    const event = transformTaskToEvent(task);
    if (event) {
      events.push(event);
    }
  });
  
  // Transform shopping items
  shoppingItems.forEach(item => {
    const event = transformShoppingItemToEvent(item);
    if (event) {
      events.push(event);
    }
  });
  
  return events;
}
