"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { X, Edit3, Calendar, Clock, Flag, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CalendarEvent } from "./utils";
import { Doc } from "@/convex/_generated/dataModel";

interface TaskSidebarProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (event: CalendarEvent, newStatus: string) => void;
}

const priorityColors = {
  urgent: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300'
};

const statusColors = {
  planned: 'bg-gray-100 text-gray-800 border-gray-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300'
};

export function TaskSidebar({ 
  event, 
  isOpen, 
  onClose, 
  onStatusChange 
}: TaskSidebarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const params = useParams<{ projectSlug: string }>();

  // Reset editing state when event changes
  useEffect(() => {
    setIsEditing(false);
  }, [event?.id]);

  if (!isOpen || !event) return null;

  const isTask = event.sourceType === 'task';
  const isShopping = event.sourceType === 'shopping';
  const currencySymbol = (event.project as { currency?: string })?.currency === "EUR" ? "€" : (event.project as { currency?: string })?.currency === "PLN" ? "zł" : "$";

  const handleStatusToggle = () => {
    if (isTask) {
      const taskData = event.sourceData as Doc<"tasks">;
      const currentStatus = taskData.status;
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      onStatusChange?.(event, newStatus);
    } else if (isShopping) {
      const shoppingData = event.sourceData as Doc<"shoppingListItems">;
      const currentStatus = shoppingData.realizationStatus;
      const newStatus = currentStatus === 'COMPLETED' ? 'PLANNED' : 'COMPLETED';
      onStatusChange?.(event, newStatus);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/40 sm:bg-black/20 backdrop-blur-sm sm:backdrop-blur-none transition-opacity z-40",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Sidebar/Modal - Full screen on mobile, sidebar on desktop */}
      <div className={cn(
        "fixed bg-white shadow-2xl transform transition-all duration-300 ease-in-out z-50",
        // Mobile: Full screen with slide-up animation
        "bottom-0 left-0 right-0 top-0 sm:top-0 sm:right-0 sm:left-auto",
        "w-full sm:w-96 h-full",
        "rounded-t-3xl sm:rounded-none",
        // Animation
        isOpen 
          ? "translate-y-0 sm:translate-y-0 sm:translate-x-0" 
          : "translate-y-full sm:translate-y-0 sm:translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-12 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-white sticky top-0 z-10">
            <h2 className="text-base sm:text-lg font-semibold">
              {isTask ? 'Task Details' : 'Shopping Item'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-3 sm:p-4 overscroll-contain">
            <div className="space-y-3 sm:space-y-6 pb-6 sm:pb-4">
              {/* Title and Status */}
              <div>
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 className="text-base sm:text-xl font-semibold text-gray-900 flex-1 leading-snug" onClick={() => setIsEditing(true)}>
                    {event.title}
                  </h3>
                  {isEditing && (
                    <textarea
                      value={event.title}
                      onChange={() => { /* Handle change */ }}
                      onBlur={() => setIsEditing(false)}
                      className="w-full text-base sm:text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none resize-none"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStatusToggle}
                    className="p-1 sm:p-1.5 flex-shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                  >
                    {event.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 sm:h-5 sm:w-5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 sm:h-5 sm:w-5 text-gray-400" />
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", priorityColors[event.priority])}
                  >
                    <Flag className="h-3 w-3 mr-1" />
                    {event.priority}
                  </Badge>
                  
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", statusColors[event.status])}
                  >
                    {event.status === 'in_progress' ? 'In Progress' : event.status}
                  </Badge>
                  
                  <Badge variant="outline" className="text-xs">
                    {event.type}
                  </Badge>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Description</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {event.description}
                  </p>
                </div>
              )}

              <Separator />

              {/* Time Info */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Schedule</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-600 text-xs sm:text-sm">
                      {format(event.startTime, 'EEEE, MMMM d, yyyy')}
                    </span>
                  </div>
                  
                  {!event.isAllDay && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-600 text-xs sm:text-sm">
                        {format(event.startTime, 'h:mm a')} - {format(event.endTime, 'h:mm a')}
                      </span>
                    </div>
                  )}
                  
                  {event.isAllDay && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-600 text-xs sm:text-sm">All day</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment */}
              {event.assignedToName && event.assignedTo && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Assigned to</h4>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={event.assignedToImageUrl} />
                      <AvatarFallback className="text-sm">
                        {event.assignedToName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {event.assignedToName}
                      </p>
                      <p className="text-xs text-gray-500">Assignee</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Project */}
              {event.project && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Project</h4>
                  <p className="text-sm text-gray-600">{event.project.name}</p>
                </div>
              )}

              {/* Task-specific fields */}
              {isTask && (
                <div className="space-y-4">
                  <Separator />
                  
                  {(event.sourceData as Doc<"tasks">).tags && (event.sourceData as Doc<"tasks">).tags.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {(event.sourceData as Doc<"tasks">).tags.map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Shopping-specific fields */}
              {isShopping && (
                <div className="space-y-4">
                  <Separator />
                  
                  {(event.sourceData as Doc<"shoppingListItems">).quantity && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Quantity</h4>
                      <p className="text-sm text-gray-600">{(event.sourceData as Doc<"shoppingListItems">).quantity}</p>
                    </div>
                  )}
                  
                  {(event.sourceData as Doc<"shoppingListItems">).supplier && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Supplier</h4>
                      <p className="text-sm text-gray-600 break-words">{(event.sourceData as Doc<"shoppingListItems">).supplier}</p>
                    </div>
                  )}
                  
                  {(event.sourceData as Doc<"shoppingListItems">).unitPrice && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Unit Price</h4>
                      <p className="text-sm text-gray-600">{(event.sourceData as Doc<"shoppingListItems">).unitPrice} {currencySymbol}</p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Metadata */}
              <div className="text-xs text-gray-500 space-y-1">
                <p>Created: {format(new Date(event.sourceData._creationTime), 'MMM d, yyyy h:mm a')}</p>
                {(event.sourceData as Doc<"tasks"> | Doc<"shoppingListItems">).updatedAt && (
                  <p>Updated: {format(new Date((event.sourceData as Doc<"tasks"> | Doc<"shoppingListItems">).updatedAt!), 'MMM d, yyyy h:mm a')}</p>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="p-3 sm:p-4 border-t bg-gray-50 sticky bottom-0 safe-bottom">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10 sm:h-9"
                onClick={() => {
                  if (event?.sourceType === 'task' && params.projectSlug && event?.sourceData?._id) {
                    router.push(`/organisation/projects/${params.projectSlug}/tasks/${event.sourceData._id}`);
                  }
                }}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
