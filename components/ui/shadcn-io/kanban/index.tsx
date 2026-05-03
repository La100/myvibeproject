'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import type { DragEndEvent, Modifier } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

export type { DragEndEvent } from '@dnd-kit/core';

// Combined modifier to prevent scrolling and restrict to viewport
const restrictToViewport: Modifier = ({ transform, ...args }) => {
  const restrictedTransform = restrictToWindowEdges({ transform, ...args });
  return restrictToFirstScrollableAncestor({ transform: restrictedTransform, ...args });
};

export type Status = {
  id: string;
  name: string;
  color: string;
};

export type Feature = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: Status;
};

export type KanbanBoardProps = {
  id: Status['id'];
  children: ReactNode;
  className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      className={cn(
        'flex h-full min-h-40 flex-col gap-2 rounded-md border bg-secondary p-2 text-xs shadow-sm outline outline-2 transition-colors',
        isOver ? 'outline-primary' : 'outline-transparent',
        className
      )}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps = Pick<Feature, 'id' | 'name'> & {
  index: number;
  parent: string;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
};

export const KanbanCard = ({
  id,
  name,
  index,
  parent,
  children,
  className,
  disabled = false,
}: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: { index, parent },
      disabled,
    });

  const style = isDragging
    ? {
        opacity: 0.2,
      }
    : {
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        willChange: transform ? 'transform' : undefined,
      };

  return (
    <Card
      className={cn(
        'rounded-md p-3 shadow-sm',
        !disabled && 'touch-none',
        isDragging && 'cursor-grabbing',
        className
      )}
      style={style}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      ref={setNodeRef}
    >
      {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
    </Card>
  );
};

export type KanbanCardsProps = {
  children: ReactNode;
  className?: string;
};

export const KanbanCards = ({ children, className }: KanbanCardsProps) => (
  <div className={cn('flex flex-1 flex-col gap-2', className)}>{children}</div>
);

export type KanbanHeaderProps =
  | {
      children: ReactNode;
    }
  | {
      name: Status['name'];
      color: Status['color'];
      className?: string;
    };

export const KanbanHeader = (props: KanbanHeaderProps) =>
  'children' in props ? (
    props.children
  ) : (
    <div className={cn('flex shrink-0 items-center gap-2', props.className)}>
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: props.color }}
      />
      <p className="m-0 font-semibold text-sm">{props.name}</p>
    </div>
  );

export type KanbanProviderProps = {
  children: ReactNode;
  dragOverlay?: ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
  className?: string;
  enableTouchSensor?: boolean;
};

export const KanbanProvider = ({
  children,
  dragOverlay,
  onDragEnd,
  onDragStart,
  onDragCancel,
  className,
  enableTouchSensor = true,
}: KanbanProviderProps) => {
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10, // 10px movement required before drag starts
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });

  const sensors = useSensors(
    ...(enableTouchSensor ? [mouseSensor, touchSensor] : [mouseSensor])
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={onDragStart}
      onDragCancel={onDragCancel}
      onDragEnd={onDragEnd}
      modifiers={[restrictToViewport]}
      autoScroll={false}
    >
      <div
        className={cn('grid w-full auto-cols-fr grid-flow-col gap-4', className)}
      >
        {children}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragOverlay}
      </DragOverlay>
    </DndContext>
  );
};
